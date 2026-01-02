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
