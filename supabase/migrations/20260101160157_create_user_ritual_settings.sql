/*
  # Create User Ritual Settings Table

  1. New Tables
    - `0008-ap-user-ritual-settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `ritual_type` (text, enum: 'morning_spark', 'evening_review', 'weekly_alignment')
      - `is_enabled` (boolean, default true)
      - `available_from` (time, start of availability window)
      - `available_until` (time, end of availability window)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `0008-ap-user-ritual-settings` table
    - Add policies for authenticated users to:
      - Read their own ritual settings
      - Insert their own ritual settings
      - Update their own ritual settings

  3. Constraints
    - Unique constraint on (user_id, ritual_type) to ensure one setting per ritual per user
    - Check constraint on ritual_type to ensure valid values
    - Default time windows for each ritual type

  4. Initial Data
    - Seed default ritual settings for existing users
*/

-- Create user ritual settings table
CREATE TABLE IF NOT EXISTS "0008-ap-user-ritual-settings" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ritual_type text NOT NULL CHECK (ritual_type IN ('morning_spark', 'evening_review', 'weekly_alignment')),
  is_enabled boolean NOT NULL DEFAULT true,
  available_from time NOT NULL DEFAULT '00:00:00',
  available_until time NOT NULL DEFAULT '23:59:59',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure only one setting per ritual type per user
  UNIQUE(user_id, ritual_type)
);

-- Enable Row Level Security
ALTER TABLE "0008-ap-user-ritual-settings" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own ritual settings
CREATE POLICY "Users can read own ritual settings"
  ON "0008-ap-user-ritual-settings"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own ritual settings
CREATE POLICY "Users can insert own ritual settings"
  ON "0008-ap-user-ritual-settings"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own ritual settings
CREATE POLICY "Users can update own ritual settings"
  ON "0008-ap-user-ritual-settings"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_ritual_settings_user_id
  ON "0008-ap-user-ritual-settings"(user_id);

CREATE INDEX IF NOT EXISTS idx_user_ritual_settings_user_ritual
  ON "0008-ap-user-ritual-settings"(user_id, ritual_type);

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_ritual_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to ritual settings table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_ritual_settings_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_ritual_settings_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-user-ritual-settings"
          FOR EACH ROW
          EXECUTE FUNCTION update_ritual_settings_updated_at();
    END IF;
END $$;

-- Function to initialize default ritual settings for a user
CREATE OR REPLACE FUNCTION initialize_user_ritual_settings(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Morning Spark: Available midnight to noon
  INSERT INTO "0008-ap-user-ritual-settings" (user_id, ritual_type, is_enabled, available_from, available_until)
  VALUES (p_user_id, 'morning_spark', true, '00:00:00', '12:00:00')
  ON CONFLICT (user_id, ritual_type) DO NOTHING;

  -- Evening Review: Available 5 PM to midnight
  INSERT INTO "0008-ap-user-ritual-settings" (user_id, ritual_type, is_enabled, available_from, available_until)
  VALUES (p_user_id, 'evening_review', true, '17:00:00', '23:59:59')
  ON CONFLICT (user_id, ritual_type) DO NOTHING;

  -- Weekly Alignment: Available all day Saturday-Sunday
  INSERT INTO "0008-ap-user-ritual-settings" (user_id, ritual_type, is_enabled, available_from, available_until)
  VALUES (p_user_id, 'weekly_alignment', true, '00:00:00', '23:59:59')
  ON CONFLICT (user_id, ritual_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize ritual settings for all existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    PERFORM initialize_user_ritual_settings(user_record.id);
  END LOOP;
END $$;