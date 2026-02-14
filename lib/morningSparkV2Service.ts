/**
 * Morning Spark V2 & Evening Review V2 Service Layer
 *
 * Centralized data queries for the redesigned morning/evening flows.
 * Reuses existing sparkUtils, ritualUtils, and taskUtils where possible.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import {
  checkTodaysSpark,
  getBrainDumpItems,
  convertBrainDumpToTask,
  saveBrainDumpAsIdea,
  acknowledgeBrainDump,
} from '@/lib/sparkUtils';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { calculateDailyScore, calculateDominantCardinal } from '@/lib/ritualUtils';

// ============ TYPES ============

export type FuelLevel = 1 | 2 | 3;

export type FuelWhyReason =
  | 'physically_sick'
  | 'emotionally_heavy'
  | 'mental_burnout'
  | 'poor_sleep'
  | 'just_not_feeling_it';

export interface FuelWhyOption {
  id: FuelWhyReason;
  emoji: string;
  label: string;
}

export const FUEL_WHY_OPTIONS: FuelWhyOption[] = [
  { id: 'physically_sick', emoji: '🤒', label: 'Physically Sick' },
  { id: 'emotionally_heavy', emoji: '💔', label: 'Emotionally Heavy Hit' },
  { id: 'mental_burnout', emoji: '🧠', label: 'Mental Burnout' },
  { id: 'poor_sleep', emoji: '😴', label: 'Poor Sleep' },
  { id: 'just_not_feeling_it', emoji: '😐', label: 'Just Not Feeling It' },
];

export interface AspirationContent {
  id: string;
  content_type: 'quote' | 'image' | 'song' | 'video';
  title: string | null;
  content_text: string | null;
  content_url: string | null;
  storage_path: string | null;
  source: 'coach' | 'self' | 'system';
}

export interface NorthStarCore {
  mission_statement: string | null;
  vision: string | null;
  life_motto: string | null;
  core_values: string[];
}

export interface BrainDumpTriageItem {
  id: string;              // The source row ID (reflection, task, deposit idea, etc.)
  title: string;           // Short title shown on card
  body?: string;           // Full content for popup (e.g. reflection content)
  source: 'brain_dump' | 'follow_up';
  /** The source table type for the follow-up view (reflection, task, depositIdea, goal_12wk, etc.) */
  sourceType: string;
  /** Rose / thorn / reflection / depositIdea / task — for icon selection */
  iconType: string;
  follow_up_date?: string;
}

export type TriageAction = 'do_today' | 'schedule' | 'park' | 'archive' | 'delete';

export interface RoleTag {
  id: string;
  label: string;
}

export interface DomainTag {
  id: string;
  name: string;
}

export interface GoalTag {
  id: string;
  title: string;
  goal_type: string;
}

export interface WeeklyContractItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  due_date: string | null;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_urgent: boolean;
  is_important: boolean;
  is_all_day: boolean;
  completed_at: string | null;
  points: number;
  one_thing: boolean;
  roles: RoleTag[];
  domains: DomainTag[];
  goals: GoalTag[];
}

/** A goal with its child tasks/leading indicators for the contract view */
export interface GoalContractGroup {
  goalId: string;
  goalTitle: string;
  goalType: string;           // 'twelve_wk_goal' | 'custom_goal' | 'one_yr_goal'
  weeklyTarget: number | null; // e.g. 3 = target 3x/week
  weeklyActual: number;       // completed occurrences this week
  tasks: WeeklyContractItem[];
}

export interface GroupedContractItems {
  roles: WeeklyContractItem[];
  wellness: WeeklyContractItem[];
  goals: GoalContractGroup[];
  unassigned: WeeklyContractItem[];
}

export interface ContractFollowUpData {
  completed: WeeklyContractItem[];
  incomplete: WeeklyContractItem[];
  untagged: WeeklyContractItem[]; // completed but missing role/domain/goal connections
}

export interface DelegationItem {
  delegation_id: string;
  delegate_name: string;
  delegate_email: string | null;
  task_id: string;
  task_title: string;
  due_date: string | null;
  status: string;
  notes: string | null;
}

// ============ FUEL LEVEL FUNCTIONS ============

/**
 * Save or update fuel level (and optionally fuel_1_why) for today's spark.
 * Creates a new spark if one doesn't exist.
 */
export async function saveFuelLevel(
  sparkId: string | null,
  userId: string,
  fuelLevel: FuelLevel,
  fuelWhy?: FuelWhyReason | null
): Promise<string> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  const modeMap: Record<FuelLevel, string> = { 1: 'recovery', 2: 'steady', 3: 'sprint' };
  const scoreMap: Record<FuelLevel, number> = { 1: 20, 2: 35, 3: 55 };

  if (sparkId) {
    // Update existing spark
    const { error } = await supabase
      .from('0008-ap-daily-sparks')
      .update({
        fuel_level: fuelLevel,
        mode: modeMap[fuelLevel],
        initial_target_score: scoreMap[fuelLevel],
        fuel_1_why: fuelLevel === 1 ? (fuelWhy || null) : null,
      })
      .eq('id', sparkId);

    if (error) throw error;
    return sparkId;
  } else {
    // Create new spark
    const { data, error } = await supabase
      .from('0008-ap-daily-sparks')
      .insert({
        user_id: userId,
        spark_date: today,
        fuel_level: fuelLevel,
        mode: modeMap[fuelLevel],
        initial_target_score: scoreMap[fuelLevel],
        fuel_1_why: fuelLevel === 1 ? (fuelWhy || null) : null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }
}

// ============ NORTH STAR & ASPIRATION FUNCTIONS ============

/**
 * Get user's North Star core data (mission, vision, values).
 */
export async function getNorthStarCore(userId: string): Promise<NorthStarCore> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-north-star')
    .select('mission_statement, 5yr_vision, life_motto, core_values')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { mission_statement: null, vision: null, life_motto: null, core_values: [] };
  }

  // core_values can be a JSON array of strings, or null
  let values: string[] = [];
  if (data.core_values) {
    if (Array.isArray(data.core_values)) {
      values = data.core_values;
    } else if (typeof data.core_values === 'object') {
      values = Object.values(data.core_values).filter((v): v is string => typeof v === 'string');
    }
  }

  return {
    mission_statement: data.mission_statement || null,
    vision: data['5yr_vision'] || null,
    life_motto: data.life_motto || null,
    core_values: values,
  };
}

/**
 * Get inspirational content for "Remember Who You Are" step.
 *
 * Priority:
 * 1. Coach-assigned content from aspirations-coach (rich media)
 * 2. User's power quotes from user-power-quotes where show_in_spark = true
 *    (now supports quote, image, song, video via content_type/content_url/storage_path)
 */
export async function getAspirationContent(userId: string): Promise<AspirationContent | null> {
  const supabase = getSupabaseClient();

  // 1. Try coach aspirations first (these are curated by the coach)
  const { data: coachData } = await supabase
    .from('0008-ap-aspirations-coach')
    .select('id, content_type, title, content_text, content_url, storage_path, usage_count')
    .eq('is_active', true)
    .or(`is_shared_with_all_clients.eq.true,specific_client_ids.cs.{${userId}}`)
    .order('usage_count', { ascending: true })
    .limit(5);

  if (coachData && coachData.length > 0) {
    const item = coachData[Math.floor(Math.random() * coachData.length)];

    // Update usage tracking (fire-and-forget)
    supabase
      .from('0008-ap-aspirations-coach')
      .update({ usage_count: (item.usage_count || 0) + 1, last_shown_at: new Date().toISOString() })
      .eq('id', item.id)
      .then();

    return {
      id: item.id,
      content_type: item.content_type as AspirationContent['content_type'],
      title: item.title,
      content_text: item.content_text,
      content_url: item.content_url,
      storage_path: item.storage_path,
      source: 'coach',
    };
  }

  // 2. User's own power content (quotes, images, songs, videos) where show_in_spark = true
  const { data: powerData } = await supabase
    .from('0008-ap-user-power-quotes')
    .select('id, quote_text, attribution, content_type, content_url, storage_path, source_type, times_shown, is_pinned')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('show_in_spark', true)
    .order('is_pinned', { ascending: false })
    .order('times_shown', { ascending: true })
    .limit(5);

  if (powerData && powerData.length > 0) {
    // Pinned items always come first, then least-shown
    const item = powerData[0].is_pinned ? powerData[0] : powerData[Math.floor(Math.random() * powerData.length)];

    // Update usage tracking (fire-and-forget)
    supabase
      .from('0008-ap-user-power-quotes')
      .update({ times_shown: (item.times_shown || 0) + 1, last_shown_at: new Date().toISOString() })
      .eq('id', item.id)
      .then();

    return {
      id: item.id,
      content_type: (item.content_type || 'quote') as AspirationContent['content_type'],
      title: item.attribution || null,
      content_text: item.quote_text || null,
      content_url: item.content_url || null,
      storage_path: item.storage_path || null,
      source: (item.source_type || 'self') as AspirationContent['source'],
    };
  }

  return null;
}

// ============ BRAIN DUMP TRIAGE FUNCTIONS ============

/**
 * Get yesterday's brain dump + today's follow-ups merged into a triage list.
 *
 * The v_morning_spark_follow_ups view returns:
 *   id (source row ID), user_id, parent_type, parent_id (same as id),
 *   follow_up_date, title, completed_at, archived
 *
 * It does NOT use the universal follow-up join table — it queries
 * tasks, deposit-ideas, reflections, and goals directly via UNION.
 */
export async function getBrainDumpAndFollowUps(userId: string): Promise<BrainDumpTriageItem[]> {
  const items: BrainDumpTriageItem[] = [];

  // Get yesterday's brain dump items
  try {
    const brainDumps = await getBrainDumpItems(userId);
    for (const bd of brainDumps) {
      items.push({
        id: bd.id,
        title: bd.content?.substring(0, 100) || 'Brain dump',
        body: bd.content,
        source: 'brain_dump',
        sourceType: 'brain_dump',
        iconType: 'brain_dump',
      });
    }
  } catch (e) {
    console.error('Error fetching brain dump items:', e);
  }

  // Get follow-up items due today or overdue
  try {
    const supabase = getSupabaseClient();
    const { data: followUps, error } = await supabase
      .from('v_morning_spark_follow_ups')
      .select('*')
      .eq('user_id', userId)
      .order('follow_up_date', { ascending: true });

    if (!error && followUps) {
      // Collect reflection IDs so we can fetch body + rose/thorn flags
      const reflectionIds = followUps
        .filter((fu: any) => fu.parent_type === 'reflection')
        .map((fu: any) => fu.id);

      let reflectionDetails: Record<string, { content: string | null; daily_rose: boolean; daily_thorn: boolean }> = {};
      if (reflectionIds.length > 0) {
        const { data: reflections } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, daily_rose, daily_thorn')
          .in('id', reflectionIds);

        if (reflections) {
          for (const r of reflections) {
            reflectionDetails[r.id] = {
              content: r.content,
              daily_rose: r.daily_rose || false,
              daily_thorn: r.daily_thorn || false,
            };
          }
        }
      }

      for (const fu of followUps) {
        // Determine icon based on type + rose/thorn
        let iconType = fu.parent_type || 'reflection';
        const refDetail = reflectionDetails[fu.id];
        if (fu.parent_type === 'reflection' && refDetail) {
          if (refDetail.daily_rose) iconType = 'rose';
          else if (refDetail.daily_thorn) iconType = 'thorn';
          else iconType = 'reflection';
        }

        items.push({
          id: fu.id,
          title: fu.title || 'Follow-up item',
          body: refDetail?.content || undefined,
          source: 'follow_up',
          sourceType: fu.parent_type || 'unknown',
          iconType,
          follow_up_date: fu.follow_up_date,
        });
      }
    }
  } catch (e) {
    console.error('Error fetching follow-ups:', e);
  }

  return items;
}

/**
 * Process a single triage decision for a brain dump or follow-up item.
 *
 * The follow-up view uses the source table directly (reflections, tasks,
 * deposit-ideas, goals) — NOT the universal follow-up join table.
 * Processing means clearing the `follow_up` date or archiving on
 * the source row so it no longer appears in the view.
 *
 * Actions:
 * - do_today: Create task due today and add to contract
 * - schedule: Create task with specified date/time + optional duration
 * - park: Move to Deposit Ideas (idea bank)
 * - archive: Mark as processed / done (clear follow_up)
 * - delete: Archive / remove the item
 */
export async function triageBrainDumpItem(
  item: BrainDumpTriageItem,
  action: TriageAction,
  userId: string,
  options?: {
    scheduleDate?: string;
    scheduleTime?: string;
    durationMinutes?: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  /**
   * Helper: clear follow-up on the source row so item disappears from view.
   * For brain dumps, marks as processed. For follow-ups, clears the follow_up date.
   */
  async function clearFollowUp() {
    if (item.source === 'brain_dump') {
      await supabase
        .from('0008-ap-reflections')
        .update({ brain_dump_processed: true })
        .eq('id', item.id);
    } else if (item.source === 'follow_up') {
      // Update the source table directly based on sourceType
      switch (item.sourceType) {
        case 'reflection':
          await supabase
            .from('0008-ap-reflections')
            .update({ follow_up: null })
            .eq('id', item.id);
          break;
        case 'task':
        case 'event':
          await supabase
            .from('0008-ap-tasks')
            .update({ follow_up: null })
            .eq('id', item.id);
          break;
        case 'depositIdea':
          await supabase
            .from('0008-ap-deposit-ideas')
            .update({ follow_up: null })
            .eq('id', item.id);
          break;
        case 'goal_12wk':
          await supabase
            .from('0008-ap-goals-12wk')
            .update({ follow_up: null })
            .eq('id', item.id);
          break;
        case 'goal_1y':
          await supabase
            .from('0008-ap-goals-1y')
            .update({ follow_up: null })
            .eq('id', item.id);
          break;
        case 'goal_custom':
          await supabase
            .from('0008-ap-goals-custom')
            .update({ follow_up: null })
            .eq('id', item.id);
          break;
        default:
          console.warn('Unknown sourceType for follow-up clear:', item.sourceType);
      }
    }
  }

  /**
   * Helper: archive the source item (set archived = true and clear follow_up).
   */
  async function archiveSource() {
    if (item.source === 'brain_dump') {
      await supabase
        .from('0008-ap-reflections')
        .update({ brain_dump_processed: true, archived: true })
        .eq('id', item.id);
    } else if (item.source === 'follow_up') {
      switch (item.sourceType) {
        case 'reflection':
          await supabase
            .from('0008-ap-reflections')
            .update({ archived: true, follow_up: null })
            .eq('id', item.id);
          break;
        case 'task':
        case 'event':
          await supabase
            .from('0008-ap-tasks')
            .update({ cancelled: true, follow_up: null })
            .eq('id', item.id);
          break;
        case 'depositIdea':
          await supabase
            .from('0008-ap-deposit-ideas')
            .update({ archived: true, follow_up: null })
            .eq('id', item.id);
          break;
        case 'goal_12wk':
          await supabase
            .from('0008-ap-goals-12wk')
            .update({ archived: true, follow_up: null })
            .eq('id', item.id);
          break;
        case 'goal_1y':
          await supabase
            .from('0008-ap-goals-1y')
            .update({ archived_at: new Date().toISOString(), follow_up: null })
            .eq('id', item.id);
          break;
        case 'goal_custom':
          await supabase
            .from('0008-ap-goals-custom')
            .update({ archived: true, follow_up: null })
            .eq('id', item.id);
          break;
        default:
          console.warn('Unknown sourceType for archive:', item.sourceType);
      }
    }
  }

  const titleText = item.title.substring(0, 200);

  switch (action) {
    case 'do_today': {
      // Create a task due today — it will appear on today's contract
      const { error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          title: titleText,
          description: item.body || null,
          type: 'task',
          due_date: today,
          status: 'pending',
          is_urgent: false,
          is_important: true,
        });

      if (taskError) throw taskError;
      await clearFollowUp();
      break;
    }

    case 'schedule': {
      const dueDate = options?.scheduleDate || today;
      // If duration provided, calculate end_time from start_time
      let endTime: string | null = null;
      if (options?.scheduleTime && options?.durationMinutes) {
        const [h, m] = options.scheduleTime.split(':').map(Number);
        const totalMin = h * 60 + m + options.durationMinutes;
        const endH = Math.floor(totalMin / 60) % 24;
        const endM = totalMin % 60;
        endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      }

      const { error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          title: titleText,
          description: item.body || null,
          type: 'task',
          due_date: dueDate,
          start_time: options?.scheduleTime || null,
          end_time: endTime,
          status: 'pending',
          is_urgent: false,
          is_important: false,
        });

      if (taskError) throw taskError;
      await clearFollowUp();
      break;
    }

    case 'park': {
      // Move to Deposit Ideas (idea bank)
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({
          user_id: userId,
          title: titleText,
          is_active: true,
          archived: false,
        });

      if (error) throw error;
      await clearFollowUp();
      break;
    }

    case 'archive': {
      // Acknowledge — clear the follow-up date so it disappears from view
      await clearFollowUp();
      break;
    }

    case 'delete': {
      // Archive the source item
      await archiveSource();
      break;
    }
  }
}

// ============ WEEKLY CONTRACT FUNCTIONS ============

/**
 * Get today's tasks grouped by connection type (roles/wellness/goals/other).
 */
export async function getWeeklyContractForToday(userId: string): Promise<GroupedContractItems> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  // Get tasks due today or overdue — only INCOMPLETE tasks for the morning contract
  const { data: tasks, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_all_day, completed_at, one_thing, is_deposit_idea')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('completed_at', null)
    .eq('cancelled', false)
    .or(`due_date.eq.${today},due_date.lt.${today},start_date.eq.${today}`)
    .order('is_urgent', { ascending: false })
    .order('is_important', { ascending: false })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (error || !tasks || tasks.length === 0) {
    return { roles: [], wellness: [], goals: [], unassigned: [] };
  }

  const taskIds = tasks.map(t => t.id);

  // Fetch role joins
  const { data: roleJoins } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id, role:0008-ap-roles(id, label)')
    .in('parent_id', taskIds)
    .eq('parent_type', 'task');

  // Fetch domain joins
  const { data: domainJoins } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id, domain:0008-ap-domains(id, name)')
    .in('parent_id', taskIds)
    .eq('parent_type', 'task');

  // Fetch goal joins — include weekly_target from the goal itself
  const { data: goalJoins } = await supabase
    .from('0008-ap-universal-goals-join')
    .select(`
      parent_id, goal_type,
      twelve_wk_goal:0008-ap-goals-12wk(id, title, weekly_target),
      custom_goal:0008-ap-goals-custom(id, title, weekly_target)
    `)
    .in('parent_id', taskIds)
    .eq('parent_type', 'task');

  // Build lookup maps
  const roleMap = new Map<string, RoleTag[]>();
  const domainMap = new Map<string, DomainTag[]>();
  const goalMap = new Map<string, GoalTag[]>();

  // Also track goal metadata for building GoalContractGroups
  interface GoalMeta {
    id: string;
    title: string;
    goalType: string;
    weeklyTarget: number | null;
  }
  const goalMetaMap = new Map<string, GoalMeta>();

  for (const rj of (roleJoins || [])) {
    const role = (rj as any).role;
    if (role) {
      const existing = roleMap.get(rj.parent_id) || [];
      existing.push({ id: role.id, label: role.label });
      roleMap.set(rj.parent_id, existing);
    }
  }

  for (const dj of (domainJoins || [])) {
    const domain = (dj as any).domain;
    if (domain) {
      const existing = domainMap.get(dj.parent_id) || [];
      existing.push({ id: domain.id, name: domain.name });
      domainMap.set(dj.parent_id, existing);
    }
  }

  for (const gj of (goalJoins || [])) {
    const isTwelveWk = (gj as any).goal_type === 'twelve_wk_goal';
    const goal = isTwelveWk ? (gj as any).twelve_wk_goal : (gj as any).custom_goal;
    if (goal) {
      const existing = goalMap.get(gj.parent_id) || [];
      existing.push({ id: goal.id, title: goal.title, goal_type: (gj as any).goal_type });
      goalMap.set(gj.parent_id, existing);

      // Store goal metadata (de-dup by goal id)
      if (!goalMetaMap.has(goal.id)) {
        goalMetaMap.set(goal.id, {
          id: goal.id,
          title: goal.title,
          goalType: (gj as any).goal_type,
          weeklyTarget: goal.weekly_target ?? null,
        });
      }
    }
  }

  // Count completed tasks this week per goal (for weekly occurrence tracking)
  // Get the current week boundaries (Monday-Sunday)
  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = formatLocalDate(weekStart);
  const weekEndStr = formatLocalDate(weekEnd);

  // Get all completed tasks this week that are linked to goals
  const allGoalIds = Array.from(goalMetaMap.keys());
  const weeklyActualMap = new Map<string, number>();

  if (allGoalIds.length > 0) {
    // Find task IDs linked to these goals
    const { data: goalTaskJoins } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id, twelve_wk_goal_id, custom_goal_id')
      .eq('parent_type', 'task')
      .or(allGoalIds.map(gid => `twelve_wk_goal_id.eq.${gid},custom_goal_id.eq.${gid}`).join(','));

    if (goalTaskJoins && goalTaskJoins.length > 0) {
      const goalTaskIds = goalTaskJoins.map((gj: any) => gj.parent_id);

      // Count completed tasks from this week
      const { data: completedThisWeek } = await supabase
        .from('0008-ap-tasks')
        .select('id, completed_at')
        .in('id', goalTaskIds)
        .not('completed_at', 'is', null)
        .gte('completed_at', weekStartStr + 'T00:00:00')
        .lte('completed_at', weekEndStr + 'T23:59:59')
        .is('deleted_at', null);

      if (completedThisWeek) {
        // Map completed task IDs back to goal IDs
        const taskToGoal = new Map<string, string>();
        for (const gj of goalTaskJoins) {
          const goalId = (gj as any).twelve_wk_goal_id || (gj as any).custom_goal_id;
          if (goalId) taskToGoal.set((gj as any).parent_id, goalId);
        }
        for (const ct of completedThisWeek) {
          const goalId = taskToGoal.get(ct.id);
          if (goalId) {
            weeklyActualMap.set(goalId, (weeklyActualMap.get(goalId) || 0) + 1);
          }
        }
      }
    }
  }

  // Build enriched items and group
  const grouped: GroupedContractItems = { roles: [], wellness: [], goals: [], unassigned: [] };

  // Temporary map to accumulate tasks per goal
  const goalGroupMap = new Map<string, GoalContractGroup>();

  for (const task of tasks) {
    const roles = roleMap.get(task.id) || [];
    const domains = domainMap.get(task.id) || [];
    const goals = goalMap.get(task.id) || [];

    const item: WeeklyContractItem = {
      id: task.id,
      title: task.title,
      type: task.type,
      due_date: task.due_date,
      start_date: task.start_date,
      start_time: task.start_time,
      end_time: task.end_time,
      is_urgent: task.is_urgent || false,
      is_important: task.is_important || false,
      is_all_day: task.is_all_day || false,
      completed_at: task.completed_at,
      points: calculateTaskPoints(task, roles, domains, goals),
      one_thing: task.one_thing || false,
      roles,
      domains,
      goals,
    };

    // Categorize: roles first, then domains (wellness), then goals, else unassigned
    if (roles.length > 0) {
      grouped.roles.push(item);
    } else if (domains.length > 0) {
      grouped.wellness.push(item);
    } else if (goals.length > 0) {
      // Add to the FIRST goal's group
      const primaryGoal = goals[0];
      if (!goalGroupMap.has(primaryGoal.id)) {
        const meta = goalMetaMap.get(primaryGoal.id);
        goalGroupMap.set(primaryGoal.id, {
          goalId: primaryGoal.id,
          goalTitle: primaryGoal.title,
          goalType: primaryGoal.goal_type,
          weeklyTarget: meta?.weeklyTarget ?? null,
          weeklyActual: weeklyActualMap.get(primaryGoal.id) || 0,
          tasks: [],
        });
      }
      goalGroupMap.get(primaryGoal.id)!.tasks.push(item);
    } else {
      grouped.unassigned.push(item);
    }
  }

  // Convert goal groups map to sorted array (goals with most tasks first)
  grouped.goals = Array.from(goalGroupMap.values())
    .sort((a, b) => b.tasks.length - a.tasks.length);

  return grouped;
}

/** Helper to format a Date to YYYY-MM-DD in local time */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Complete a contract item — marks it done with the current timestamp.
 * Returns the completed_at timestamp.
 */
export async function completeContractItem(taskId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('0008-ap-tasks')
    .update({ completed_at: now })
    .eq('id', taskId);

  if (error) throw error;
  return now;
}

/**
 * Adjust a contract item: delay, delete, or delegate.
 */
export async function adjustContractItem(
  taskId: string,
  action: 'delay' | 'delete',
  newDate?: string,
  newStartTime?: string,
  newEndTime?: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (action === 'delay' && newDate) {
    const update: Record<string, any> = { due_date: newDate };
    if (newStartTime) update.start_time = newStartTime;
    if (newEndTime !== undefined) update.end_time = newEndTime;

    await supabase
      .from('0008-ap-tasks')
      .update(update)
      .eq('id', taskId);
  } else if (action === 'delete') {
    await supabase
      .from('0008-ap-tasks')
      .update({ cancelled: true })
      .eq('id', taskId);
  }
}

/**
 * Delegate a contract item to another person.
 * Creates a delegation record in 0008-ap-delegates and updates
 * the task's delegated_to field.
 */
export async function delegateContractItem(
  taskId: string,
  userId: string,
  delegateId: string,
  dueDate: string | null,
  notes: string
): Promise<void> {
  const supabase = getSupabaseClient();

  // Update the delegation record (0008-ap-delegates already stores task_id)
  const { error: delegateError } = await supabase
    .from('0008-ap-delegates')
    .update({
      task_id: taskId,
      due_date: dueDate,
      notes: notes || null,
      status: 'pending',
    })
    .eq('id', delegateId)
    .eq('user_id', userId);

  if (delegateError) {
    // If update fails (no matching row), insert a new delegation link instead
    // This covers the case where delegate exists but isn't linked to this task
    console.warn('Delegate update failed, trying to link delegate to task:', delegateError);
  }

  // Also stamp the task with delegated_to
  await supabase
    .from('0008-ap-tasks')
    .update({ delegated_to: delegateId })
    .eq('id', taskId);
}

/**
 * Get delegations due today.
 */
export async function getDelegations(userId: string): Promise<DelegationItem[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('v_morning_spark_delegations')
    .select('*')
    .eq('user_id', userId);

  if (error || !data) return [];

  return data.map((d: any) => ({
    delegation_id: d.delegation_id,
    delegate_name: d.delegate_name,
    delegate_email: d.delegate_email,
    task_id: d.task_id,
    task_title: d.task_title,
    due_date: d.due_date,
    status: d.status,
    notes: d.notes,
  }));
}

// ============ COMMIT FUNCTIONS ============

/**
 * Commit the morning spark (finalize the contract).
 */
export async function commitMorningSparkV2(
  sparkId: string,
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
    .eq('id', sparkId);

  if (error) throw error;
}

// ============ EVENING REVIEW V2 FUNCTIONS ============

/**
 * Get contract follow-up data: completed vs incomplete tasks, and untagged completions.
 */
export async function getContractFollowUp(userId: string, date: string): Promise<ContractFollowUpData> {
  const supabase = getSupabaseClient();

  // Get all tasks that were due today
  const { data: allTasks, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_all_day, completed_at, one_thing, is_deposit_idea')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or(`due_date.eq.${date},start_date.eq.${date}`)
    .order('completed_at', { ascending: false, nullsFirst: false });

  if (error || !allTasks) return { completed: [], incomplete: [], untagged: [] };

  const taskIds = allTasks.map(t => t.id);

  // Fetch joins for all tasks
  const { data: roleJoins } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id, role:0008-ap-roles(id, label)')
    .in('parent_id', taskIds)
    .eq('parent_type', 'task');

  const { data: domainJoins } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id, domain:0008-ap-domains(id, name)')
    .in('parent_id', taskIds)
    .eq('parent_type', 'task');

  const { data: goalJoins } = await supabase
    .from('0008-ap-universal-goals-join')
    .select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title), custom_goal:0008-ap-goals-custom(id, title)')
    .in('parent_id', taskIds)
    .eq('parent_type', 'task');

  // Build lookup maps
  const roleMap = new Map<string, RoleTag[]>();
  const domainMap = new Map<string, DomainTag[]>();
  const goalMap = new Map<string, GoalTag[]>();

  for (const rj of (roleJoins || [])) {
    const role = (rj as any).role;
    if (role) {
      const arr = roleMap.get(rj.parent_id) || [];
      arr.push({ id: role.id, label: role.label });
      roleMap.set(rj.parent_id, arr);
    }
  }
  for (const dj of (domainJoins || [])) {
    const domain = (dj as any).domain;
    if (domain) {
      const arr = domainMap.get(dj.parent_id) || [];
      arr.push({ id: domain.id, name: domain.name });
      domainMap.set(dj.parent_id, arr);
    }
  }
  for (const gj of (goalJoins || [])) {
    const goal = (gj as any).goal_type === 'twelve_wk_goal'
      ? (gj as any).twelve_wk_goal
      : (gj as any).custom_goal;
    if (goal) {
      const arr = goalMap.get(gj.parent_id) || [];
      arr.push({ id: goal.id, title: goal.title, goal_type: (gj as any).goal_type });
      goalMap.set(gj.parent_id, arr);
    }
  }

  const result: ContractFollowUpData = { completed: [], incomplete: [], untagged: [] };

  for (const task of allTasks) {
    const roles = roleMap.get(task.id) || [];
    const domains = domainMap.get(task.id) || [];
    const goals = goalMap.get(task.id) || [];

    const item: WeeklyContractItem = {
      id: task.id,
      title: task.title,
      type: task.type,
      due_date: task.due_date,
      start_date: task.start_date,
      start_time: task.start_time,
      end_time: task.end_time,
      is_urgent: task.is_urgent || false,
      is_important: task.is_important || false,
      is_all_day: task.is_all_day || false,
      completed_at: task.completed_at,
      points: calculateTaskPoints(task, roles, domains, goals),
      one_thing: task.one_thing || false,
      roles,
      domains,
      goals,
    };

    if (task.completed_at) {
      result.completed.push(item);
      // Check if untagged
      if (roles.length === 0 && domains.length === 0 && goals.length === 0) {
        result.untagged.push(item);
      }
    } else {
      result.incomplete.push(item);
    }
  }

  return result;
}

/**
 * Tag a completed task with role/domain/goal connections.
 */
export async function tagCompletedTask(
  taskId: string,
  roleIds?: string[],
  domainIds?: string[],
  goalIds?: string[]
): Promise<void> {
  const supabase = getSupabaseClient();

  if (roleIds?.length) {
    const joins = roleIds.map(roleId => ({
      parent_id: taskId,
      parent_type: 'task',
      role_id: roleId,
    }));
    await supabase.from('0008-ap-universal-roles-join').upsert(joins, { onConflict: 'parent_id,role_id' });
  }

  if (domainIds?.length) {
    const joins = domainIds.map(domainId => ({
      parent_id: taskId,
      parent_type: 'task',
      domain_id: domainId,
    }));
    await supabase.from('0008-ap-universal-domains-join').upsert(joins, { onConflict: 'parent_id,domain_id' });
  }

  if (goalIds?.length) {
    const joins = goalIds.map(goalId => ({
      parent_id: taskId,
      parent_type: 'task',
      goal_id: goalId,
      goal_type: 'twelve_wk_goal',
    }));
    await supabase.from('0008-ap-universal-goals-join').upsert(joins, { onConflict: 'parent_id,goal_id' });
  }
}

/**
 * Save evening review v2 (combined brain dump, no separate rose/thorn).
 */
export async function saveEveningReviewV2(
  userId: string,
  date: string,
  brainDumpContent: string,
  dayWord?: string
): Promise<string> {
  const supabase = getSupabaseClient();

  const finalScore = await calculateDailyScore(userId, date);
  const dominantCardinal = await calculateDominantCardinal(userId, date);

  // Get target score from morning spark
  const { data: sparkData } = await supabase
    .from('0008-ap-daily-sparks')
    .select('initial_target_score')
    .eq('user_id', userId)
    .eq('spark_date', date)
    .maybeSingle();

  const targetScore = sparkData?.initial_target_score || 35;

  const { data, error } = await supabase.rpc('create_evening_review_v2', {
    p_user_id: userId,
    p_review_date: date,
    p_brain_dump_content: brainDumpContent.trim() || null,
    p_final_score: finalScore,
    p_target_score: targetScore,
    p_dominant_cardinal: dominantCardinal,
    p_day_word: dayWord?.trim() || null,
  });

  if (error) throw error;
  return data?.[0]?.id || '';
}

/**
 * Get user's roles for tagging UI.
 */
export async function getUserRoles(userId: string): Promise<RoleTag[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('0008-ap-roles')
    .select('id, label')
    .eq('user_id', userId)
    .order('priority_order', { ascending: true });
  return (data || []).map(r => ({ id: r.id, label: r.label }));
}

/**
 * Get wellness domains for tagging UI.
 */
export async function getUserDomains(userId: string): Promise<DomainTag[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('0008-ap-domains')
    .select('id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  return (data || []).map(d => ({ id: d.id, name: d.name }));
}

/**
 * Get active goals for tagging UI.
 */
export async function getUserGoals(userId: string): Promise<GoalTag[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('0008-ap-goals-12wk')
    .select('id, title')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  return (data || []).map(g => ({ id: g.id, title: g.title, goal_type: 'twelve_wk_goal' }));
}

// Re-export commonly used functions so components can import from one place
export { checkTodaysSpark, calculateDailyScore, calculateDominantCardinal };
