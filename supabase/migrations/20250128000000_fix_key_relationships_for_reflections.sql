/*
  # Fix Key Relationships for Reflections
  
  1. Issue
     - Key relationships cannot be saved for reflections
     - Foreign key constraint references non-existent 0008-ap-parents table
     - Trigger may be blocking reflection parent_type
  
  2. Fix
     - Drop the problematic fk_keyrels_parent foreign key constraint
     - Drop the trg_validate_universal_key_relationships_parent trigger
     - Ensure CHECK constraint includes 'reflection' parent_type
     - Verify RLS policies allow reflection associations
  
  3. Security
     - RLS policies remain active
     - Users can only manage their own key relationship associations
*/

-- Drop the foreign key constraint that references 0008-ap-parents table
ALTER TABLE "0008-ap-universal-key-relationships-join" 
  DROP CONSTRAINT IF EXISTS fk_keyrels_parent;

-- Drop the validation trigger if it exists
DROP TRIGGER IF EXISTS trg_validate_universal_key_relationships_parent 
  ON "0008-ap-universal-key-relationships-join";

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS validate_universal_key_relationships_parent();

-- Ensure the CHECK constraint includes reflection
-- First drop the existing constraint
ALTER TABLE "0008-ap-universal-key-relationships-join"
  DROP CONSTRAINT IF EXISTS "0008-ap-universal-key-relationships-join_parent_type_check";

-- Add the updated CHECK constraint with all parent types
ALTER TABLE "0008-ap-universal-key-relationships-join"
  ADD CONSTRAINT "0008-ap-universal-key-relationships-join_parent_type_check"
  CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', '1y_goal', 'reflection'));

-- Ensure user_id column exists (it should based on your schema)
-- This is just a safety check
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = '0008-ap-universal-key-relationships-join' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "0008-ap-universal-key-relationships-join"
      ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update RLS policies to ensure they work with reflections
-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their KR joins" ON "0008-ap-universal-key-relationships-join";

-- Create comprehensive RLS policies
CREATE POLICY "Users can select their KR joins" 
  ON "0008-ap-universal-key-relationships-join"
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their KR joins" 
  ON "0008-ap-universal-key-relationships-join"
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their KR joins" 
  ON "0008-ap-universal-key-relationships-join"
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their KR joins" 
  ON "0008-ap-universal-key-relationships-join"
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_kr_join_user_id 
  ON "0008-ap-universal-key-relationships-join"(user_id);

CREATE INDEX IF NOT EXISTS idx_kr_join_parent 
  ON "0008-ap-universal-key-relationships-join"(parent_type, parent_id);

CREATE INDEX IF NOT EXISTS idx_kr_join_key_rel 
  ON "0008-ap-universal-key-relationships-join"(key_relationship_id);

-- Ensure unique constraint exists to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_kr_join_unique 
  ON "0008-ap-universal-key-relationships-join"(parent_id, parent_type, key_relationship_id);

-- Verify the fix with a comment
COMMENT ON TABLE "0008-ap-universal-key-relationships-join" IS 
  'Universal join table for key relationships. Supports parent_types: task, depositIdea, withdrawal, goal, custom_goal, 1y_goal, reflection. No dependency on 0008-ap-parents table.';
