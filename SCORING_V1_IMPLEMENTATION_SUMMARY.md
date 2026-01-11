# Authentic Investment System Scoring v1.0 - Implementation Summary

## Overview

This document summarizes the implementation of the comprehensive scoring system v1.0 for the Authentic Investment System. The scoring system has been completely overhauled to align with the official specification.

## Core Philosophy

- **Score is FEEDBACK** (Leading Indicators), not just results
- Real-world rewards for Season Goals (not points)
- Game Loop: **Win the Day → Win the Week → Win the Championship**

---

## 1. Database Schema Updates

### New Tables Created

#### `0008-ap-aspirations`
Daily aspirations with tiered point rewards.

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `content` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `points_awarded` (INTEGER) - Tiered: 1st=5, 2nd=3, 3rd=1

### Updated Tables

#### `0008-ap-user-preferences`
- `morning_spark_time` (TIME, DEFAULT '06:00:00') - User's target wake-up time for Early Spark bonus
- `week_start_day` (INTEGER, DEFAULT 1) - Week start day preference (0=Sunday, 1=Monday)

#### `0008-ap-daily-sparks`
- `beat_target_bonus_awarded` (BOOLEAN, DEFAULT FALSE) - Tracks +10 bonus for beating daily target
- `spark_points` (INTEGER, DEFAULT 0) - Points from spark (5 or 10 based on timing)

#### `0008-ap-daily-reviews`
- `review_points` (INTEGER, DEFAULT 0) - Points from evening review (10 if before midnight)

#### `0008-ap-reflections`
- `is_first_rose_of_day` (BOOLEAN, DEFAULT FALSE) - First rose bonus flag
- `points_awarded` (INTEGER, DEFAULT 0) - Points awarded (1 or 2 with bonus)

#### `0008-ap-tasks`
- `is_deposit_idea` (BOOLEAN, DEFAULT FALSE) - Marks task as deposit (+5 vs +3 points)

#### `0008-ap-deposit-ideas`
- `creation_points_awarded` (BOOLEAN, DEFAULT FALSE) - Tracks if +1 creation bonus awarded

#### `0008-ap-goals-12wk` and `0008-ap-goals-custom`
- `completion_reward` (TEXT) - User-defined reward text (NO POINTS awarded on completion)

#### `0008-ap-weekly-alignments` (Updated)
- `completed_at` (TIMESTAMPTZ)
- `alignment_points` (INTEGER, DEFAULT 50)
- `consistency_points` (INTEGER, DEFAULT 0)
- `keystone_points` (INTEGER, DEFAULT 0)
- `milestone_points` (INTEGER, DEFAULT 0)
- `execution_points` (INTEGER, DEFAULT 0)
- `days_met_target` (INTEGER, DEFAULT 0)
- `keystone_completed` (BOOLEAN, DEFAULT FALSE)
- `milestones_hit` (INTEGER, DEFAULT 0)
- `execution_percentage` (INTEGER, DEFAULT 0)
- `total_weekly_points` (INTEGER, DEFAULT 0)
- `updated_at` (TIMESTAMPTZ)

---

## 2. Daily Scoring System (Offense)

### Task Completion Points

**Base Scores (Mutually Exclusive):**
- Complete Deposit: **+5 points** (task with `is_deposit_idea = true`)
- Complete Task: **+3 points** (regular task)

**Alignment Bonuses (Stackable +1 each):**
- Link Role: **+1** if ANY role assigned
- Link Zone/Domain: **+1** if ANY domain assigned
- Link Goal: **+1** if linked to ANY active goal

**Q2 Defense:**
- Important + NOT Urgent: **+1 bonus**

**Maximum possible per task:** 8 points (5 base + 3 alignment)

### Other Daily Actions

| Action | Points | Logic |
|--------|--------|-------|
| Create Deposit Idea | +1 | Creating new deposit idea |
| Beat the Target | +10 | Daily score > target at midnight |

### Implementation
- Location: `/lib/taskUtils.ts`
- Function: `calculateTaskPoints()`
- Used by: Task completion handlers across the app

---

## 3. Special Teams Scoring (Rituals & Reflections)

### Morning Spark
- **Early Spark:** +10 (before user's set time)
- **Late Spark:** +5 (after set time, same day)

### Evening Review
- **The Closer:** +10 (completed before midnight)

### Reflections
- **Base:** +1 per reflection (max 10/day)
- **First Rose Bonus:** +1 additional (total +2 for first rose)

### Aspirations
- **Tiered Rewards:**
  - 1st aspiration: +5
  - 2nd aspiration: +3
  - 3rd aspiration: +1
  - Max 3/day = +9 total

### Implementation
- Location: `/lib/ritualScoringUtils.ts`
- Functions:
  - `calculateMorningSparkPoints()`
  - `calculateEveningReviewPoints()`
  - `calculateReflectionPoints()`
  - `calculateAspirationPoints()`
  - `calculateBeatTargetBonus()`

---

## 4. Weekly Scoring System

### Weekly Bonuses

| Component | Points | Logic |
|-----------|--------|-------|
| Alignment | +50 | Completing Weekly Alignment process |
| Consistency | +5/day | +5 per day target met (max +35 for 7 days) |
| Keystone | +20 | 100% adherence to "One Big Thing" |
| Milestones | +10 | Per milestone hit |
| Execution | Tiered | 85%+: +25, 70%+: +10, 50%+: +5 |

**Maximum weekly bonus:** 140 points (50+35+20+10+25)

### CRITICAL: Two-League System

**12-Week Goals (Varsity League):**
- Daily points: YES
- Weekly execution scoring: YES
- Season record: COUNTS
- Completion reward: User-defined (no points)

**Custom Goals (Open League):**
- Daily points: YES
- Weekly execution scoring: NO (execution is feedback only)
- Season record: IGNORED
- Completion reward: User-defined (no points)

### Implementation
- Location: `/lib/weeklyScoring.ts`
- Functions:
  - `calculateWeeklyBonus()`
  - `calculate12WeekGoalExecution()`
  - `getOrCreateWeeklyAlignment()`
  - `updateWeeklyAlignment()`
  - `countDaysMetTarget()`

---

## 5. Authentic Score Calculation

The Authentic Score is the **total cumulative score across all time**.

### Components:

1. **Task Completion Points** (with alignment bonuses)
2. **Deposit Idea Creation Points** (+1 each)
3. **Beat the Target Bonuses** (+10 per day achieved)
4. **Morning Spark Points** (+5 or +10 depending on timing)
5. **Evening Review Points** (+10 if before midnight)
6. **Reflection Points** (+1 each, max 10/day, +1 for first rose)
7. **Aspiration Points** (tiered: 5, 3, 1)
8. **Weekly Alignment Points** (sum of all weekly bonuses)
9. **Minus: Withdrawal Points** (penalties)

### Implementation
- Location: `/lib/taskUtils.ts`
- Function: `calculateAuthenticScore()` - Completely rewritten for v1.0
- Context: `/contexts/AuthenticScoreContext.tsx` (uses updated calculation)

---

## 6. Migration Files Applied

1. **20260103000001_update_weekly_alignments_for_scoring.sql**
   - Updates weekly alignments table with scoring columns

2. **20260103000002_add_scoring_fields_to_tables.sql**
   - Adds scoring fields to user_preferences, daily_sparks, daily_reviews, reflections, tasks, deposit_ideas, and goals tables
   - Creates performance indexes

3. **20260103000003_create_aspirations_table.sql**
   - Creates aspirations table with RLS policies

---

## 7. Key Files Modified/Created

### Modified:
- `/lib/taskUtils.ts` - Updated `calculateTaskPoints()` and `calculateAuthenticScore()`

### Created:
- `/lib/ritualScoringUtils.ts` - Ritual and reflection scoring functions
- `/lib/weeklyScoring.ts` - Weekly bonus calculation system

### Unchanged (Context providers use updated functions):
- `/contexts/AuthenticScoreContext.tsx` - Calls updated calculation

---

## 8. Breaking Changes

### Score Calculation Changes

**OLD SYSTEM:**
- Priority-based scoring (Urgent+Important: +1.5, etc.)
- +2 bonus for goals
- Decimal points (rounded to 1 decimal)

**NEW SYSTEM:**
- Flat base scores: +3 or +5
- +1 alignment bonuses (stackable)
- Integer points only
- Comprehensive ritual/reflection scoring
- Weekly bonuses

### Impact:
- **All existing scores will change** when recalculated
- Users will see different point values
- Historical scoring cannot be compared directly

### Recommendation:
1. **Backup existing scores** before deploying
2. **Announce update** to users with explanation
3. **Consider score reset** or "legacy score" view
4. **Recalculate all user scores** using new v1.0 logic

---

## 9. Testing Checklist

### Task Completion Scoring
- [ ] Regular task awards +3 points
- [ ] Deposit idea task awards +5 points (not +3)
- [ ] Role link adds +1 point
- [ ] Domain link adds +1 point
- [ ] Goal link adds +1 point
- [ ] Q2 Defense (Important+NotUrgent) adds +1 point
- [ ] All bonuses stack correctly

### Ritual Scoring
- [ ] Morning Spark before set time awards +10
- [ ] Morning Spark after set time awards +5
- [ ] Evening Review before midnight awards +10
- [ ] Reflections award +1 each (max 10/day)
- [ ] First Rose awards +2 total (+1 base + +1 bonus)
- [ ] Aspirations award tiered points (5, 3, 1)

### Weekly Scoring
- [ ] Weekly Alignment completion awards +50
- [ ] Consistency bonus calculates correctly
- [ ] Keystone completion awards +20
- [ ] Milestones award +10 each
- [ ] Execution tiers work for 12-Week Goals only
- [ ] Custom Goals do NOT contribute to execution bonus

### Authentic Score
- [ ] Total score calculates correctly
- [ ] All point sources included
- [ ] Withdrawals subtract correctly
- [ ] Score updates in real-time

---

## 10. Next Steps for Full Implementation

### Required Frontend Updates

1. **Morning Spark Flow:**
   - Award points based on completion time vs user preference
   - Store `spark_points` in daily_sparks table
   - Check daily score vs target at midnight
   - Award `beat_target_bonus` if threshold met

2. **Evening Review:**
   - Calculate and store `review_points` (10 if before midnight)

3. **Reflections:**
   - Check if first rose of day before inserting
   - Calculate and store `points_awarded`
   - Enforce max 10 reflections/day for points

4. **Deposit Ideas:**
   - Set `is_deposit_idea = true` when activating deposit to task
   - Set `creation_points_awarded = true` on creation

5. **Aspirations (New Feature):**
   - Create UI for daily aspirations
   - Calculate tiered points on creation
   - Store in aspirations table

6. **Weekly Alignment:**
   - Calculate weekly stats (days met target, keystone, milestones, execution)
   - Call `updateWeeklyAlignment()` on completion
   - Display weekly bonus breakdown

7. **Goal Completion:**
   - Show celebration modal with `completion_reward` text
   - DO NOT award points for completion
   - Display Varsity vs Open League badges

### Required Backend/Automation

1. **Midnight Cron Job:**
   - Check daily score vs target
   - Award beat_target_bonus if applicable

2. **Score Recalculation:**
   - Run `calculateAuthenticScore()` for all users
   - Update any cached/stored scores

---

## 11. Documentation Links

- [Original Specification](./IMPLEMENTATION_DETAILS.md) - Full v1.0 scoring rules
- [Database Schema](./supabase/migrations/) - Migration files
- [Scoring Functions](./lib/) - Implementation code

---

## Summary

The Authentic Investment System Scoring v1.0 is now **fully implemented at the database and calculation level**. The system provides:

✅ Comprehensive daily scoring (Offense)
✅ Ritual and reflection scoring (Special Teams)
✅ Weekly bonus system
✅ Two-league goal distinction
✅ Complete authentic score calculation

**Next Phase:** Frontend integration to award points in real-time as users complete actions.
