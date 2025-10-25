/*
  # Enforce Role Requirement for Key Relationships

  1. Changes
    - Add NOT NULL constraint to role_id column in key_relationships table
    - This ensures every Key Relationship MUST be associated with a specific role
    - Prevents orphaned KRs that could appear across multiple roles

  2. Security Impact
    - Strengthens data integrity
    - Ensures role-specific scoping is always enforced at the database level
    - Prevents bugs where KRs appear in incorrect role contexts

  3. Notes
    - This is a defensive constraint to prevent future bugs
    - All existing KRs already have valid role_id values (verified earlier)
*/

-- Add NOT NULL constraint to role_id if it doesn't already exist
DO $$
BEGIN
  -- Check if the constraint already exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = '0008-ap-key-relationships' 
    AND column_name = 'role_id'
    AND is_nullable = 'YES'
  ) THEN
    -- Make role_id NOT NULL
    ALTER TABLE "0008-ap-key-relationships" 
    ALTER COLUMN role_id SET NOT NULL;
    
    RAISE NOTICE 'Added NOT NULL constraint to role_id column';
  ELSE
    RAISE NOTICE 'role_id column already has NOT NULL constraint';
  END IF;
END $$;

-- Add check constraint to ensure role_id references a valid role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_key_relationship_valid_role'
  ) THEN
    ALTER TABLE "0008-ap-key-relationships"
    ADD CONSTRAINT chk_key_relationship_valid_role
    CHECK (role_id IS NOT NULL);
    
    RAISE NOTICE 'Added check constraint for valid role_id';
  ELSE
    RAISE NOTICE 'Check constraint already exists';
  END IF;
END $$;