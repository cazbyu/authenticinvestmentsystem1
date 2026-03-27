-- Migration: sweet_star (recovered from remote)
-- Originally applied: 2025-06-10
-- Renames onboarding tables to 0007-ap- prefix and reconfigures RLS

-- Function to safely create policies only if they don't exist
CREATE OR REPLACE FUNCTION create_policy_if_not_exists(
  policy_name TEXT,
  table_name TEXT,
  policy_sql TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = table_name
    AND policyname = policy_name
  ) THEN
    EXECUTE policy_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Main migration logic
DO $$
BEGIN
  -- Check if onboarding_responses exists and rename it
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'onboarding_responses' AND table_schema = 'public') THEN
    -- Drop policies on old table first
    DROP POLICY IF EXISTS "Users can read own onboarding responses" ON onboarding_responses;
    DROP POLICY IF EXISTS "Users can insert own onboarding responses" ON onboarding_responses;
    DROP POLICY IF EXISTS "Users can update own onboarding responses" ON onboarding_responses;

    -- Drop triggers on old table
    DROP TRIGGER IF EXISTS update_onboarding_responses_updated_at ON onboarding_responses;

    -- Rename the table
    ALTER TABLE onboarding_responses RENAME TO "0007-ap-onboarding-responses";

    RAISE NOTICE 'Renamed onboarding_responses to 0007-ap-onboarding-responses';
  ELSE
    RAISE NOTICE 'Table onboarding_responses does not exist - likely already renamed';
  END IF;

  -- Check if onboarding_goals exists and rename it
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'onboarding_goals' AND table_schema = 'public') THEN
    -- Drop policies on old table first
    DROP POLICY IF EXISTS "Users can read own onboarding goals" ON onboarding_goals;
    DROP POLICY IF EXISTS "Users can insert own onboarding goals" ON onboarding_goals;
    DROP POLICY IF EXISTS "Users can update own onboarding goals" ON onboarding_goals;
    DROP POLICY IF EXISTS "Users can delete own onboarding goals" ON onboarding_goals;

    -- Drop triggers on old table
    DROP TRIGGER IF EXISTS update_onboarding_goals_updated_at ON onboarding_goals;

    -- Rename the table
    ALTER TABLE onboarding_goals RENAME TO "0007-ap-onboarding-goals";

    RAISE NOTICE 'Renamed onboarding_goals to 0007-ap-onboarding-goals';
  ELSE
    RAISE NOTICE 'Table onboarding_goals does not exist - likely already renamed';
  END IF;
END $$;

-- Ensure the correctly named tables have proper configuration
DO $$
BEGIN
  -- Configure 0007-ap-onboarding-responses if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '0007-ap-onboarding-responses' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE "0007-ap-onboarding-responses" ENABLE ROW LEVEL SECURITY;

    -- Create policies using our helper function
    PERFORM create_policy_if_not_exists(
      'Users can read own onboarding responses',
      '0007-ap-onboarding-responses',
      'CREATE POLICY "Users can read own onboarding responses" ON "0007-ap-onboarding-responses" FOR SELECT TO authenticated USING (auth.uid() = user_id)'
    );

    PERFORM create_policy_if_not_exists(
      'Users can insert own onboarding responses',
      '0007-ap-onboarding-responses',
      'CREATE POLICY "Users can insert own onboarding responses" ON "0007-ap-onboarding-responses" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)'
    );

    PERFORM create_policy_if_not_exists(
      'Users can update own onboarding responses',
      '0007-ap-onboarding-responses',
      'CREATE POLICY "Users can update own onboarding responses" ON "0007-ap-onboarding-responses" FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)'
    );

    -- Create trigger if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'update_0007_ap_onboarding_responses_updated_at'
      AND event_object_table = '0007-ap-onboarding-responses'
    ) THEN
      CREATE TRIGGER update_0007_ap_onboarding_responses_updated_at
        BEFORE UPDATE ON "0007-ap-onboarding-responses"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    RAISE NOTICE 'Configured policies and triggers for 0007-ap-onboarding-responses';
  END IF;

  -- Configure 0007-ap-onboarding-goals if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '0007-ap-onboarding-goals' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE "0007-ap-onboarding-goals" ENABLE ROW LEVEL SECURITY;

    -- Create policies using our helper function
    PERFORM create_policy_if_not_exists(
      'Users can read own onboarding goals',
      '0007-ap-onboarding-goals',
      'CREATE POLICY "Users can read own onboarding goals" ON "0007-ap-onboarding-goals" FOR SELECT TO authenticated USING (auth.uid() = user_id)'
    );

    PERFORM create_policy_if_not_exists(
      'Users can insert own onboarding goals',
      '0007-ap-onboarding-goals',
      'CREATE POLICY "Users can insert own onboarding goals" ON "0007-ap-onboarding-goals" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)'
    );

    PERFORM create_policy_if_not_exists(
      'Users can update own onboarding goals',
      '0007-ap-onboarding-goals',
      'CREATE POLICY "Users can update own onboarding goals" ON "0007-ap-onboarding-goals" FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)'
    );

    PERFORM create_policy_if_not_exists(
      'Users can delete own onboarding goals',
      '0007-ap-onboarding-goals',
      'CREATE POLICY "Users can delete own onboarding goals" ON "0007-ap-onboarding-goals" FOR DELETE TO authenticated USING (auth.uid() = user_id)'
    );

    -- Create trigger if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'update_0007_ap_onboarding_goals_updated_at'
      AND event_object_table = '0007-ap-onboarding-goals'
    ) THEN
      CREATE TRIGGER update_0007_ap_onboarding_goals_updated_at
        BEFORE UPDATE ON "0007-ap-onboarding-goals"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    RAISE NOTICE 'Configured policies and triggers for 0007-ap-onboarding-goals';
  END IF;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS create_policy_if_not_exists(TEXT, TEXT, TEXT);
