/*
  # Preserve Manual Profile Images in Auth Trigger

  ## Problem
  The auth trigger currently overwrites profile images every time a user signs in,
  replacing manually uploaded images with OAuth images.

  ## Changes
  1. Update the handle_new_user_profile() trigger to check profile_image_source
  2. Only overwrite profile_image if current source is 'oauth' or 'default'
  3. Preserve manually uploaded images (profile_image_source = 'manual')
  4. Still use OAuth images for initial signup if available

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS (necessary for auth flow)
  - Only operates on the user's own record (NEW.id)
  - No privilege escalation possible
*/

-- Update the trigger function to preserve manual profile images
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
  v_full_name text;
  v_oauth_provider_id text;
  v_existing_image_source text;
BEGIN
  -- Explicitly set role to bypass RLS during trigger execution
  PERFORM set_config('role', 'postgres', true);
  
  BEGIN
    -- Check if user already has a manually uploaded image
    SELECT profile_image_source INTO v_existing_image_source
    FROM "0008-ap-users"
    WHERE id = NEW.id;

    -- Determine OAuth provider
    IF EXISTS (
      SELECT 1 FROM auth.identities 
      WHERE user_id = NEW.id AND provider != 'email'
    ) THEN
      SELECT provider, id INTO v_oauth_provider, v_oauth_provider_id
      FROM auth.identities
      WHERE user_id = NEW.id AND provider != 'email'
      LIMIT 1;
    ELSE
      v_oauth_provider := 'email';
      v_oauth_provider_id := NULL;
    END IF;

    -- Extract profile image from OAuth metadata
    v_profile_image := COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    );

    -- Only use OAuth image if:
    -- 1. We have an OAuth image, AND
    -- 2. Either no existing profile exists, OR existing image is not manual
    IF v_profile_image IS NOT NULL AND (v_existing_image_source IS NULL OR v_existing_image_source != 'manual') THEN
      v_profile_image_source := 'oauth';
    ELSIF v_existing_image_source = 'manual' THEN
      -- Preserve the existing manual image
      v_profile_image_source := 'manual';
      v_profile_image := NULL; -- Don't overwrite
    ELSE
      v_profile_image_source := 'default';
      v_profile_image := NULL;
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
        v_first_name := COALESCE(split_part(v_full_name, ' ', 1), '');
        IF position(' ' in v_full_name) > 0 THEN
          v_last_name := COALESCE(substring(v_full_name from position(' ' in v_full_name) + 1), '');
        END IF;
      END IF;
    END IF;

    -- Insert or update the user profile
    INSERT INTO "0008-ap-users" (
      id,
      email,
      first_name,
      last_name,
      profile_image,
      oauth_provider,
      oauth_provider_id,
      profile_image_source,
      last_login
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
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
      first_name = COALESCE(EXCLUDED.first_name, "0008-ap-users".first_name),
      last_name = COALESCE(EXCLUDED.last_name, "0008-ap-users".last_name),
      -- Only update profile_image if we have a new OAuth image AND current is not manual
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

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth - critical for preventing 500 errors
    RAISE WARNING 'Error in handle_new_user_profile for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
