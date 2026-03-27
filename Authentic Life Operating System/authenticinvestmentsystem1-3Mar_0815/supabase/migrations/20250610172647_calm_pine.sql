-- Migration: calm_pine (recovered from remote)
-- Originally applied: 2025-06-10
-- Adds unique constraint on user_id for onboarding responses

ALTER TABLE "0007-ap-onboarding_responses"
ADD CONSTRAINT unique_onboarding_responses_user_id UNIQUE (user_id);
