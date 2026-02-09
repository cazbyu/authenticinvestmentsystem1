/**
 * Shared utilities for weekly alignment timestamp tracking
 */

import { getSupabaseClient } from './supabase';

/**
 * Updates a step timestamp on the current week's alignment record.
 * Uses upsert to create or update the record.
 * 
 * @param userId - The user ID
 * @param weekStartDate - Week start date in 'YYYY-MM-DD' format
 * @param weekEndDate - Week end date in 'YYYY-MM-DD' format
 * @param column - Column name to update (e.g., 'step_1_started', 'step_2_ended')
 * @param timestamp - Optional timestamp (defaults to current ISO string)
 */
export async function updateStepTimestamp(
  userId: string,
  weekStartDate: string,
  weekEndDate: string,
  column: string,
  timestamp?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const timestampValue = timestamp || new Date().toISOString();
    
    await supabase
      .from('0008-ap-weekly-alignments')
      .upsert({
        user_id: userId,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        [column]: timestampValue,
      }, { 
        onConflict: 'user_id,week_start_date',
      });
  } catch (error) {
    // Fire-and-forget: log but don't block UI
    console.error(`Error updating step timestamp (${column}):`, error);
  }
}
