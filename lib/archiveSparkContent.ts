import { getSupabaseClient } from './supabase';

export async function archiveOldSparkContent(userId: string) {
  try {
    const supabase = getSupabaseClient();
    const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabase
      .from('0008-ap-user-power-quotes')
      .update({ archived_month: currentMonth })
      .eq('user_id', userId)
      .is('archived_month', null)
      .not('last_shown_at', 'is', null)
      .lt('last_shown_at', thirtyDaysAgo.toISOString());

    await supabase
      .from('0008-ap-user-power-questions')
      .update({ archived_month: currentMonth })
      .eq('user_id', userId)
      .is('archived_month', null)
      .not('last_shown_at', 'is', null)
      .lt('last_shown_at', thirtyDaysAgo.toISOString());

    return { success: true };
  } catch (error) {
    console.error('Error archiving spark content:', error);
    return { success: false, error };
  }
}
