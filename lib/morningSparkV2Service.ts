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
  source: 'coach' | 'user';
}

export interface BrainDumpTriageItem {
  id: string;
  content: string;
  created_at: string;
  source: 'brain_dump' | 'follow_up';
  parent_type?: string;
  parent_id?: string;
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

export interface GroupedContractItems {
  roles: WeeklyContractItem[];
  wellness: WeeklyContractItem[];
  goals: WeeklyContractItem[];
  other: WeeklyContractItem[];
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

// ============ ASPIRATION FUNCTIONS ============

/**
 * Get inspirational content for "Remember Who You Are" step.
 * Queries coach aspirations first, then user aspirations.
 */
export async function getAspirationContent(userId: string): Promise<AspirationContent | null> {
  const supabase = getSupabaseClient();

  // Try coach aspirations first
  const { data: coachData } = await supabase
    .from('0008-ap-aspirations-coach')
    .select('id, content_type, title, content_text, content_url, storage_path')
    .eq('is_active', true)
    .or(`is_shared_with_all_clients.eq.true,specific_client_ids.cs.{${userId}}`)
    .order('usage_count', { ascending: true })
    .limit(5);

  if (coachData && coachData.length > 0) {
    // Pick random from least-used
    const item = coachData[Math.floor(Math.random() * coachData.length)];

    // Update usage tracking
    await supabase
      .from('0008-ap-aspirations-coach')
      .update({ usage_count: (item as any).usage_count + 1 || 1, last_shown_at: new Date().toISOString() })
      .eq('id', item.id);

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

  // Fallback to user aspirations
  const { data: userData } = await supabase
    .from('0008-ap-aspirations-user')
    .select('id, content_type, title, content_text, content_url, storage_path')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('usage_count', { ascending: true })
    .limit(5);

  if (userData && userData.length > 0) {
    const item = userData[Math.floor(Math.random() * userData.length)];

    await supabase
      .from('0008-ap-aspirations-user')
      .update({ usage_count: (item as any).usage_count + 1 || 1, last_shown_at: new Date().toISOString() })
      .eq('id', item.id);

    return {
      id: item.id,
      content_type: item.content_type as AspirationContent['content_type'],
      title: item.title,
      content_text: item.content_text,
      content_url: item.content_url,
      storage_path: item.storage_path,
      source: 'user',
    };
  }

  return null;
}

// ============ BRAIN DUMP TRIAGE FUNCTIONS ============

/**
 * Get yesterday's brain dump + today's follow-ups merged into a triage list.
 */
export async function getBrainDumpAndFollowUps(userId: string): Promise<BrainDumpTriageItem[]> {
  const items: BrainDumpTriageItem[] = [];

  // Get yesterday's brain dump items
  try {
    const brainDumps = await getBrainDumpItems(userId);
    for (const bd of brainDumps) {
      items.push({
        id: bd.id,
        content: bd.content,
        created_at: bd.created_at,
        source: 'brain_dump',
      });
    }
  } catch (e) {
    console.error('Error fetching brain dump items:', e);
  }

  // Get follow-up items due today
  try {
    const supabase = getSupabaseClient();
    const { data: followUps, error } = await supabase
      .from('v_morning_spark_follow_ups')
      .select('*')
      .eq('user_id', userId)
      .order('follow_up_date', { ascending: true });

    if (!error && followUps) {
      for (const fu of followUps) {
        items.push({
          id: fu.follow_up_id,
          content: fu.title || 'Follow-up item',
          created_at: fu.created_at,
          source: 'follow_up',
          parent_type: fu.parent_type,
          parent_id: fu.parent_id,
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
 * Actions:
 * - do_today: Create task due today and add to contract
 * - schedule: Create task with specified date/time
 * - park: Move to Deposit Ideas (idea bank)
 * - archive: Mark as processed / done (keep in journal)
 * - delete: Cancel / remove the item
 */
export async function triageBrainDumpItem(
  item: BrainDumpTriageItem,
  action: TriageAction,
  userId: string,
  options?: {
    scheduleDate?: string;
    scheduleTime?: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];
  const now = new Date().toISOString();

  /**
   * Helper: mark the source item as processed.
   */
  async function markSourceProcessed(status: 'done' | 'cancelled' = 'done') {
    if (item.source === 'brain_dump') {
      await supabase
        .from('0008-ap-reflections')
        .update({ brain_dump_processed: true })
        .eq('id', item.id);
    } else if (item.source === 'follow_up') {
      await supabase
        .from('0008-ap-universal-follow-up-join')
        .update({ status, completed_at: now })
        .eq('id', item.id);
    }
  }

  switch (action) {
    case 'do_today': {
      // Create a task due today — it will appear on today's contract
      const { error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          title: item.content.substring(0, 200),
          description: item.content.length > 200 ? item.content : null,
          type: 'task',
          due_date: today,
          status: 'pending',
          is_urgent: false,
          is_important: true,
        });

      if (taskError) throw taskError;
      await markSourceProcessed();
      break;
    }

    case 'schedule': {
      // Create a task with the specified scheduled date (and optional time)
      const dueDate = options?.scheduleDate || today;

      const { error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          title: item.content.substring(0, 200),
          description: item.content.length > 200 ? item.content : null,
          type: 'task',
          due_date: dueDate,
          start_time: options?.scheduleTime || null,
          status: 'pending',
          is_urgent: false,
          is_important: false,
        });

      if (taskError) throw taskError;
      await markSourceProcessed();
      break;
    }

    case 'park': {
      // Move to Deposit Ideas (idea bank) for future consideration
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({
          user_id: userId,
          idea_title: item.content.substring(0, 200),
          idea_description: item.content.length > 200 ? item.content : null,
          is_active: true,
          archived: false,
        });

      if (error) throw error;
      await markSourceProcessed();
      break;
    }

    case 'archive': {
      // Keep in journal — acknowledge and mark as processed
      await markSourceProcessed('done');
      break;
    }

    case 'delete': {
      // Cancel / remove — mark as cancelled
      if (item.source === 'brain_dump') {
        // For brain dump items, mark processed (effectively dismissing)
        await supabase
          .from('0008-ap-reflections')
          .update({ brain_dump_processed: true, archived: true })
          .eq('id', item.id);
      } else if (item.source === 'follow_up') {
        await supabase
          .from('0008-ap-universal-follow-up-join')
          .update({ status: 'cancelled', completed_at: now })
          .eq('id', item.id);
      }
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

  // Get tasks due today or overdue (pending only)
  const { data: tasks, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_all_day, completed_at, one_thing, is_deposit_idea')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('cancelled', false)
    .or(`due_date.eq.${today},due_date.lt.${today},start_date.eq.${today}`)
    .order('is_urgent', { ascending: false })
    .order('is_important', { ascending: false })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (error || !tasks || tasks.length === 0) {
    return { roles: [], wellness: [], goals: [], other: [] };
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

  // Fetch goal joins
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
    const goal = (gj as any).goal_type === 'twelve_wk_goal'
      ? (gj as any).twelve_wk_goal
      : (gj as any).custom_goal;
    if (goal) {
      const existing = goalMap.get(gj.parent_id) || [];
      existing.push({ id: goal.id, title: goal.title, goal_type: (gj as any).goal_type });
      goalMap.set(gj.parent_id, existing);
    }
  }

  // Build enriched items and group
  const grouped: GroupedContractItems = { roles: [], wellness: [], goals: [], other: [] };

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

    // Categorize: primary group by first connection found
    if (roles.length > 0) {
      grouped.roles.push(item);
    } else if (domains.length > 0) {
      grouped.wellness.push(item);
    } else if (goals.length > 0) {
      grouped.goals.push(item);
    } else {
      grouped.other.push(item);
    }
  }

  return grouped;
}

/**
 * Adjust a contract item: delay or remove.
 */
export async function adjustContractItem(
  taskId: string,
  action: 'delay' | 'delete',
  newDate?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  if (action === 'delay' && newDate) {
    await supabase
      .from('0008-ap-tasks')
      .update({ due_date: newDate, times_rescheduled: supabase.rpc ? undefined : 1 })
      .eq('id', taskId);
  } else if (action === 'delete') {
    await supabase
      .from('0008-ap-tasks')
      .update({ cancelled: true })
      .eq('id', taskId);
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
