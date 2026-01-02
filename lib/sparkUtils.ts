import { getSupabaseClient } from './supabase';

export interface DailySpark {
  id: string;
  user_id: string;
  spark_date: string;
  fuel_level: 1 | 2 | 3;
  mode: 'Recovery' | 'Steady' | 'Sprint';
  initial_target_score: 20 | 35 | 55;
  committed_at: string;
  created_at: string;
}

export interface CreateSparkParams {
  userId: string;
  fuelLevel: 1 | 2 | 3;
  sparkDate: string;
}

export function calculateTargetScore(fuelLevel: 1 | 2 | 3): 20 | 35 | 55 {
  switch (fuelLevel) {
    case 1:
      return 20;
    case 2:
      return 35;
    case 3:
      return 55;
  }
}

export function getFuelMode(fuelLevel: 1 | 2 | 3): 'Recovery' | 'Steady' | 'Sprint' {
  switch (fuelLevel) {
    case 1:
      return 'Recovery';
    case 2:
      return 'Steady';
    case 3:
      return 'Sprint';
  }
}

export function getFuelEmoji(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return '🪫';
    case 2:
      return '⚡';
    case 3:
      return '🔥';
  }
}

export function getFuelColor(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return '#ef4444'; // red
    case 2:
      return '#f59e0b'; // amber
    case 3:
      return '#10b981'; // green
  }
}

export function getModeDescription(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return 'Rest and recharge. Honor low energy.';
    case 2:
      return 'Maintain momentum. Consistent progress.';
    case 3:
      return 'Full power. Bring your A-game.';
  }
}

export async function checkTodaysSpark(userId: string): Promise<DailySpark | null> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('0008-ap-daily-sparks')
    .select('*')
    .eq('user_id', userId)
    .eq('spark_date', today)
    .maybeSingle();

  if (error) {
    console.error('Error checking today\'s spark:', error);
    throw error;
  }

  return data;
}

export async function createDailySpark(params: CreateSparkParams): Promise<DailySpark> {
  const supabase = getSupabaseClient();
  const { userId, fuelLevel, sparkDate } = params;

  const mode = getFuelMode(fuelLevel);
  const targetScore = calculateTargetScore(fuelLevel);

  const { data, error } = await supabase
    .from('0008-ap-daily-sparks')
    .insert({
      user_id: userId,
      spark_date: sparkDate,
      fuel_level: fuelLevel,
      mode: mode,
      initial_target_score: targetScore,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating daily spark:', error);
    throw error;
  }

  return data;
}

export async function getSparkForDate(userId: string, date: string): Promise<DailySpark | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-daily-sparks')
    .select('*')
    .eq('user_id', userId)
    .eq('spark_date', date)
    .maybeSingle();

  if (error) {
    console.error('Error getting spark for date:', error);
    throw error;
  }

  return data;
}

export async function updateSparkFuelLevel(sparkId: string, fuelLevel: 1 | 2 | 3): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('0008-ap-daily-sparks')
    .update({
      fuel_level: fuelLevel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sparkId);

  if (error) {
    console.error('Error updating spark fuel level:', error);
    throw error;
  }
}

export interface ScheduledAction {
  id: string;
  type: 'task' | 'event';
  title: string;
  description?: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_urgent: boolean;
  is_important: boolean;
  is_all_day: boolean;
  completed_at?: string;
}

export interface ScheduledActionsData {
  overdue: ScheduledAction[];
  today: ScheduledAction[];
  totalTasks: number;
  totalEvents: number;
}

export async function getScheduledActions(userId: string): Promise<ScheduledActionsData> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .select('*')
    .eq('user_id', userId)
    .in('type', ['task', 'event'])
    .is('completed_at', null)
    .is('deleted_at', null)
    .or(`start_date.eq.${today},due_date.eq.${today},due_date.lt.${today}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching scheduled actions:', error);
    throw error;
  }

  const actions = (data || []) as ScheduledAction[];

  const overdue = actions.filter(
    (action) => action.due_date && action.due_date < today
  );

  const todayActions = actions.filter(
    (action) =>
      !action.due_date ||
      action.due_date === today ||
      action.start_date === today
  );

  const totalTasks = actions.filter((a) => a.type === 'task').length;
  const totalEvents = actions.filter((a) => a.type === 'event').length;

  return {
    overdue,
    today: todayActions,
    totalTasks,
    totalEvents,
  };
}

export function getFuelLevelMessage(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return "Let's focus on what's essential. You can adjust anything that feels like too much.";
    case 2:
      return "Here's your plan. We can adjust if needed to keep your momentum steady.";
    case 3:
      return "You're energized! Let's make the most of today's opportunities.";
  }
}

export function formatTimeDisplay(time?: string): string {
  if (!time) return '';

  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export interface BrainDumpItem {
  id: string;
  user_id: string;
  reflection_type: string;
  parent_type: string;
  content: string;
  reflection_date?: string;
  created_at: string;
}

export async function getBrainDumpItems(userId: string): Promise<BrainDumpItem[]> {
  const supabase = getSupabaseClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('0008-ap-reflections')
    .select('*')
    .eq('user_id', userId)
    .eq('reflection_type', 'daily')
    .eq('parent_type', 'brain_dump')
    .gte('created_at', `${yesterdayDate}T00:00:00`)
    .lt('created_at', `${yesterdayDate}T23:59:59`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching brain dump items:', error);
    throw error;
  }

  return (data || []) as BrainDumpItem[];
}

export async function convertBrainDumpToTask(brainDumpId: string, userId: string, content: string): Promise<void> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('0008-ap-tasks')
    .insert({
      user_id: userId,
      type: 'task',
      title: content.substring(0, 200),
      description: content.length > 200 ? content : null,
      start_date: today,
      status: 'pending',
    });

  if (error) {
    console.error('Error converting brain dump to task:', error);
    throw error;
  }

  await supabase
    .from('0008-ap-reflections')
    .delete()
    .eq('id', brainDumpId);
}

export async function saveBrainDumpAsIdea(brainDumpId: string, userId: string, content: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('0008-ap-deposit-ideas')
    .insert({
      user_id: userId,
      idea_title: content.substring(0, 200),
      idea_description: content.length > 200 ? content : null,
      is_active: true,
      archived: false,
    });

  if (error) {
    console.error('Error saving brain dump as idea:', error);
    throw error;
  }

  await supabase
    .from('0008-ap-reflections')
    .delete()
    .eq('id', brainDumpId);
}

export async function addReflectionToBrainDump(
  brainDumpId: string,
  userId: string,
  reflectionContent: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error} = await supabase
    .from('0008-ap-reflections')
    .insert({
      user_id: userId,
      reflection_type: 'daily',
      parent_type: 'brain_dump',
      parent_id: brainDumpId,
      content: reflectionContent,
      reflection_date: new Date().toISOString().split('T')[0],
    });

  if (error) {
    console.error('Error adding reflection to brain dump:', error);
    throw error;
  }
}

export async function acknowledgeBrainDump(brainDumpId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('0008-ap-reflections')
    .delete()
    .eq('id', brainDumpId);

  if (error) {
    console.error('Error acknowledging brain dump:', error);
    throw error;
  }
}

export function formatBrainDumpTime(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `Yesterday at ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function getBrainDumpMessage(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return 'Any of these need attention today? Only tackle what feels essential.';
    case 2:
      return "Quick review - anything here worth acting on?";
    case 3:
      return "Let's capture any wins or opportunities from yesterday!";
  }
}

export interface DepositIdea {
  id: string;
  user_id: string;
  title: string;
  is_active: boolean;
  created_at: string;
  activated_at?: string;
  archived: boolean;
  follow_up: boolean;
  activated_task_id?: string;
}

export async function getAvailableDepositIdeas(userId: string, limit: number = 20): Promise<DepositIdea[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-deposit-ideas')
    .select('*')
    .eq('user_id', userId)
    .is('activated_at', null)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching deposit ideas:', error);
    throw error;
  }

  return (data || []) as DepositIdea[];
}

export async function activateDepositIdeas(
  userId: string,
  selectedIdeas: DepositIdea[]
): Promise<void> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  for (const idea of selectedIdeas) {
    const { data: taskData, error: taskError } = await supabase
      .from('0008-ap-tasks')
      .insert({
        user_id: userId,
        type: 'task',
        title: idea.title,
        start_date: today,
        status: 'pending',
      })
      .select()
      .single();

    if (taskError) {
      console.error('Error creating task from deposit idea:', taskError);
      throw taskError;
    }

    const { error: updateError } = await supabase
      .from('0008-ap-deposit-ideas')
      .update({
        activated_at: new Date().toISOString(),
        activated_task_id: taskData.id,
      })
      .eq('id', idea.id);

    if (updateError) {
      console.error('Error updating deposit idea:', updateError);
      throw updateError;
    }
  }
}

export function calculateDaysAgo(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function formatDaysAgo(dateString: string): string {
  const days = calculateDaysAgo(dateString);

  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
}

export function getDepositIdeasMessage(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return 'Only add what feels energizing, not draining. You can skip this entirely.';
    case 2:
      return 'Want to activate any saved ideas for today?';
    case 3:
      return "Great time to activate some of those ideas you've been saving!";
  }
}

export async function getTodayTargetScore(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .select('points_value')
    .eq('user_id', userId)
    .is('completed_at', null)
    .or(`start_date.eq.${today},due_date.eq.${today}`);

  if (error) {
    console.error('Error calculating target score:', error);
    throw error;
  }

  const totalScore = (data || []).reduce((sum, task) => {
    return sum + (task.points_value || 0);
  }, 0);

  return totalScore;
}

export async function commitDailySpark(
  userId: string,
  targetScore: number
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('0008-ap-daily-sparks')
    .update({
      committed_at: new Date().toISOString(),
      initial_target_score: targetScore,
    })
    .eq('user_id', userId)
    .gte('created_at', new Date().toISOString().split('T')[0])
    .lt('created_at', new Date(Date.now() + 86400000).toISOString().split('T')[0]);

  if (error) {
    console.error('Error committing daily spark:', error);
    throw error;
  }
}

export interface Aspiration {
  id: string;
  aspiration_date: string;
  aspiration_text: string;
  created_at: string;
  updated_at: string;
}

export async function getRandomAspiration(userId: string): Promise<Aspiration | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-aspirations-library')
    .select('*')
    .eq('user_id', userId)
    .limit(50);

  if (error) {
    console.error('Error fetching aspirations:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * data.length);
  return data[randomIndex] as Aspiration;
}

const DEFAULT_INSPIRATIONS = [
  "You've got this! Make today count. 💪",
  "Every great achievement starts with the decision to try.",
  "Focus on progress, not perfection.",
  "Today is a fresh start. Embrace the possibilities.",
  "Your potential is limitless. Let's make it happen!",
  "Small steps lead to big changes.",
  "Believe in yourself and all that you are.",
  "The journey of a thousand miles begins with one step.",
  "You are capable of amazing things.",
  "Make today so awesome that yesterday gets jealous.",
];

export function getDefaultInspiration(): string {
  const randomIndex = Math.floor(Math.random() * DEFAULT_INSPIRATIONS.length);
  return DEFAULT_INSPIRATIONS[randomIndex];
}
