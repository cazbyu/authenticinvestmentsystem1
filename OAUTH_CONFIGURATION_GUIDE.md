# OAuth Configuration Guide

This guide explains how to configure Google OAuth and fix the authentication issues in your application.

## Current Issue

Users attempting to sign up or sign in (both email/password and Google OAuth) are experiencing:
1. Email signup: "Database error saving new user" error
2. Google OAuth: Cycling back to the home page without completing authentication

## Root Causes

1. **Database Schema Mismatch**: The trigger function `handle_new_user_profile()` was trying to insert columns that didn't exist in the `0008-ap-users` table
2. **Missing OAuth Redirect Configuration**: The OAuth callback URL is not whitelisted in Supabase

## Fix Implementation

### Step 1: Apply Database Migration

A new migration file has been created to fix the schema issues:
`supabase/migrations/20251113000000_fix_user_profile_schema_and_trigger.sql`

**To apply this migration:**

1. Log in to your Supabase Dashboard: https://wyipyiahvjcvnwoxwttd.supabase.co
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and run the SQL script
5. Verify the output shows successful column additions

**What this migration does:**
- Adds missing columns: `oauth_provider`, `oauth_provider_id`, `profile_image_source`
- Adds missing columns: `mission_text`, `vision_text`, `vision_timeframe`, `week_start_day`
- Recreates the trigger function with comprehensive error handling
- Adds SECURITY DEFINER to bypass RLS during profile creation

### Step 2: Configure OAuth Redirect URLs in Supabase

1. **Navigate to Authentication Settings**
   - Go to https://wyipyiahvjcvnwoxwttd.supabase.co
   - Click on "Authentication" in the left sidebar
   - Select "URL Configuration"

2. **Add Redirect URLs**

   Add the following URLs to the "Redirect URLs" list:

   **For Production:**
   ```
   https://yourdomain.com/auth/callback
   ```

   **For Local Development:**
   ```
   http://localhost:8081/auth/callback
   ```

   **For Preview Deployments (if using Vercel/Netlify):**
   ```
   https://**-yourusername.vercel.app/auth/callback
   ```

   Note: Replace `yourdomain.com` with your actual production domain
   Note: The `**` wildcard pattern allows preview URLs

3. **Set Site URL**

   Set the "Site URL" to your primary production domain:
   ```
   https://yourdomain.com
   ```

   For local development testing, you can temporarily set it to:
   ```
   http://localhost:8081
   ```

4. **Save the Configuration**
   - Click "Save" to apply the changes
   - Wait 1-2 minutes for the changes to propagate

### Step 3: Verify Google OAuth Configuration

1. **Check Google Cloud Console**
   - Go to https://console.cloud.google.com
   - Navigate to "APIs & Services" > "Credentials"
   - Find your OAuth 2.0 Client ID

2. **Verify Authorized Redirect URIs**

   Ensure the following URI is listed:
   ```
   https://wyipyiahvjcvnwoxwttd.supabase.co/auth/v1/callback
   ```

   This is the Supabase auth callback URL (different from your app's callback URL)

3. **Verify OAuth Provider in Supabase**
   - In Supabase Dashboard, go to "Authentication" > "Providers"
   - Ensure "Google" is enabled
   - Verify your Google Client ID and Client Secret are correctly configured

### Step 4: Test the Authentication Flow

1. **Test Email/Password Signup**
   - Open your application
   - Navigate to the signup page
   - Fill in all fields (First Name, Last Name, Email, Password)
   - Click "Create Account"
   - Check the browser console for detailed logs
   - Expected: User should be created and redirected to dashboard

2. **Test Google OAuth**
   - Click "Continue with Google"
   - Select a Google account
   - Grant permissions
   - Expected: User should be redirected to `/auth/callback` and then to dashboard
   - Check the browser console for logs starting with `[Auth Callback]` and `[Profile Check]`

## Fallback Mechanisms

The updated code now includes multiple fallback mechanisms:

1. **Trigger Function with Error Handling**: The database trigger now has comprehensive error handling and logging
2. **Manual Profile Creation in Signup**: If the trigger fails, the signup flow will attempt to create the profile manually
3. **Profile Check in Auth Callback**: The OAuth callback handler verifies the profile exists and creates it if missing

## Troubleshooting

### If signup still fails:

1. **Check Supabase Logs**
   - Go to Supabase Dashboard > Logs
   - Look for errors related to profile creation
   - Check for RLS policy violations or missing columns

2. **Verify Migration Applied**
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = '0008-ap-users'
   ORDER BY ordinal_position;
   ```

   Expected columns:
   - id, user_id, first_name, last_name, profile_image
   - oauth_provider, oauth_provider_id, profile_image_source
   - mission_text, vision_text, vision_timeframe
   - primary_color, accent_color, week_start_day
   - created_at, updated_at

3. **Check Trigger Status**
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE event_object_table = 'users'
   AND event_object_schema = 'auth';
   ```

   Expected: `on_auth_user_created_profile` trigger should be listed

### If Google OAuth redirects incorrectly:

1. **Verify Redirect URL Whitelist**
   - Ensure your callback URL is in the Supabase redirect URL whitelist
   - Check for typos in the URL
   - Ensure the protocol (http/https) matches your environment

2. **Check Browser Console**
   - Open browser developer tools
   - Look for logs starting with `[Auth Callback]`
   - Check for session errors or profile creation failures

3. **Clear Browser Cache**
   - Clear cookies and local storage
   - Try authentication in an incognito/private window

## Additional Notes

- The database trigger uses `SECURITY DEFINER` to bypass RLS policies during profile creation
- All authentication functions now include detailed console logging for debugging
- Profile creation has multiple fallback mechanisms to ensure reliability
- OAuth metadata (avatar, name, etc.) is automatically extracted and stored

## Support

If you continue to experience issues after following this guide:

1. Check the browser console for detailed error logs
2. Review the Supabase Dashboard logs for database errors
3. Verify all environment variables are correctly set
4. Ensure your deployment has the latest code changes
