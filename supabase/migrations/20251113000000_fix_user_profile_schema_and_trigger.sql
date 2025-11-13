/*
  # Fix User Profile Schema and Trigger Function

  ## Problem
  The trigger function `handle_new_user_profile()` references columns that may not exist
  in the `0008-ap-users` table, causing signup failures with "Database error saving new user".

  ## Solution
  1. Add all missing columns that the trigger function expects
  2. Update the trigger function with proper error handling
  3. Add SECURITY DEFINER to bypass RLS during profile creation

  ## Changes
  - Add missing columns: oauth_provider, oauth_provider_id, profile_image_source
  - Add missing columns: mission_text, vision_text, vision_timeframe, week_start_day
  - Update trigger function with comprehensive error handling and logging
  - Ensure trigger has SECURITY DEFINER to bypass RLS policies

  ## Security
  - No RLS changes needed - inherits existing policies
  - Trigger uses SECURITY DEFINER to bypass RLS during auto-creation
*/

-- Step 1: Add missing OAuth columns if they don't exist
DO $$
BEGIN
  -- Add oauth_provider column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'oauth_provider'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN oauth_provider text DEFAULT 'email';
    RAISE NOTICE 'Added oauth_provider column';
  END IF;

  -- Add oauth_provider_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'oauth_provider_id'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN oauth_provider_id text;
    RAISE NOTICE 'Added oauth_provider_id column';
  END IF;

  -- Add profile_image_source column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'profile_image_source'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN profile_image_source text DEFAULT 'default';
    RAISE NOTICE 'Added profile_image_source column';
  END IF;
END $$;

-- Step 2: Add missing North Star columns if they don't exist
DO $$
BEGIN
  -- Add mission_text column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'mission_text'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN mission_text text;
    RAISE NOTICE 'Added mission_text column';
  END IF;

  -- Add vision_text column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'vision_text'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN vision_text text;
    RAISE NOTICE 'Added vision_text column';
  END IF;

  -- Add vision_timeframe column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'vision_timeframe'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN vision_timeframe text DEFAULT '5_year';
    RAISE NOTICE 'Added vision_timeframe column';
  END IF;

  -- Add week_start_day column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'week_start_day'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN week_start_day text DEFAULT 'sunday';
    RAISE NOTICE 'Added week_start_day column';
  END IF;
END $$;

-- Step 3: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON "0008-ap-users"(oauth_provider);
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_id ON "0008-ap-users"(oauth_provider_id);

-- Step 4: Drop and recreate the trigger function with comprehensive error handling
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_profile();

CREATE OR REPLACE FUNCTION handle_new_user_profile()
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
  IF EXISTS (SELECT 1 FROM "0008-ap-users" WHERE user_id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine OAuth provider
  BEGIN
    SELECT provider, provider_id INTO v_oauth_provider, v_oauth_provider_id
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
    INSERT INTO "0008-ap-users" (
      user_id,
      first_name,
      last_name,
      profile_image,
      oauth_provider,
      oauth_provider_id,
      profile_image_source
    )
    VALUES (
      NEW.id,
      v_first_name,
      v_last_name,
      v_profile_image,
      v_oauth_provider,
      v_oauth_provider_id,
      v_profile_image_source
    );

    RAISE NOTICE 'Successfully created profile for user: %', NEW.id;
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

-- Step 5: Create the trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Step 6: Verify the setup
DO $$
BEGIN
  RAISE NOTICE '=== User Profile System Status ===';
  RAISE NOTICE 'Trigger function created: handle_new_user_profile()';
  RAISE NOTICE 'Trigger attached: on_auth_user_created_profile';
  RAISE NOTICE 'Table: 0008-ap-users';
  RAISE NOTICE 'All required columns have been added';
  RAISE NOTICE 'Setup complete!';
END $$;
