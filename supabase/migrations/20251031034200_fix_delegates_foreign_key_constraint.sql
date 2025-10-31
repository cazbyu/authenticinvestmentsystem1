/*
  # Fix Delegates Foreign Key Constraint

  1. Changes
    - Drop incorrect foreign key constraint on universal-delegates-join that references auth.users
    - Add correct foreign key constraint to reference 0008-ap-delegates(id)
    - Ensure RLS policies are properly configured for delegates table

  2. Security
    - Add RLS policies for 0008-ap-delegates table if not already present
    - Users can only access their own delegate records

  3. Notes
    - This aligns the delegates join table with the same pattern used by roles, domains, key relationships, and notes
    - delegate_id should reference 0008-ap-delegates(id), not auth.users(id)
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE "0008-ap-universal-delegates-join" 
  DROP CONSTRAINT IF EXISTS "0008-ap-universal-delegates-join_delegate_id_fkey";

-- Add the correct foreign key constraint pointing to 0008-ap-delegates
ALTER TABLE "0008-ap-universal-delegates-join"
  ADD CONSTRAINT "0008-ap-universal-delegates-join_delegate_id_fkey" 
  FOREIGN KEY (delegate_id) 
  REFERENCES "0008-ap-delegates"(id) 
  ON DELETE CASCADE;

-- Ensure RLS is enabled on delegates table
ALTER TABLE "0008-ap-delegates" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for delegates table if they don't exist
DO $$ 
BEGIN
  -- Check if policies exist before creating them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '0008-ap-delegates' 
    AND policyname = 'Users can select their own delegates'
  ) THEN
    CREATE POLICY "Users can select their own delegates" 
      ON "0008-ap-delegates"
      FOR SELECT 
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '0008-ap-delegates' 
    AND policyname = 'Users can insert their own delegates'
  ) THEN
    CREATE POLICY "Users can insert their own delegates" 
      ON "0008-ap-delegates"
      FOR INSERT 
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '0008-ap-delegates' 
    AND policyname = 'Users can update their own delegates'
  ) THEN
    CREATE POLICY "Users can update their own delegates" 
      ON "0008-ap-delegates"
      FOR UPDATE 
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '0008-ap-delegates' 
    AND policyname = 'Users can delete their own delegates'
  ) THEN
    CREATE POLICY "Users can delete their own delegates" 
      ON "0008-ap-delegates"
      FOR DELETE 
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add indexes for efficient querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_delegates_user_id 
  ON "0008-ap-delegates"(user_id);

CREATE INDEX IF NOT EXISTS idx_delegates_name 
  ON "0008-ap-delegates"(name);
