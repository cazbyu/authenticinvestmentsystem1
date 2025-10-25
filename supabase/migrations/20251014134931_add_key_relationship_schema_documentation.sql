/*
  # Add Schema Documentation for Key Relationships

  1. Purpose
    - Add table and column comments to clarify the role-KR relationship
    - Helps future developers understand the scoping rules

  2. Documentation
    - Table comment explains the purpose and scoping of key relationships
    - role_id comment emphasizes its critical role in scoping
*/

-- Add table comment
COMMENT ON TABLE "0008-ap-key-relationships" IS 
'Key Relationships represent important people in the user''s life, scoped by role. 
Examples: Children under "Father" role, Spouse under "Husband" role, Boss under "Employee" role.
Each KR MUST be permanently associated with exactly one role via role_id.';

-- Add column comments
COMMENT ON COLUMN "0008-ap-key-relationships".role_id IS 
'CRITICAL: Links this key relationship to a specific role. This scoping ensures that:
- Children appear only under "Father" role
- Spouse appears only under "Husband" role
- Boss appears only under "Employee" role
Once set, this association is permanent and should not be changed.';

COMMENT ON COLUMN "0008-ap-key-relationships".name IS 
'Display name for this key relationship (e.g., "John", "Sarah", "Mom")';

COMMENT ON COLUMN "0008-ap-key-relationships".description IS 
'Optional notes about this relationship';

COMMENT ON COLUMN "0008-ap-key-relationships".image_path IS 
'Path to profile image in Supabase storage bucket: 0008-key-relationship-images';