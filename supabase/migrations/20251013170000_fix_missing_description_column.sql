-- Add missing description column to global-cycles table if it doesn't exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles' AND column_name = 'description'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
    ADD COLUMN description TEXT;
    
    RAISE NOTICE 'Added description column to 0008-ap-global-cycles';
  ELSE
    RAISE NOTICE 'description column already exists in 0008-ap-global-cycles';
  END IF;
END $$;
