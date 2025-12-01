-- ===============================================
-- FIX USER PROFILE TRIGGER FOR ACTUAL SCHEMA
-- ===============================================
-- This script removes the incompatible trigger from migration 20251113000000
-- and ensures the correct trigger is in place for the actual schema where
-- public."0008-ap-users" uses `id` as the primary key (NOT `user_id`).
--
-- IMPORTANT: This script does NOT modify the table structure.
-- It ONLY fixes the trigger/function to match the existing schema.
-- ===============================================

-- Step 1: Drop the incompatible trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_profile() CASCADE;

-- Step 2: Recreate the correct trigger function for the actual schema
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_profile_image text;
  v_oauth_provider text;
  v_profile_image_source text;
  v_oauth_provider_id text;
  v_full_name text;
BEGIN
  -- Log the attempt
  RAISE NOTICE 'Creating profile for user: %', NEW.id;

  -- Check if profile already exists (prevent duplicates)
  IF EXISTS (SELECT 1 FROM public."0008-ap-users" WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user: %', NEW.id;

    -- Update last_login for existing user
    UPDATE public."0008-ap-users"
    SET last_login = now(), updated_at = now()
    WHERE id = NEW.id;

    RETURN NEW;
  END IF;

  -- Determine OAuth provider
  BEGIN
    SELECT provider, id INTO v_oauth_provider, v_oauth_provider_id
    FROM auth.identities
    WHERE user_id = NEW.id AND provider != 'email'
    LIMIT 1;

    IF v_oauth_provider IS NULL THEN
      v_oauth_provider := 'email';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_oauth_provider := 'email';
    RAISE NOTICE 'Error determining OAuth provider: %', SQLERRM;
  END;

  -- Extract profile image from OAuth metadata
  v_profile_image := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- Set profile image source
  IF v_profile_image IS NOT NULL THEN
    v_profile_image_source := 'oauth';
  ELSE
    v_profile_image_source := 'default';
  END IF;

  -- Extract first name
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    ''
  );

  -- Extract last name
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    ''
  );

  -- If first_name is empty but we have full_name, try to parse it
  IF (v_first_name = '' OR v_first_name IS NULL) THEN
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    );

    IF v_full_name IS NOT NULL THEN
      -- Split full name on first space
      v_first_name := COALESCE(split_part(v_full_name, ' ', 1), '');
      -- Everything after first space is last name
      IF position(' ' in v_full_name) > 0 THEN
        v_last_name := COALESCE(substring(v_full_name from position(' ' in v_full_name) + 1), '');
      END IF;
    END IF;
  END IF;

  -- Insert the user profile with comprehensive error handling
  BEGIN
    INSERT INTO public."0008-ap-users" (
      id,              -- Primary key = auth user ID
      email,           -- Required NOT NULL field
      first_name,
      last_name,
      profile_image,
      oauth_provider,
      oauth_provider_id,
      profile_image_source,
      last_login
    )
    VALUES (
      NEW.id,          -- Use auth user ID directly
      COALESCE(NEW.email, ''),  -- Email is required
      v_first_name,
      v_last_name,
      v_profile_image,
      v_oauth_provider,
      v_oauth_provider_id,
      v_profile_image_source,
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, "0008-ap-users".email),
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), "0008-ap-users".first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), "0008-ap-users".last_name),
      -- Only update profile_image if current source is not 'manual'
      profile_image = CASE
        WHEN "0008-ap-users".profile_image_source = 'manual' THEN "0008-ap-users".profile_image
        WHEN EXCLUDED.profile_image IS NOT NULL THEN EXCLUDED.profile_image
        ELSE "0008-ap-users".profile_image
      END,
      oauth_provider = COALESCE(EXCLUDED.oauth_provider, "0008-ap-users".oauth_provider),
      oauth_provider_id = COALESCE(EXCLUDED.oauth_provider_id, "0008-ap-users".oauth_provider_id),
      -- Only update source if not manual
      profile_image_source = CASE
        WHEN "0008-ap-users".profile_image_source = 'manual' THEN 'manual'
        ELSE COALESCE(EXCLUDED.profile_image_source, "0008-ap-users".profile_image_source)
      END,
      last_login = now(),
      updated_at = now();

    RAISE NOTICE 'Successfully created/updated profile for user: %', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Profile already exists for user (unique violation): %', NEW.id;
    WHEN foreign_key_violation THEN
      RAISE WARNING 'Foreign key violation creating profile for user: %, Error: %', NEW.id, SQLERRM;
      RAISE;
    WHEN OTHERS THEN
      RAISE WARNING 'Error creating profile for user: %, Error: %, Detail: %', NEW.id, SQLERRM, SQLSTATE;
      RAISE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Step 4: Verify the setup
DO $$
DECLARE
  trigger_count int;
  function_exists boolean;
BEGIN
  -- Check if trigger exists
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE t.tgname = 'on_auth_user_created_profile'
    AND n.nspname = 'auth'
    AND c.relname = 'users';

  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'handle_new_user_profile'
      AND n.nspname = 'public'
  ) INTO function_exists;

  RAISE NOTICE '=== User Profile Trigger Status ===';
  RAISE NOTICE 'Function exists: %', function_exists;
  RAISE NOTICE 'Trigger count: %', trigger_count;

  IF trigger_count = 1 AND function_exists THEN
    RAISE NOTICE 'SUCCESS: Trigger is properly configured!';
  ELSE
    RAISE WARNING 'PROBLEM: Trigger may not be properly configured';
  END IF;
END $$;

-- Step 5: Show current configuration
SELECT
  'Trigger: ' || tgname as info,
  'Enabled: ' || tgenabled as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE t.tgname = 'on_auth_user_created_profile'
  AND n.nspname = 'auth'
  AND c.relname = 'users';

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================
-- Run these after executing the above script to verify everything works

-- Check for orphaned profiles (should return 0)
-- SELECT COUNT(*) as orphaned_profiles
-- FROM public."0008-ap-users" ap
-- LEFT JOIN auth.users au ON ap.id = au.id
-- WHERE au.id IS NULL;

-- Check for users without profiles (should return 0)
-- SELECT COUNT(*) as users_without_profiles
-- FROM auth.users au
-- LEFT JOIN public."0008-ap-users" ap ON au.id = ap.id
-- WHERE ap.id IS NULL;

-- View recent signups to verify structure
-- SELECT
--   au.id,
--   au.email,
--   au.created_at as auth_created,
--   ap.created_at as profile_created,
--   ap.first_name,
--   ap.last_name,
--   ap.oauth_provider,
--   ap.last_login
-- FROM auth.users au
-- LEFT JOIN public."0008-ap-users" ap ON au.id = ap.id
-- ORDER BY au.created_at DESC
-- LIMIT 10;
