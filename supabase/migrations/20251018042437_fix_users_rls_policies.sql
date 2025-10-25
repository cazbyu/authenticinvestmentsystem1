/*
  # Fix RLS Policies for 0008-ap-users Table

  ## Problem
  The existing RLS policies reference a non-existent 'user_id' column.
  The actual table schema uses 'id' as the primary key that directly references auth.users(id).
  This mismatch causes all INSERT and UPDATE operations to fail due to RLS policy violations.

  ## Changes
  1. Drop all existing RLS policies that reference 'user_id'
  2. Create new RLS policies that correctly use 'id' column
  3. Add policies for SELECT, INSERT, UPDATE, and DELETE operations
  4. Ensure authenticated users can manage their own profile records

  ## Security
  - Users can only access their own profile (where auth.uid() = id)
  - All operations require authentication
  - No privilege escalation possible
*/

-- Drop existing policies that reference the wrong column
DROP POLICY IF EXISTS "Users can select their own profile" ON "0008-ap-users";
DROP POLICY IF EXISTS "Users can insert their own profile" ON "0008-ap-users";
DROP POLICY IF EXISTS "Users can update their own profile" ON "0008-ap-users";
DROP POLICY IF EXISTS "Users can delete their own profile" ON "0008-ap-users";

-- Create correct RLS policies using 'id' column
CREATE POLICY "Users can select their own profile" ON "0008-ap-users"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON "0008-ap-users"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON "0008-ap-users"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" ON "0008-ap-users"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
