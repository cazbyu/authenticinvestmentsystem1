import { getSupabaseClient } from '@/lib/supabase';

export type VisitType = 
  | 'full_page'
  | 'mission_edit'
  | 'vision_edit'
  | 'values_edit'
  | 'weekly_alignment_step'
  | 'morning_spark_step';

export async function recordNorthStarVisit(visitType: VisitType): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('0008-ap-north-star-visits')
      .insert({
        user_id: user.id,
        visit_type: visitType,
        visited_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording North Star visit:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording North Star visit:', error);
    return false;
  }
}

export async function hasRecentMVVVisit(hoursAgo: number = 72): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursAgo);

    const { data } = await supabase
      .from('0008-ap-north-star-visits')
      .select('id')
      .eq('user_id', user.id)
      .in('visit_type', ['mission_edit', 'vision_edit', 'values_edit', 'weekly_alignment_step', 'morning_spark_step'])
      .gte('visited_at', cutoff.toISOString())
      .limit(1);

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking recent MVV visit:', error);
    return false;
  }
}