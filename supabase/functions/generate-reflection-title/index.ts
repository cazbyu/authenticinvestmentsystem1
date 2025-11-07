import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  reflectionId: string;
  content: string;
}

interface TitleResponse {
  title: string | null;
  tokensUsed?: number;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', title: null }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: RequestPayload = await req.json();
    console.log('Generating title for reflection:', payload.reflectionId);

    if (!payload.content || payload.content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Content is required', title: null }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Truncate content if too long (OpenAI has token limits)
    const truncatedContent = payload.content.slice(0, 2000);

    // Call OpenAI API to generate title
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, meaningful titles for daily reflections. Generate titles that capture the essence or main theme of the reflection in 60 characters or less. Be specific and descriptive. Do not use quotes around the title.'
          },
          {
            role: 'user',
            content: `Generate a short, meaningful title (max 60 characters) for this reflection:\n\n${truncatedContent}`
          }
        ],
        max_tokens: 20,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);

      return new Response(
        JSON.stringify({
          error: `OpenAI API error: ${openaiResponse.status}`,
          title: null
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const generatedTitle = openaiData.choices?.[0]?.message?.content?.trim() || null;
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    console.log('Title generated successfully:', {
      reflectionId: payload.reflectionId,
      title: generatedTitle,
      tokensUsed,
    });

    // Update the reflection with the generated title
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from('0008-ap-reflections')
      .update({
        reflection_title: generatedTitle,
        title_generated_at: new Date().toISOString(),
        title_generation_method: 'ai',
      })
      .eq('id', payload.reflectionId);

    if (updateError) {
      console.error('Failed to update reflection with title:', updateError);
      return new Response(
        JSON.stringify({
          error: 'Failed to save title to database',
          title: generatedTitle,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        title: generatedTitle,
        tokensUsed,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Fatal error in generate-reflection-title:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: String(error),
        title: null,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});