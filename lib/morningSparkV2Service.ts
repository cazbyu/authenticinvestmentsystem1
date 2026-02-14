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

// Level 3 (Full energy) follow-up: distinguish true sprint from over-enthusiasm
export type Fuel3WhyReason =
  | 'true_sprint'
  | 'post_rest_energy'
  | 'exciting_day'
  | 'over_enthusiasm'
  | 'caffeine_boost';

export interface Fuel3WhyOption {
  id: Fuel3WhyReason;
  emoji: string;
  label: string;
  subtext: string;
}

export const FUEL_3_WHY_OPTIONS: Fuel3WhyOption[] = [
  { id: 'true_sprint', emoji: '🏃', label: 'True Sprint', subtext: 'Genuinely rested and ready' },
  { id: 'post_rest_energy', emoji: '😴', label: 'Well-Rested', subtext: 'Good sleep, body recovered' },
  { id: 'exciting_day', emoji: '🎯', label: 'Exciting Day', subtext: 'Something to look forward to' },
  { id: 'over_enthusiasm', emoji: '⚠️', label: 'Maybe Over It', subtext: 'Could be riding a high' },
  { id: 'caffeine_boost', emoji: '☕', label: 'Caffeine Boost', subtext: 'Fueled by coffee, not rest' },
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
  core_identity: string | null;
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
  events: WeeklyContractItem[];
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
 * Save or update fuel level (and optionally fuel_1_why / fuel_3_why) for today's spark.
 * Creates a new spark if one doesn't exist.
 */
export async function saveFuelLevel(
  sparkId: string | null,
  userId: string,
  fuelLevel: FuelLevel,
  fuelWhy?: FuelWhyReason | null,
  fuel3Why?: Fuel3WhyReason | null,
): Promise<string> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  const modeMap: Record<FuelLevel, string> = { 1: 'recovery', 2: 'steady', 3: 'sprint' };
  // If user says over-enthusiasm or caffeine boost, pull target down to steady pace
  const adjustedMode = (fuelLevel === 3 && (fuel3Why === 'over_enthusiasm' || fuel3Why === 'caffeine_boost'))
    ? 'steady' : modeMap[fuelLevel];
  const scoreMap: Record<FuelLevel, number> = { 1: 20, 2: 35, 3: 55 };
  const adjustedScore = (fuelLevel === 3 && (fuel3Why === 'over_enthusiasm' || fuel3Why === 'caffeine_boost'))
    ? 40 : scoreMap[fuelLevel];

  const fuelPayload = {
    fuel_level: fuelLevel,
    mode: adjustedMode,
    initial_target_score: adjustedScore,
    fuel_1_why: fuelLevel === 1 ? (fuelWhy || null) : null,
    fuel_3_why: fuelLevel === 3 ? (fuel3Why || null) : null,
  };

  if (sparkId) {
    // Update existing spark
    const { error } = await supabase
      .from('0008-ap-daily-sparks')
      .update(fuelPayload)
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
        ...fuelPayload,
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
    .select('core_identity, mission_statement, 5yr_vision, life_motto, core_values')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { core_identity: null, mission_statement: null, vision: null, life_motto: null, core_values: [] };
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
    core_identity: data.core_identity || null,
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
 *
 * Uses `v_tasks_with_recurrence_expanded` to properly surface recurring goal
 * activities as individual daily occurrences rather than raw template rows.
 * The view is powered by `fn_expand_recurrence_dates()` and is already used
 * by the calendar and dashboard.
 */
export async function getWeeklyContractForToday(userId: string): Promise<GroupedContractItems> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  console.log('[Contract] Querying tasks for userId:', userId, 'today:', today);

  const viewSelect = 'id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_all_day, completed_at, occurrence_date, is_virtual_occurrence, source_task_id, recurrence_rule, status';

  // ── Query A: Today's occurrences from the recurrence-expanded view ──
  // Returns non-recurring tasks due today + virtual occurrences of recurring tasks
  const { data: todayTasks, error: errorA } = await supabase
    .from('v_tasks_with_recurrence_expanded')
    .select(viewSelect)
    .eq('user_id', userId)
    .eq('occurrence_date', today)
    .or('is_virtual_occurrence.eq.true,recurrence_rule.is.null')
    .is('completed_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'archived');

  // ── Query B: Overdue non-recurring tasks ──
  const { data: overdueTasks, error: errorB } = await supabase
    .from('v_tasks_with_recurrence_expanded')
    .select(viewSelect)
    .eq('user_id', userId)
    .lt('occurrence_date', today)
    .eq('is_virtual_occurrence', false)
    .is('completed_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'archived');

  // ── Query C: Events with start_date = today but no due_date ──
  // The view uses due_date as occurrence_date, so start_date-only events get
  // occurrence_date = NULL and are missed by queries A/B.
  const { data: startDateEvents, error: errorC } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_all_day, completed_at, one_thing, is_deposit_idea')
    .eq('user_id', userId)
    .eq('start_date', today)
    .is('due_date', null)
    .is('deleted_at', null)
    .is('completed_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'archived');

  if (errorA || errorB) {
    const err = errorA || errorB;
    console.error('[Contract] Error fetching tasks:', err!.message, err!.details, err!.hint, err!.code);
    return { events: [], roles: [], wellness: [], goals: [], unassigned: [] };
  }
  if (errorC) {
    console.warn('[Contract] Error fetching start_date events:', errorC.message);
  }

  // ── Merge and de-duplicate ──
  // Use source_task_id + occurrence_date as the dedup key (same pattern as useCalendarEvents.ts)
  const seen = new Set<string>();
  const tasks: any[] = [];

  function addTask(t: any) {
    const key = `${t.source_task_id || t.id}::${t.occurrence_date || t.start_date || 'none'}`;
    if (!seen.has(key)) {
      seen.add(key);
      tasks.push(t);
    }
  }

  for (const t of (todayTasks || [])) addTask(t);
  for (const t of (overdueTasks || [])) addTask(t);
  // Query C results don't have source_task_id — use id directly
  for (const t of (startDateEvents || [])) {
    const key = `${t.id}::${t.start_date || 'none'}`;
    if (!seen.has(key)) {
      seen.add(key);
      tasks.push({ ...t, source_task_id: t.id, is_virtual_occurrence: false, occurrence_date: t.start_date });
    }
  }

  if (tasks.length === 0) {
    console.log('[Contract] No tasks found for today:', today);
    return { events: [], roles: [], wellness: [], goals: [], unassigned: [] };
  }
  console.log('[Contract] Found', tasks.length, 'tasks (',
    (todayTasks || []).length, 'today +',
    (overdueTasks || []).length, 'overdue +',
    (startDateEvents || []).length, 'start-date events)');

  // ── Fetch missing columns (one_thing, is_deposit_idea) from base table ──
  // The view doesn't include these columns
  const allSourceTaskIds = [...new Set(tasks.map(t => t.source_task_id || t.id))];
  const oneThingMap = new Map<string, { one_thing: boolean; is_deposit_idea: boolean }>();

  if (allSourceTaskIds.length > 0) {
    const { data: extraCols } = await supabase
      .from('0008-ap-tasks')
      .select('id, one_thing, is_deposit_idea')
      .in('id', allSourceTaskIds);

    if (extraCols) {
      for (const row of extraCols) {
        oneThingMap.set(row.id, { one_thing: row.one_thing || false, is_deposit_idea: row.is_deposit_idea || false });
      }
    }
  }

  // ── Fetch role / domain / goal joins using source_task_id ──
  // Virtual occurrences have source_task_id pointing to the template row in 0008-ap-tasks.
  // The join tables link to that real row, so we use source_task_id as the lookup key.
  const lookupIds = allSourceTaskIds; // all unique real task IDs

  // Fetch role joins
  const { data: roleJoins } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id, role:0008-ap-roles(id, label)')
    .in('parent_id', lookupIds)
    .eq('parent_type', 'task');

  // Fetch domain joins
  const { data: domainJoins } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id, domain:0008-ap-domains(id, name)')
    .in('parent_id', lookupIds)
    .eq('parent_type', 'task');

  // Fetch goal joins — include weekly_target from the goal itself
  const { data: goalJoins } = await supabase
    .from('0008-ap-universal-goals-join')
    .select(`
      parent_id, goal_type,
      twelve_wk_goal:0008-ap-goals-12wk(id, title, weekly_target),
      custom_goal:0008-ap-goals-custom(id, title, weekly_target)
    `)
    .in('parent_id', lookupIds)
    .eq('parent_type', 'task');

  // Build lookup maps (keyed by source_task_id / real task id)
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

  // ── Count completed occurrences this week per goal (using the expanded view) ──
  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = formatLocalDate(weekStart);
  const weekEndStr = formatLocalDate(weekEnd);

  // Collect template IDs for goal-linked tasks
  const goalLinkedTemplateIds: string[] = [];
  for (const [lookupId] of goalMap) {
    goalLinkedTemplateIds.push(lookupId);
  }

  const weeklyActualMap = new Map<string, number>();

  if (goalLinkedTemplateIds.length > 0) {
    // Use the expanded view to count completed occurrences this week
    const { data: completedThisWeek } = await supabase
      .from('v_tasks_with_recurrence_expanded')
      .select('source_task_id, occurrence_date, completed_at')
      .eq('user_id', userId)
      .gte('occurrence_date', weekStartStr)
      .lte('occurrence_date', weekEndStr)
      .not('completed_at', 'is', null)
      .in('source_task_id', goalLinkedTemplateIds);

    if (completedThisWeek) {
      // Map completed source_task_ids back to goal IDs
      for (const ct of completedThisWeek) {
        const goals = goalMap.get(ct.source_task_id);
        if (goals && goals.length > 0) {
          const goalId = goals[0].id;
          weeklyActualMap.set(goalId, (weeklyActualMap.get(goalId) || 0) + 1);
        }
      }
    }
  }

  // ── Build enriched items and group ──
  const grouped: GroupedContractItems = { events: [], roles: [], wellness: [], goals: [], unassigned: [] };

  // Temporary map to accumulate tasks per goal
  const goalGroupMap = new Map<string, GoalContractGroup>();

  for (const task of tasks) {
    // Use source_task_id for join lookups (points to real row in 0008-ap-tasks)
    const lookupId = task.source_task_id || task.id;
    const roles = roleMap.get(lookupId) || [];
    const domains = domainMap.get(lookupId) || [];
    const goals = goalMap.get(lookupId) || [];
    const extra = oneThingMap.get(lookupId) || { one_thing: false, is_deposit_idea: false };

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
      points: calculateTaskPoints({ ...task, ...extra }, roles, domains, goals),
      one_thing: extra.one_thing,
      roles,
      domains,
      goals,
    };

    // Categorize: events FIRST, then goals, roles, wellness, unassigned.
    // A task with type='event' OR with start_date=today (event-like) goes to events section.
    // A task linked to a goal should always appear under that goal,
    // even if it also has role or domain tags.
    const isEvent = task.type === 'event' || (task.start_date === today && task.type === 'task');
    if (isEvent) {
      // Force the type to 'event' for display purposes if it has start_date=today
      if (task.type === 'task' && task.start_date === today) {
        item.type = 'event';
      }
      grouped.events.push(item);
    } else if (goals.length > 0) {
      // Add to the FIRST goal's group
      const primaryGoal = goals[0];

      // Check if weekly target is already met — skip if so
      const meta = goalMetaMap.get(primaryGoal.id);
      const weeklyActual = weeklyActualMap.get(primaryGoal.id) || 0;
      if (meta?.weeklyTarget && weeklyActual >= meta.weeklyTarget) {
        // Weekly target already met — don't show this activity
        continue;
      }

      if (!goalGroupMap.has(primaryGoal.id)) {
        goalGroupMap.set(primaryGoal.id, {
          goalId: primaryGoal.id,
          goalTitle: primaryGoal.title,
          goalType: primaryGoal.goal_type,
          weeklyTarget: meta?.weeklyTarget ?? null,
          weeklyActual,
          tasks: [],
        });
      }
      goalGroupMap.get(primaryGoal.id)!.tasks.push(item);
    } else if (roles.length > 0) {
      grouped.roles.push(item);
    } else if (domains.length > 0) {
      grouped.wellness.push(item);
    } else {
      grouped.unassigned.push(item);
    }
  }

  // Sort events by start_time (earliest first)
  grouped.events.sort((a, b) => {
    const aTime = a.start_time || '99:99';
    const bTime = b.start_time || '99:99';
    return aTime.localeCompare(bTime);
  });

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
      .update({ status: 'cancelled' })
      .eq('id', taskId);
  }
}

/**
 * Delegate a contract item to another person.
 * Creates/updates a delegation record in 0008-ap-delegates.
 * Delegation is tracked through the delegates table, not a column on tasks.
 */
export async function delegateContractItem(
  taskId: string,
  userId: string,
  delegateId: string,
  dueDate: string | null,
  notes: string
): Promise<void> {
  const supabase = getSupabaseClient();

  // Try to update an existing delegation link for this delegate + task
  const { data: existing } = await supabase
    .from('0008-ap-delegates')
    .select('id')
    .eq('id', delegateId)
    .eq('task_id', taskId)
    .maybeSingle();

  if (existing) {
    // Update existing delegation
    await supabase
      .from('0008-ap-delegates')
      .update({
        due_date: dueDate,
        notes: notes || null,
        status: 'pending',
      })
      .eq('id', existing.id);
  } else {
    // Update the delegate record to link it to this task
    const { error } = await supabase
      .from('0008-ap-delegates')
      .update({
        task_id: taskId,
        due_date: dueDate,
        notes: notes || null,
        status: 'pending',
      })
      .eq('id', delegateId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error delegating task:', error.message);
      throw error;
    }
  }
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
 * Saves the committed task IDs as a JSONB array so the contract is viewable later.
 */
export async function commitMorningSparkV2(
  sparkId: string,
  userId: string,
  targetScore: number,
  committedTaskIds?: string[],
  committedTaskPoints?: Record<string, number>,
): Promise<void> {
  const supabase = getSupabaseClient();

  const updatePayload: Record<string, any> = {
    committed_at: new Date().toISOString(),
    initial_target_score: targetScore,
  };

  // Save committed task IDs if the column exists (graceful fallback)
  if (committedTaskIds && committedTaskIds.length > 0) {
    updatePayload.committed_task_ids = committedTaskIds;
  }

  // Save pre-calculated points per task so the dashboard doesn't need to re-compute
  if (committedTaskPoints && Object.keys(committedTaskPoints).length > 0) {
    updatePayload.committed_task_points = committedTaskPoints;
  }

  const { error } = await supabase
    .from('0008-ap-daily-sparks')
    .update(updatePayload)
    .eq('id', sparkId);

  if (error) {
    // If the column doesn't exist yet, retry without it
    if (error.message?.includes('committed_task_ids')) {
      console.warn('[MorningSpark] committed_task_ids column not found, saving without it');
      const { error: retryError } = await supabase
        .from('0008-ap-daily-sparks')
        .update({
          committed_at: new Date().toISOString(),
          initial_target_score: targetScore,
        })
        .eq('id', sparkId);
      if (retryError) throw retryError;
    } else {
      throw error;
    }
  }
}

// ============ EVENING REVIEW V2 FUNCTIONS ============

/**
 * Get contract follow-up data: completed vs incomplete tasks, and untagged completions.
 */
export async function getContractFollowUp(userId: string, date: string): Promise<ContractFollowUpData> {
  const supabase = getSupabaseClient();

  // Get all tasks that were due today (include completed but not cancelled/archived)
  const { data: allTasks, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_all_day, completed_at, one_thing, is_deposit_idea')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'archived')
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

// ============ MORNING SPARK QUICK QUESTION ============

export interface SparkQuestion {
  id: string;
  question_text: string;
  question_context: string | null;
  strategy_type: string; // 'mission' | 'vision' | 'values'
}

/**
 * Fetch a random unanswered strategy question for the Morning Spark Remember step.
 * Prioritises questions the user hasn't answered yet.
 * Returns null if no questions are available.
 */
export async function getSparkQuestion(userId: string): Promise<SparkQuestion | null> {
  const supabase = getSupabaseClient();

  // Get user's core identity for identity-specific question filtering
  const { data: nsRow } = await supabase
    .from('0008-ap-north-star')
    .select('core_identity')
    .eq('user_id', userId)
    .maybeSingle();

  const identity = nsRow?.core_identity || null;

  // Get questions the user has already answered
  const { data: answered } = await supabase
    .from('0008-ap-question-responses')
    .select('question_id')
    .eq('user_id', userId);

  const answeredIds = (answered || []).map((a: { question_id: string }) => a.question_id);

  // Fetch active strategy questions (mission/vision/values), not role-specific
  let query = supabase
    .from('0008-ap-power-questions')
    .select('id, question_text, question_context, strategy_type')
    .eq('is_active', true)
    .eq('show_in_onboarding', true)
    .is('role_type', null)
    .in('strategy_type', ['mission', 'vision', 'values'])
    .order('ob_priority', { ascending: true });

  // Filter by identity or universal
  if (identity) {
    query = query.or(`core_identity.eq.${identity},core_identity.is.null`);
  } else {
    query = query.is('core_identity', null);
  }

  // Exclude already answered
  if (answeredIds.length > 0) {
    query = query.not('id', 'in', `(${answeredIds.join(',')})`);
  }

  const { data: questions, error } = await query.limit(5);

  if (error || !questions || questions.length === 0) {
    // Fallback: allow repeats if all have been answered
    const { data: fallback } = await supabase
      .from('0008-ap-power-questions')
      .select('id, question_text, question_context, strategy_type')
      .eq('is_active', true)
      .eq('show_in_onboarding', true)
      .is('role_type', null)
      .in('strategy_type', ['mission', 'vision', 'values'])
      .order('ob_priority', { ascending: true })
      .limit(5);

    if (!fallback || fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  // Pick randomly from the top-priority pool
  return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Save a quick question response from the Morning Spark Remember step.
 * The unique constraint is (user_id, question_id, week_start) so we
 * include the current week start to upsert correctly.
 */
export async function saveSparkQuestionResponse(
  userId: string,
  questionId: string,
  responseText: string,
  domain: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  // Calculate current week start (Monday) for the unique constraint
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

  const { error } = await supabase
    .from('0008-ap-question-responses')
    .upsert(
      {
        user_id: userId,
        question_id: questionId,
        response_text: responseText.trim(),
        context_type: 'morning_spark',
        domain,
        week_start: weekStartStr,
        used_in_synthesis: false,
      },
      { onConflict: 'user_id,question_id,week_start' }
    );

  if (error) {
    console.error('[MorningSpark] Error saving question response:', error);
    return false;
  }
  return true;
}

// Re-export commonly used functions so components can import from one place
export { checkTodaysSpark, calculateDailyScore, calculateDominantCardinal };
