import { supabase } from './supabase';

export interface FollowUpItem {
  id: string;
  user_id: string;
  parent_type: 'reflection' | 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'goal' | 'custom_goal' | '1y_goal';
  parent_id: string;
  follow_up_date: string;
  status: 'pending' | 'done' | 'snoozed' | 'cancelled';
  reason_type?: 'review' | 'decide' | 'check_outcome' | 'waiting_for' | 'other' | null;
  reason?: string | null;
  created_at: string;
  completed_at?: string | null;
}

async function filterFollowUpsByActiveParents(items: FollowUpItem[]): Promise<FollowUpItem[]> {
  if (items.length === 0) {
    return [];
  }

  const collectIds = (types: FollowUpItem['parent_type'][]): string[] =>
    Array.from(new Set(items.filter((item) => types.includes(item.parent_type)).map((item) => item.parent_id)));

  const taskIds = collectIds(['task', 'event']);
  const depositIdeaIds = collectIds(['depositIdea']);
  const withdrawalIds = collectIds(['withdrawal']);
  const reflectionIds = collectIds(['reflection']);
  const goalIds = collectIds(['goal']);
  const customGoalIds = collectIds(['custom_goal']);
  const oneYearGoalIds = collectIds(['1y_goal']);

  const [
    { data: tasksData = [], error: tasksError } = { data: [], error: null },
    { data: depositIdeasData = [], error: depositIdeasError } = { data: [], error: null },
    { data: withdrawalsData = [], error: withdrawalsError } = { data: [], error: null },
    { data: reflectionsData = [], error: reflectionsError } = { data: [], error: null },
    { data: goalsData = [], error: goalsError } = { data: [], error: null },
    { data: customGoalsData = [], error: customGoalsError } = { data: [], error: null },
    { data: oneYearGoalsData = [], error: oneYearGoalsError } = { data: [], error: null },
  ] = await Promise.all([
    taskIds.length
      ? supabase
          .from('0008-ap-tasks')
          .select('id, type')
          .in('id', taskIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    depositIdeaIds.length
      ? supabase
          .from('0008-ap-deposit-ideas')
          .select('id')
          .in('id', depositIdeaIds)
          .eq('archived', false)
          .eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
    withdrawalIds.length
      ? supabase
          .from('0008-ap-withdrawals')
          .select('id')
          .in('id', withdrawalIds)
      : Promise.resolve({ data: [], error: null }),
    reflectionIds.length
      ? supabase
          .from('0008-ap-reflections')
          .select('id')
          .in('id', reflectionIds)
          .eq('archived', false)
      : Promise.resolve({ data: [], error: null }),
    goalIds.length
      ? supabase
          .from('0008-ap-goals-12wk')
          .select('id')
          .in('id', goalIds)
          .neq('status', 'archived')
      : Promise.resolve({ data: [], error: null }),
    customGoalIds.length
      ? supabase
          .from('0008-ap-goals-custom')
          .select('id')
          .in('id', customGoalIds)
          .neq('status', 'archived')
      : Promise.resolve({ data: [], error: null }),
    oneYearGoalIds.length
      ? supabase
          .from('0008-ap-goals-1y')
          .select('id')
          .in('id', oneYearGoalIds)
          .neq('status', 'archived')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tasksError) console.error('Error filtering follow-up tasks:', tasksError);
  if (depositIdeasError) console.error('Error filtering follow-up deposit ideas:', depositIdeasError);
  if (withdrawalsError) console.error('Error filtering follow-up withdrawals:', withdrawalsError);
  if (reflectionsError) console.error('Error filtering follow-up reflections:', reflectionsError);
  if (goalsError) console.error('Error filtering follow-up goals:', goalsError);
  if (customGoalsError) console.error('Error filtering follow-up custom goals:', customGoalsError);
  if (oneYearGoalsError) console.error('Error filtering follow-up 1y goals:', oneYearGoalsError);

  const activeTaskIds = new Set(tasksData.map((item: any) => item.id));
  const activeDepositIdeaIds = new Set(depositIdeasData.map((item: any) => item.id));
  const activeWithdrawalIds = new Set(withdrawalsData.map((item: any) => item.id));
  const activeReflectionIds = new Set(reflectionsData.map((item: any) => item.id));
  const activeGoalIds = new Set(goalsData.map((item: any) => item.id));
  const activeCustomGoalIds = new Set(customGoalsData.map((item: any) => item.id));
  const activeOneYearGoalIds = new Set(oneYearGoalsData.map((item: any) => item.id));

  return items.filter((item) => {
    switch (item.parent_type) {
      case 'task':
      case 'event':
        return activeTaskIds.has(item.parent_id);
      case 'depositIdea':
        return activeDepositIdeaIds.has(item.parent_id);
      case 'withdrawal':
        return activeWithdrawalIds.has(item.parent_id);
      case 'reflection':
        return activeReflectionIds.has(item.parent_id);
      case 'goal':
        return activeGoalIds.has(item.parent_id);
      case 'custom_goal':
        return activeCustomGoalIds.has(item.parent_id);
      case '1y_goal':
        return activeOneYearGoalIds.has(item.parent_id);
      default:
        return true;
    }
  });
}

export async function fetchPendingFollowUps(userId: string): Promise<FollowUpItem[]> {
  const { data, error } = await supabase
    .from('0008-ap-universal-follow-up-join')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('follow_up_date', { ascending: true });

  if (error) {
    console.error('Error fetching follow-ups:', error);
    return [];
  }
  const items = data || [];
  return filterFollowUpsByActiveParents(items);
}

export async function fetchPendingReflectionFollowUps(userId: string): Promise<FollowUpItem[]> {
  const { data, error } = await supabase
    .from('0008-ap-universal-follow-up-join')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('parent_type', 'reflection')
    .order('follow_up_date', { ascending: true });

  if (error) {
    console.error('Error fetching reflection follow-ups:', error);
    return [];
  }
  const items = data || [];
  return filterFollowUpsByActiveParents(items);
}

export async function markFollowUpDone(followUpId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('0008-ap-universal-follow-up-join')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
    })
    .eq('id', followUpId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking follow-up done:', error);
    return false;
  }
  return true;
}
