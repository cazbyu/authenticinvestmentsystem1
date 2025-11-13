# Authentication Fix - Quick Start Guide

## 3-Minute Setup

Follow these steps to fix authentication in your app.

### Step 1: Apply Database Migration (2 minutes)

1. Open https://wyipyiahvjcvnwoxwttd.supabase.co
2. Click **SQL Editor** in sidebar
3. Click **New Query**
4. Copy and paste the entire contents of:
   ```
   supabase/migrations/20251113000000_fix_user_profile_schema_and_trigger.sql
   ```
5. Click **Run** (bottom right)
6. Wait for "Success. No rows returned" message
7. ✅ Done! Migration applied.

### Step 2: Configure Redirect URLs (1 minute)

1. In Supabase Dashboard, click **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, click **Add URL**
3. Add your callback URL:
   - **If testing locally**: `http://localhost:8081/auth/callback`
   - **If in production**: `https://yourdomain.com/auth/callback`
4. Set **Site URL** to match (without `/auth/callback`)
5. Click **Save**
6. ✅ Done! OAuth configured.

### Step 3: Test Authentication

**Email Signup Test:**
1. Open your app
2. Click "Create Account"
3. Fill in all fields
4. Click "Create Account" button
5. ✅ Should redirect to dashboard (no error)

**Google OAuth Test:**
1. Open your app
2. Click "Continue with Google"
3. Select Google account
4. ✅ Should redirect to dashboard (not home page)

## Verification

Open browser console (F12) and look for:
- `[SignUp] Success! User created:`
- `[Auth Callback] Session found, user ID:`
- `[Profile Check] Profile already exists`

No errors = Everything working! ✅

## Still Having Issues?

1. **Check if migration ran**:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = '0008-ap-users'
   AND column_name IN ('oauth_provider', 'oauth_provider_id');
   ```
   Should return 2 rows.

2. **Check redirect URLs**:
   - Make sure the URL matches exactly
   - Check for typos
   - Verify protocol (http vs https)

3. **Clear browser cache**:
   - Press Ctrl+Shift+Delete (or Cmd+Shift+Delete)
   - Clear "Cookies and site data"
   - Try in incognito/private window

4. **Check Google OAuth**:
   - Supabase Dashboard → Authentication → Providers
   - Verify Google is enabled
   - Check Client ID and Secret are filled

## What Was Fixed

✅ Database trigger now includes all required columns
✅ Comprehensive error handling added
✅ Fallback profile creation if trigger fails
✅ OAuth redirect properly configured
✅ Detailed logging for debugging

## Support Files

- Full details: `AUTH_FIX_SUMMARY.md`
- Configuration guide: `OAUTH_CONFIGURATION_GUIDE.md`
- Diagnostic script: `sql/diagnostics/check_auth_system.sql`

---

**Need help?** Check browser console logs for detailed error messages.
