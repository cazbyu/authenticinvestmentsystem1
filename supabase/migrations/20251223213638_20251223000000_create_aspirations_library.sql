/*
  # Create Aspirations Library Table

  1. New Tables
    - `0008-ap-aspirations-library`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `aspiration_date` (date) - The date this aspiration was recorded
      - `aspiration_text` (text) - The aspiration content
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - When the record was last updated

  2. Security
    - Enable RLS on `0008-ap-aspirations-library` table
    - Add policies for authenticated users to manage their own aspirations

  3. Indexes
    - Index on user_id for efficient querying
    - Index on aspiration_date for sorting and filtering

  4. Functions
    - `fn_get_user_aspirations` - Paginated retrieval of user aspirations
*/

-- Create the aspirations library table
CREATE TABLE IF NOT EXISTS "0008-ap-aspirations-library" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aspiration_date date NOT NULL DEFAULT CURRENT_DATE,
  aspiration_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_aspirations_user_id
  ON "0008-ap-aspirations-library"(user_id);

CREATE INDEX IF NOT EXISTS idx_aspirations_date
  ON "0008-ap-aspirations-library"(aspiration_date DESC);

-- Enable RLS
ALTER TABLE "0008-ap-aspirations-library" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own aspirations
CREATE POLICY "Users can view own aspirations"
  ON "0008-ap-aspirations-library"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own aspirations
CREATE POLICY "Users can insert own aspirations"
  ON "0008-ap-aspirations-library"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own aspirations
CREATE POLICY "Users can update own aspirations"
  ON "0008-ap-aspirations-library"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own aspirations
CREATE POLICY "Users can delete own aspirations"
  ON "0008-ap-aspirations-library"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to get user aspirations with pagination
CREATE OR REPLACE FUNCTION fn_get_user_aspirations(
  p_user_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  aspiration_date date,
  aspiration_text text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.aspiration_date,
    a.aspiration_text,
    a.created_at,
    a.updated_at
  FROM "0008-ap-aspirations-library" a
  WHERE a.user_id = p_user_id
  ORDER BY a.aspiration_date DESC, a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_aspirations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_aspirations_timestamp
  BEFORE UPDATE ON "0008-ap-aspirations-library"
  FOR EACH ROW
  EXECUTE FUNCTION update_aspirations_updated_at();
