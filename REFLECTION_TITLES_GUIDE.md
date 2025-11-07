# Reflection Titles Implementation Guide

## Overview

AI-generated titles have been added to reflections using OpenAI's GPT-4 Mini. Titles are automatically generated when new reflections are created and can be batch-generated for existing reflections.

## Features Implemented

### 1. **Timezone Fix (America/Denver)**
- Monthly index now correctly displays reflections on the date they were created in Denver timezone
- All UTC timestamps are converted to `America/Denver` before date grouping
- Your Oct 24 reflection at 4:22 PM will now appear under Oct 24 (not Oct 23)

### 2. **Automatic Title Generation**
- New reflections automatically get AI-generated titles
- Happens in the background (non-blocking)
- Uses GPT-4 Mini for cost-effectiveness (~$0.0001 per title)
- Titles are max 60 characters, concise and meaningful

### 3. **Database Schema**
New columns added to `0008-ap-reflections`:
- `reflection_title` (TEXT) - The AI-generated or manual title
- `title_generated_at` (TIMESTAMPTZ) - When the title was created
- `title_generation_method` (TEXT) - Either 'ai' or 'manual'

### 4. **Monthly Index Display**
- Column header changed to "Reflections & Daily Items"
- Reflection titles now appear first in the content summary
- Multiple reflections separated by ` | ` (pipe separator)
- Other items separated by ` • ` (bullet separator)

## Batch Title Generation

### How to Generate Titles for Existing Reflections

To generate titles for all existing reflections without titles, you'll need to call the batch generation Edge Function.

#### Option 1: Using cURL

```bash
# Get your auth token from the browser console:
# supabase.auth.getSession().then(({data}) => console.log(data.session.access_token))

curl -X POST \
  https://wyipyiahvjcvnwoxwttd.supabase.co/functions/v1/batch-generate-titles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

#### Option 2: Using the Browser Console

```javascript
const supabase = window.supabase; // or import from your app

const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-generate-titles`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  }
);

const result = await response.json();
console.log('Batch generation result:', result);
```

#### Response Format

```json
{
  "processed": 15,
  "successful": 14,
  "failed": ["reflection-id-that-failed"],
  "totalReflections": 15
}
```

### Processing Details

- Processes up to 100 reflections per batch
- Processes in groups of 10 with 200ms delay between groups
- Only processes reflections where `reflection_title IS NULL`
- Automatically skips archived reflections
- Respects rate limits

## Cost Estimates

Using GPT-4 Mini (recommended):
- **Per title**: ~$0.0001 (one hundredth of a cent)
- **100 reflections**: ~$0.01 (one cent)
- **1000 reflections**: ~$0.10 (ten cents)

Extremely affordable for personal use!

## Manual Title Editing

Users can manually edit or override AI-generated titles:
1. Open the reflection
2. Edit the title field
3. Save - the `title_generation_method` will remain 'ai' unless explicitly changed

## Regenerating Titles

To regenerate a title for a specific reflection:
1. Delete the existing title (set `reflection_title` to NULL in database)
2. The next time the reflection is edited or viewed, you can manually trigger regeneration
3. Or use the batch function to regenerate all NULL titles

## API Configuration

The OpenAI API key is stored in Supabase Edge Function secrets:
- Key name: `OPENAI_API_KEY`
- Already configured in your Supabase project
- No additional setup needed

## Monitoring

To check title generation status:

```sql
-- Count reflections with/without titles
SELECT
  COUNT(*) FILTER (WHERE reflection_title IS NOT NULL) as with_titles,
  COUNT(*) FILTER (WHERE reflection_title IS NULL) as without_titles,
  COUNT(*) as total
FROM "0008-ap-reflections"
WHERE archived = false
AND user_id = 'YOUR_USER_ID';

-- View recent titles
SELECT
  created_at,
  reflection_title,
  SUBSTRING(content, 1, 50) as content_preview,
  title_generation_method
FROM "0008-ap-reflections"
WHERE user_id = 'YOUR_USER_ID'
  AND archived = false
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### Titles Not Generating
1. Check Edge Function logs in Supabase Dashboard
2. Verify `OPENAI_API_KEY` is set in Edge Function secrets
3. Check for API rate limits or quota issues
4. Verify user has active session when creating reflection

### Timezone Issues
1. Verify your timezone is set in `0008-ap-users` table:
```sql
SELECT timezone FROM "0008-ap-users" WHERE id = 'YOUR_USER_ID';
```
2. Should show `America/Denver`
3. Update if needed:
```sql
UPDATE "0008-ap-users"
SET timezone = 'America/Denver'
WHERE id = 'YOUR_USER_ID';
```

## Files Modified

- `supabase/migrations/20251107040000_fix_timezone_and_add_reflection_titles.sql`
- `supabase/functions/generate-reflection-title/index.ts`
- `supabase/functions/batch-generate-titles/index.ts`
- `lib/reflectionUtils.ts`
- `types/reflections.ts`
- `components/reflections/MonthlyIndexView.tsx`

## Future Enhancements

Possible improvements:
- Add "Regenerate Title" button in reflection detail view
- Bulk selection UI for batch regeneration
- Title quality feedback mechanism
- Custom prompts per user for title generation style
- Title history/versioning
