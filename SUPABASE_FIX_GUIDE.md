# Supabase View Fix Guide

## What This Fixes

1. **View column naming conflicts** - PostgreSQL cannot rename view columns through `CREATE OR REPLACE VIEW`
2. **Architecture alignment** - Ensures global-weeks pulls data from global-cycles
3. **User preferences** - Stores week_start_day (Sun/Mon) in user-global-timelines
4. **Duplicate migrations** - Identifies duplicate files to clean up

---

## Step-by-Step Instructions

### 1. Run the Fix Script in Supabase

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `FIX_SUPABASE_VIEWS.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

### 2. What the Script Does

The script will:
- ✅ Drop all conflicting views safely (CASCADE)
- ✅ Ensure `0008-ap-global-weeks` table exists
- ✅ Set up proper RLS policies
- ✅ Create `generate_canonical_global_weeks()` function
- ✅ Populate weeks from your existing global cycles
- ✅ Recreate all views with correct column names
- ✅ Update the activation function
- ✅ Show verification results

### 3. Expected Output

You should see output like:
```
NOTICE: Generated 12 canonical weeks for global_cycle_id <uuid>
NOTICE: Generated weeks for cycle: 2025 Q1 Cycle (2025-01-01 to 2025-03-26)
NOTICE: ============================================
NOTICE: VERIFICATION RESULTS:
NOTICE:   Global Cycles: 1
NOTICE:   Week Records: 12
NOTICE:   Expected: 12 (12 weeks per cycle)
NOTICE:   Active User Timelines: 0
NOTICE: ============================================
```

---

## Architecture Overview

```
0008-ap-global-cycles (master data)
  ├─ id, title, start_date, end_date
  └─> feeds into...

0008-ap-global-weeks (generated from cycles)
  ├─ global_cycle_id (FK to cycles)
  ├─ week_number (1-12)
  ├─ week_start, week_end (calculated from cycle dates)
  └─> 12 weeks per cycle

0008-ap-user-global-timelines (user activations)
  ├─ user_id, global_cycle_id
  ├─ week_start_day ('sunday' or 'monday') ← USER PREFERENCE
  └─> joins with global-weeks via global_cycle_id

v_user_global_timeline_weeks (view)
  └─> Combines: user timelines + cycles + weeks
  └─> Returns: timeline_id, week_number, week_start, week_end, week_start_day
```

---

## How Week Preferences Work

1. **Weeks are canonical** - All users see the same week dates from the cycle
2. **Preference is metadata** - `week_start_day` is stored in user timelines
3. **Frontend handles display** - Use the preference to adjust visual calendar display
4. **Days-left is accurate** - Calculated from actual cycle dates, not user preferences

---

## Clean Up Duplicate Migrations (Optional)

You have two identical migration files:
- `20251012190740_implement_week_start_day_adjustment.sql`
- `20251012190847_implement_week_start_day_adjustment.sql`

To clean up:
```bash
# Delete the later one
rm supabase/migrations/20251012190847_implement_week_start_day_adjustment.sql
```

---

## Testing Your Fix

After running the script, test with these queries in SQL Editor:

```sql
-- 1. Check cycles
SELECT id, title, start_date, end_date FROM "0008-ap-global-cycles";

-- 2. Check weeks were generated
SELECT global_cycle_id, week_number, week_start, week_end 
FROM "0008-ap-global-weeks" 
ORDER BY global_cycle_id, week_number;

-- 3. Test the view (if you have active timelines)
SELECT * FROM v_user_global_timeline_weeks;

-- 4. Test the unified view
SELECT * FROM v_unified_timeline_weeks;
```

---

## Troubleshooting

### Error: "relation does not exist"
- Make sure `0008-ap-global-cycles` table exists
- The script will create `0008-ap-global-weeks` if missing

### Error: "permission denied"
- Run the script as a database admin or service role
- Check your RLS policies

### No weeks generated
- Check that your global cycles have valid start_date and end_date
- Look for NOTICE messages showing which cycles were processed

---

## Need Help?

If you see any errors:
1. Copy the full error message
2. Note which step failed (look for the STEP comments)
3. Check the verification output at the end

The script is safe to run multiple times - it's fully idempotent.
