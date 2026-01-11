/*
  # Allow Daily Spark Deletion

  1. Changes
    - Add DELETE policy to `0008-ap-daily-sparks` table
    - Allow users to delete their own daily sparks (for dev/testing purposes)

  2. Security
    - Users can only delete their own sparks
*/

-- Policy: Users can delete their own daily sparks
CREATE POLICY "Users can delete own daily sparks"
  ON "0008-ap-daily-sparks"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
