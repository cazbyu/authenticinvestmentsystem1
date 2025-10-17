/*
  # Add Last Login Tracking to User Profile

  1. Schema Changes
     - Add `last_login` column to `0008-ap-users` table
     - Column will track the last time user authenticated

  2. Trigger Setup
     - Update the `handle_new_user_profile` trigger to set last_login on profile creation
     - Create new function to update last_login on every authentication
     - Add trigger on auth.users table to track sign-ins

  3. Important Notes
     - last_login is automatically updated whenever user signs in
     - Tracks both email/password and OAuth authentication
     - Uses SECURITY DEFINER to ensure trigger has permission to update user profiles
*/

-- Add last_login column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- Update the handle_new_user_profile function to also set last_login
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "0008-ap-users" (user_id, first_name, last_name, last_login)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
      first_name = COALESCE(EXCLUDED.first_name, "0008-ap-users".first_name),
      last_name = COALESCE(EXCLUDED.last_name, "0008-ap-users".last_name),
      last_login = now();
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create function to update last_login on sign-in
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_login whenever last_sign_in_at changes
    IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
        UPDATE "0008-ap-users"
        SET last_login = NEW.last_sign_in_at
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger to track user sign-ins
DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
    EXECUTE FUNCTION update_user_last_login();
