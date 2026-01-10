// Utility function to reset today's Morning Spark
// This should be called from your "Reset Dev" function

import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

/**
 * Deletes today's Morning Spark for the current user
 * This forces them to select a new energy level
 * 
 * Call this from your Reset Dev function to clear Morning Spark state
 */
export async function resetTodaysSpark(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const today = toLocalISOString(new Date()).split('T')[0];
    
    // Delete today's spark
    const { error } = await supabase
      .from('0008-ap-daily-sparks')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', today);
    
    if (error) {
      console.error('Error resetting spark:', error);
      return false;
    }
    
    console.log('Morning Spark reset successfully');
    return true;
  } catch (error) {
    console.error('Error in resetTodaysSpark:', error);
    return false;
  }
}

/**
 * Alternative: Reset spark to uncommitted state (keeps energy level selection)
 * Use this if you want to keep the energy level but clear the commitment
 */
export async function resetSparkCommitment(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const today = toLocalISOString(new Date()).split('T')[0];
    
    const { error } = await supabase
      .from('0008-ap-daily-sparks')
      .update({
        committed_at: null,
        initial_target_score: null,
        commit_reflection: false,
        commit_rose: false,
        commit_thorn: false,
        commit_evening_review: false,
      })
      .eq('user_id', userId)
      .gte('created_at', today);
    
    if (error) {
      console.error('Error resetting commitment:', error);
      return false;
    }
    
    console.log('Morning Spark commitment reset successfully');
    return true;
  } catch (error) {
    console.error('Error in resetSparkCommitment:', error);
    return false;
  }
}