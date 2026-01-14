import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    const { user_id } = JSON.parse(event.body || '{}');

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'user_id is required' }),
      };
    }

    // Verify environment variables are present
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error - Supabase' }),
      };
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error - Google' }),
      };
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the user's Google Calendar connection
    const { data: connection, error: fetchError } = await supabase
      .from('0008-ap-calendar-connections')
      .select('refresh_token, user_id, access_token, token_expires_at')
      .eq('user_id', user_id)
      .eq('provider', 'google')
      .single();

    if (fetchError || !connection) {
      console.error('Failed to fetch connection:', fetchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No Google Calendar connection found' }),
      };
    }

    if (!connection.refresh_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'No refresh token available',
          needsReconnect: true
        }),
      };
    }

    // Call Google's token endpoint
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Google token refresh failed:', errorData);

      if (errorData.error === 'invalid_grant') {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            error: 'Refresh token expired or revoked',
            needsReconnect: true
          }),
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to refresh token',
          details: errorData
        }),
      };
    }

    const tokenData = await tokenResponse.json();
    const newAccessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update the database with new token
    const { error: updateError } = await supabase
      .from('0008-ap-calendar-connections')
      .update({
        access_token: newAccessToken,
        token_expires_at: expiresAt,
      })
      .eq('user_id', user_id)
      .eq('provider', 'google');

    if (updateError) {
      console.error('Failed to update token in database:', updateError);
      // Still return token - the refresh worked
    }

    console.log('Token refreshed successfully for user:', user_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: newAccessToken,
        expires_at: expiresAt,
      }),
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
