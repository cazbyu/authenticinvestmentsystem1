/**
 * Morning Spark Compass Model — Service Layer
 *
 * Data queries for the compass-direction-based morning spark flow.
 * Reuses existing service functions where possible.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

// ============ TYPES ============

export interface BrainDumpHandoffItem {
  id: string;
  content: string;
}

export interface UnprocessedBrainDump {
  sessionId: string;
  items: BrainDumpHandoffItem[];
}

export interface CommitmentTaskRelation {
  id: string;
  label: string;
}

export interface CommitmentTask {
  id: string;
  title: string;
  due_date: string | null;
  is_urgent: boolean;
  is_important: boolean;
  one_thing: boolean;
  status: string;
  type: string;
  roles: CommitmentTaskRelation[];
  domains: CommitmentTaskRelation[];
  keyRelationships: CommitmentTaskRelation[];
}

export interface GoalActionForToday {
  task_id: string;
  title: string;
  recurrence_rule: string | null;
  target_days: number;
  weekly_actual: number;
  completed_dates: string[];
  roles: Array<{ id: string; label: string }>;
  domains: Array<{ id: string; name: string }>;
  is_scheduled_today: boolean;
  is_complete_for_week: boolean;
  completed_today: boolean;
}

export interface GoalPulseItem {
  goal_id: string;
  goal_title: string;
  goal_type: '12week' | 'custom';
  total_execution_percent: number;   // Overall effort score across entire timeline
  week_execution_percent: number;    // Effort score this week so far
  actions_for_today: GoalActionForToday[];
}

/** Legacy single-goal interface (kept for backward compat) */
export interface GoalPulseData {
  id: string;
  title: string;
  end_date: string | null;
  execution_rate: number;
  weeks_remaining: number | null;
}

export interface RoleFocusData {
  role_id: string;
  role_name: string;
  role_mission: string | null;
  slot_code: string;
  pending_task_count: number;
  is_priority: boolean;          // R1-R4
  days_since_activity: number | null; // null if active recently
  needs_attention: boolean;      // priority + 3+ days no activity
}

export interface WellnessGapData {
  zone_id: string;
  zone_name: string;
  slot_code: string;
  pending_task_count: number;
  is_priority: boolean;          // WZ1-WZ4
  days_since_activity: number | null;
  needs_attention: boolean;      // priority + 3+ days no activity
}

export interface MissionTouchData {
  mission_statement: string | null;
  one_thing: string | null;
}

// ============ BRAIN DUMP HANDOFF ============

/**
 * Check for unprocessed brain dumps from yesterday's evening review.
 */
export async function getUnprocessedBrainDump(userId: string): Promise<UnprocessedBrainDump | null> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  // Yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalISOString(yesterday).split('T')[0];

  const { data, error } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('id, brain_dump_raw, brain_dump_processed')
    .eq('user_id', userId)
    .eq('ritual_type', 'evening')
    .eq('session_date', yesterdayStr)
    .eq('brain_dump_processed', false)
    .not('brain_dump_raw', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.brain_dump_raw) return null;

  // Split raw text into lines
  const lines = data.brain_dump_raw
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  if (lines.length === 0) return null;

  return {
    sessionId: data.id,
    items: lines.map((line: string, i: number) => ({
      id: `bd-${data.id}-${i}`,
      content: line,
    })),
  };
}

/**
 * Process a brain dump item: make it a task, schedule it, or park it.
 */
export async function processBrainDumpItem(
  userId: string,
  content: string,
  action: 'task' | 'schedule' | 'park',
  dueDate?: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (action === 'task') {
    await supabase.from('0008-ap-tasks').insert({
      title: content,
      user_id: userId,
      status: 'pending',
      type: 'task',
    });
  } else if (action === 'schedule') {
    await supabase.from('0008-ap-tasks').insert({
      title: content,
      user_id: userId,
      status: 'pending',
      type: 'task',
      due_date: dueDate || null,
    });
  } else if (action === 'park') {
    await supabase.from('0008-ap-deposit-ideas').insert({
      title: content,
      user_id: userId,
      is_active: true,
    });
  }
}

/**
 * Mark brain dump as processed after all items actioned.
 */
export async function markBrainDumpProcessed(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('0008-ap-ritual-sessions')
    .update({ brain_dump_processed: true })
    .eq('id', sessionId);
}

// ============ TODAY'S COMMITMENTS ============

/**
 * Get pending tasks for today's commitment selection,
 * including roles, domains, and key relationships.
 */
export async function getTodaysTasksForCommitment(userId: string): Promise<CommitmentTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, due_date, is_urgent, is_important, one_thing, status, type')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('is_urgent', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(20);

  if (error) {
    console.error('Error fetching tasks for commitment:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  const taskIds = data.map((t) => t.id);

  // Fetch roles, domains, and key relationships in parallel
  const [rolesResult, domainsResult, krResult] = await Promise.all([
    supabase
      .from('0008-ap-universal-roles-join')
      .select('parent_id, role_id')
      .in('parent_id', taskIds)
      .eq('parent_type', 'task'),
    supabase
      .from('0008-ap-universal-domains-join')
      .select('parent_id, domain_id')
      .in('parent_id', taskIds)
      .eq('parent_type', 'task'),
    supabase
      .from('0008-ap-universal-key-relationships-join')
      .select('parent_id, key_relationship_id')
      .in('parent_id', taskIds)
      .eq('parent_type', 'task'),
  ]);

  // Collect unique IDs to look up labels
  const roleIds = [...new Set((rolesResult.data || []).map((r: any) => r.role_id))];
  const domainIds = [...new Set((domainsResult.data || []).map((d: any) => d.domain_id))];
  const krIds = [...new Set((krResult.data || []).map((k: any) => k.key_relationship_id))];

  // Fetch labels in parallel
  const [rolesLabels, domainsLabels, krLabels] = await Promise.all([
    roleIds.length > 0
      ? supabase.from('0008-ap-roles').select('id, label').in('id', roleIds)
      : { data: [] },
    domainIds.length > 0
      ? supabase.from('0008-ap-domains').select('id, name').in('id', domainIds)
      : { data: [] },
    krIds.length > 0
      ? supabase.from('0008-ap-key-relationships').select('id, name').in('id', krIds)
      : { data: [] },
  ]);

  const roleLabelMap = new Map((rolesLabels.data || []).map((r: any) => [r.id, r.label]));
  const domainLabelMap = new Map((domainsLabels.data || []).map((d: any) => [d.id, d.name]));
  const krLabelMap = new Map((krLabels.data || []).map((k: any) => [k.id, k.name]));

  // Build lookup maps: taskId → relations[]
  const taskRoles = new Map<string, CommitmentTaskRelation[]>();
  const taskDomains = new Map<string, CommitmentTaskRelation[]>();
  const taskKrs = new Map<string, CommitmentTaskRelation[]>();

  for (const r of rolesResult.data || []) {
    const arr = taskRoles.get(r.parent_id) || [];
    arr.push({ id: r.role_id, label: roleLabelMap.get(r.role_id) || '' });
    taskRoles.set(r.parent_id, arr);
  }
  for (const d of domainsResult.data || []) {
    const arr = taskDomains.get(d.parent_id) || [];
    arr.push({ id: d.domain_id, label: domainLabelMap.get(d.domain_id) || '' });
    taskDomains.set(d.parent_id, arr);
  }
  for (const k of krResult.data || []) {
    const arr = taskKrs.get(k.parent_id) || [];
    arr.push({ id: k.key_relationship_id, label: krLabelMap.get(k.key_relationship_id) || '' });
    taskKrs.set(k.parent_id, arr);
  }

  return data.map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    is_urgent: t.is_urgent,
    is_important: t.is_important,
    one_thing: t.one_thing || false,
    status: t.status,
    type: t.type,
    roles: taskRoles.get(t.id) || [],
    domains: taskDomains.get(t.id) || [],
    keyRelationships: taskKrs.get(t.id) || [],
  }));
}

/**
 * Get the weekly one_thing from the most recent completed weekly alignment.
 */
export async function getWeeklyOneThing(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-weekly-alignments')
    .select('one_thing')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.one_thing || null;
}

/**
 * Commit selected tasks as today's commitments.
 * Writes to 0008-ap-ritual-committed-tasks join table.
 * Creates or reuses today's morning spark ritual session.
 */
export async function commitTodaysTasks(
  userId: string,
  taskIds: string[],
  sessionId?: string,
  source: string = 'morning',
): Promise<string> {
  const supabase = getSupabaseClient();
  const todayStr = toLocalISOString(new Date()).split('T')[0];

  if (taskIds.length === 0) return sessionId || '';

  // Get or create today's ritual session
  let sId = sessionId;
  if (!sId) {
    const { data: existing } = await supabase
      .from('0008-ap-ritual-sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('ritual_type', 'morning')
      .eq('session_date', todayStr)
      .maybeSingle();

    if (existing) {
      sId = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from('0008-ap-ritual-sessions')
        .insert({
          user_id: userId,
          ritual_type: 'morning',
          session_date: todayStr,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      sId = inserted.id;
    }
  }

  // Clear any existing commitments for this session (re-entry)
  const { error: deleteError } = await supabase
    .from('0008-ap-ritual-committed-tasks')
    .delete()
    .eq('session_id', sId);
  if (deleteError) console.error('Failed to clear old commitments:', deleteError);

  // Insert new commitments
  const rows = taskIds.map((taskId) => ({
    session_id: sId!,
    task_id: taskId,
    user_id: userId,
    committed_date: todayStr,
    source,
    status: 'committed',
  }));

  console.log('Inserting committed tasks:', JSON.stringify({ sessionId: sId, count: rows.length, taskIds }));

  const { data: insertedRows, error: insertError } = await supabase
    .from('0008-ap-ritual-committed-tasks')
    .insert(rows)
    .select('id');

  if (insertError) {
    console.error('Failed to insert committed tasks:', insertError);
    throw insertError;
  }

  console.log('Successfully inserted committed tasks:', insertedRows?.length);
  return sId!;
}

/**
 * Get today's committed task IDs from the ritual-committed-tasks table.
 */
export async function getTodaysCommittedTaskIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const todayStr = toLocalISOString(new Date()).split('T')[0];

  const { data } = await supabase
    .from('0008-ap-ritual-committed-tasks')
    .select('task_id')
    .eq('user_id', userId)
    .eq('committed_date', todayStr);

  return (data || []).map((r: { task_id: string }) => r.task_id);
}

// ============ GOAL PULSE ============

/** Parse RRULE BYDAY into JS day-of-week numbers (0=Sun, 1=Mon, ..., 6=Sat) */
function getScheduledDays(rrule: string | null): number[] {
  if (!rrule) return [0, 1, 2, 3, 4, 5, 6]; // No rule = all days
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const upper = rrule.toUpperCase();
  if (upper.includes('FREQ=DAILY')) return [0, 1, 2, 3, 4, 5, 6];
  const match = upper.match(/BYDAY=([^;]+)/);
  if (!match) return [0, 1, 2, 3, 4, 5, 6];
  return match[1].split(',').map((d) => dayMap[d.trim()]).filter((n) => n !== undefined);
}

/**
 * Get ALL active goals (12-week and custom) with their actions for today.
 * Shows which actions are scheduled for today and still need to be done.
 */
export async function getAllGoalPulse(userId: string): Promise<GoalPulseItem[]> {
  const supabase = getSupabaseClient();
  const today = new Date();
  const todayDow = today.getDay(); // 0=Sun ... 6=Sat
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 1. Fetch all active goals (both types) in parallel
  const [twResult, customResult] = await Promise.all([
    supabase
      .from('0008-ap-goals-12wk')
      .select('id, title, user_global_timeline_id')
      .eq('user_id', userId)
      .neq('status', 'completed'),
    supabase
      .from('0008-ap-goals-custom')
      .select('id, title, custom_timeline_id')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .eq('archived', false),
  ]);

  const goals: Array<{
    id: string;
    title: string;
    goal_type: '12week' | 'custom';
    timeline_id: string | null;
  }> = [];

  for (const g of twResult.data || []) {
    goals.push({ id: g.id, title: g.title, goal_type: '12week', timeline_id: g.user_global_timeline_id });
  }
  for (const g of customResult.data || []) {
    goals.push({ id: g.id, title: g.title, goal_type: 'custom', timeline_id: g.custom_timeline_id });
  }

  if (goals.length === 0) return [];

  // 2. For each goal, find the current week from its timeline and get actions
  const results: GoalPulseItem[] = [];

  for (const goal of goals) {
    if (!goal.timeline_id) continue;

    // Find the current week for this timeline
    const timelineSource = goal.goal_type === '12week' ? 'global' : 'custom';
    const { data: weekData } = await supabase
      .from('v_unified_timeline_weeks')
      .select('week_number, week_start, week_end')
      .eq('timeline_id', goal.timeline_id)
      .eq('source', timelineSource)
      .lte('week_start', todayStr)
      .gte('week_end', todayStr)
      .limit(1)
      .maybeSingle();

    if (!weekData) continue; // Today is outside this timeline's range

    const weekNum = weekData.week_number;

    // 3. Fetch this week's actions for this goal via the view
    const timelineCol = goal.goal_type === '12week' ? 'user_global_timeline_id' : 'user_custom_timeline_id';
    const { data: actions } = await supabase
      .from('v_goal_detail_week_actions')
      .select('task_id, title, recurrence_rule, target_days, weekly_actual, completed_dates, roles, domains')
      .eq('goal_id', goal.id)
      .eq('week_number', weekNum)
      .eq(timelineCol, goal.timeline_id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!actions || actions.length === 0) continue;

    // 4. Filter to today's actions and those not yet complete
    const todayActions: GoalActionForToday[] = [];
    let weekTotalTarget = 0;
    let weekTotalActual = 0;

    for (const a of actions) {
      const scheduledDays = getScheduledDays(a.recurrence_rule);
      const isScheduledToday = scheduledDays.includes(todayDow);
      const targetDays = a.target_days || scheduledDays.length;
      const weeklyActual = a.weekly_actual || 0;
      const isCompleteForWeek = weeklyActual >= targetDays;
      const completedDates: string[] = a.completed_dates || [];
      const completedToday = completedDates.includes(todayStr);

      weekTotalTarget += targetDays;
      weekTotalActual += weeklyActual;

      // Show action if: scheduled today (even if completed — shown as done),
      // OR behind schedule with missed days already past this week
      // Don't show future-day actions as catch-up (e.g. TU/TH action on Monday)
      const hasMissedPastDays = !isCompleteForWeek && scheduledDays.some((d) => d < todayDow);
      if (isScheduledToday || hasMissedPastDays) {
        todayActions.push({
          task_id: a.task_id,
          title: a.title,
          recurrence_rule: a.recurrence_rule,
          target_days: targetDays,
          weekly_actual: weeklyActual,
          completed_dates: completedDates,
          roles: (a.roles || []).map((r: any) => ({ id: r.id, label: r.label || r.name || '' })),
          domains: (a.domains || []).map((d: any) => ({ id: d.id, name: d.label || d.name || '' })),
          is_scheduled_today: isScheduledToday,
          is_complete_for_week: isCompleteForWeek,
          completed_today: completedToday,
        });
      }
    }

    // Calculate execution percentages
    const weekExec = weekTotalTarget > 0 ? Math.round((weekTotalActual / weekTotalTarget) * 100) : 0;

    // Total execution: fetch all weeks' data for this goal (count completed vs target)
    const { data: allWeeksData } = await supabase
      .from('v_goal_detail_week_actions')
      .select('target_days, weekly_actual')
      .eq('goal_id', goal.id)
      .eq(timelineCol, goal.timeline_id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    let totalTarget = 0;
    let totalActual = 0;
    for (const w of allWeeksData || []) {
      totalTarget += w.target_days || 0;
      totalActual += w.weekly_actual || 0;
    }
    const totalExec = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    if (todayActions.length > 0) {
      results.push({
        goal_id: goal.id,
        goal_title: goal.title,
        goal_type: goal.goal_type,
        total_execution_percent: totalExec,
        week_execution_percent: weekExec,
        actions_for_today: todayActions,
      });
    }
  }

  return results;
}

/** Legacy single-goal function (kept for backward compat) */
export async function getGoalPulse(userId: string): Promise<GoalPulseData | null> {
  const items = await getAllGoalPulse(userId);
  if (items.length === 0) return null;
  const first = items[0];
  return {
    id: first.goal_id,
    title: first.goal_title,
    end_date: null,
    execution_rate: first.week_execution_percent,
    weeks_remaining: null,
  };
}

// ============ ROLE FOCUS ============

/** Helper: calculate days since last activity for an entity in a join table */
async function getDaysSinceActivity(
  supabase: any,
  joinTable: string,
  entityCol: string,
  entityId: string,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from(joinTable)
    .select('created_at')
    .eq(entityCol, entityId)
    .eq('parent_type', 'task')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return null; // Never had activity
  const lastDate = new Date(data.created_at);
  const now = new Date();
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get ALL active roles with task counts, priority flags, and 3-day warnings.
 * Looks at current + previous week for activity.
 */
export async function getRoleFocus(userId: string, sessionTaskIds?: string[]): Promise<RoleFocusData[]> {
  const supabase = getSupabaseClient();

  // Get ALL role slot mappings (R1-R12)
  const { data: mappings, error: mappingError } = await supabase
    .from('0008-ap-user-slot-mappings')
    .select('slot_code, mapped_entity_id, mapped_entity_label')
    .eq('user_id', userId)
    .like('slot_code', 'R%');

  if (mappingError || !mappings || mappings.length === 0) return [];

  const roleIds = mappings.map((m) => m.mapped_entity_id).filter(Boolean);

  const { data: roles, error: rolesError } = await supabase
    .from('0008-ap-roles')
    .select('id, label, role_mission')
    .in('id', roleIds);

  if (rolesError || !roles) return [];

  // Use session-committed task IDs if provided, otherwise query join table
  let committedTaskIds: string[] = [];
  if (sessionTaskIds && sessionTaskIds.length > 0) {
    committedTaskIds = sessionTaskIds;
  } else {
    committedTaskIds = await getTodaysCommittedTaskIds(userId);
  }

  // Build results with task counts and activity tracking
  const results: RoleFocusData[] = [];

  for (const m of mappings) {
    const role = roles.find((r) => r.id === m.mapped_entity_id);
    const slotNum = parseInt(m.slot_code.replace('R', ''), 10);
    const isPriority = slotNum >= 1 && slotNum <= 4;

    // Count today's committed tasks for this role
    let committedCount = 0;
    if (committedTaskIds.length > 0) {
      const { count } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id', { count: 'exact', head: true })
        .eq('role_id', m.mapped_entity_id)
        .eq('parent_type', 'task')
        .in('parent_id', committedTaskIds);
      committedCount = count || 0;
    }

    // Check days since last activity (only compute for priority roles)
    let daysSince: number | null = null;
    let needsAttention = false;
    if (isPriority) {
      daysSince = await getDaysSinceActivity(
        supabase, '0008-ap-universal-roles-join', 'role_id', m.mapped_entity_id, userId
      );
      needsAttention = daysSince !== null && daysSince >= 3;
      // Also flag if never had activity
      if (daysSince === null) needsAttention = true;
    }

    results.push({
      role_id: m.mapped_entity_id,
      role_name: role?.label || m.mapped_entity_label || 'Unknown Role',
      role_mission: role?.role_mission || null,
      slot_code: m.slot_code,
      pending_task_count: committedCount,
      is_priority: isPriority,
      days_since_activity: daysSince,
      needs_attention: needsAttention,
    });
  }

  // Sort: priority first (R1-R4), then by slot number
  results.sort((a, b) => {
    if (a.is_priority && !b.is_priority) return -1;
    if (!a.is_priority && b.is_priority) return 1;
    const aNum = parseInt(a.slot_code.replace('R', ''), 10);
    const bNum = parseInt(b.slot_code.replace('R', ''), 10);
    return aNum - bNum;
  });

  return results;
}

// ============ WELLNESS PULSE ============

/**
 * Get ALL active wellness zones with task counts, priority flags, and 3-day warnings.
 */
export async function getWellnessGaps(userId: string, sessionTaskIds?: string[]): Promise<WellnessGapData[]> {
  const supabase = getSupabaseClient();

  // Get ALL wellness zone slot mappings (WZ1-WZ8)
  const { data: mappings, error: mappingError } = await supabase
    .from('0008-ap-user-slot-mappings')
    .select('slot_code, mapped_entity_id, mapped_entity_label')
    .eq('user_id', userId)
    .like('slot_code', 'WZ%');

  if (mappingError || !mappings || mappings.length === 0) return [];

  const domainIds = mappings.map((m) => m.mapped_entity_id).filter(Boolean);

  // Get domain details
  const { data: domains } = await supabase
    .from('0008-ap-domains')
    .select('id, name')
    .in('id', domainIds);

  // Use session-committed task IDs if provided, otherwise query join table
  let committedTaskIds: string[] = [];
  if (sessionTaskIds && sessionTaskIds.length > 0) {
    committedTaskIds = sessionTaskIds;
  } else {
    committedTaskIds = await getTodaysCommittedTaskIds(userId);
  }

  const results: WellnessGapData[] = [];

  for (const m of mappings) {
    const domain = (domains || []).find((d: { id: string }) => d.id === m.mapped_entity_id);
    const slotNum = parseInt(m.slot_code.replace('WZ', ''), 10);
    const isPriority = slotNum >= 1 && slotNum <= 4;

    // Count today's committed tasks for this domain
    let committedCount = 0;
    if (committedTaskIds.length > 0) {
      const { count } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('parent_id', { count: 'exact', head: true })
        .eq('domain_id', m.mapped_entity_id)
        .eq('parent_type', 'task')
        .in('parent_id', committedTaskIds);
      committedCount = count || 0;
    }

    // Check days since last activity (only for priority zones)
    let daysSince: number | null = null;
    let needsAttention = false;
    if (isPriority) {
      daysSince = await getDaysSinceActivity(
        supabase, '0008-ap-universal-domains-join', 'domain_id', m.mapped_entity_id, userId
      );
      needsAttention = daysSince !== null && daysSince >= 3;
      if (daysSince === null) needsAttention = true;
    }

    results.push({
      zone_id: m.mapped_entity_id,
      zone_name: domain?.name || m.mapped_entity_label || 'Unknown Zone',
      slot_code: m.slot_code,
      pending_task_count: committedCount,
      is_priority: isPriority,
      days_since_activity: daysSince,
      needs_attention: needsAttention,
    });
  }

  // Sort: priority first, then by slot number
  results.sort((a, b) => {
    if (a.is_priority && !b.is_priority) return -1;
    if (!a.is_priority && b.is_priority) return 1;
    const aNum = parseInt(a.slot_code.replace('WZ', ''), 10);
    const bNum = parseInt(b.slot_code.replace('WZ', ''), 10);
    return aNum - bNum;
  });

  return results;
}

// ============ MISSION TOUCH ============

/**
 * Get mission statement and weekly one_thing for the North reminder.
 */
export async function getMissionTouch(userId: string): Promise<MissionTouchData> {
  const supabase = getSupabaseClient();

  const { data: northStar } = await supabase
    .from('0008-ap-north-star')
    .select('mission_statement')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  const oneThing = await getWeeklyOneThing(userId);

  return {
    mission_statement: northStar?.mission_statement || null,
    one_thing: oneThing,
  };
}

// ============ SESSION MANAGEMENT ============

/**
 * Create or update the morning spark ritual session.
 */
export async function saveMorningSparkSession(
  userId: string,
  data: {
    fuel_level: number;
    fuel_reason?: string | null;
    screen_context?: string | null;
    started_at: string;
    completed_at: string;
  },
): Promise<string> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  // Check if session already exists for today
  const { data: existing } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('ritual_type', 'morning')
    .eq('session_date', today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('0008-ap-ritual-sessions')
      .update({
        fuel_level: data.fuel_level,
        fuel_reason: data.fuel_reason || null,
        screen_context: data.screen_context || null,
        started_at: data.started_at,
        completed_at: data.completed_at,
        status: 'completed',
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from('0008-ap-ritual-sessions')
    .insert({
      user_id: userId,
      ritual_type: 'morning',
      session_date: today,
      fuel_level: data.fuel_level,
      fuel_reason: data.fuel_reason || null,
      screen_context: data.screen_context || null,
      started_at: data.started_at,
      completed_at: data.completed_at,
      status: 'completed',
    })
    .select('id')
    .single();

  if (error) throw error;
  return inserted.id;
}

// ============ CAPTURE ANALYSIS (Development Director / Coach) ============

export interface ParsedCaptureItem {
  /** Clean title for the item */
  title: string;
  /** DD's best guess at item type */
  suggested_type: 'task' | 'event' | 'reflection' | 'rose' | 'thorn' | 'depositIdea';
  /** If true, DD is uncertain and wants to ask the user a clarifying question */
  needs_clarification: boolean;
  /** The clarifying question to ask the user (e.g. "Are you committing to this or is it an idea?") */
  clarification_question: string | null;
  /** Alternative type if user answers the clarification differently */
  alternative_type: 'task' | 'event' | 'reflection' | 'rose' | 'thorn' | 'depositIdea' | null;
  /** Role suggestions */
  suggested_role_id: string | null;
  suggested_role_name: string | null;
  /** Domain/wellness zone suggestions (can be multiple) */
  suggested_domain_ids: string[];
  suggested_domain_names: string[];
  /** Key relationship suggestions */
  suggested_key_relationship_ids: string[];
  suggested_key_relationship_names: string[];
  /** Brief reasoning */
  reasoning: string;
}

export interface CaptureAnalysisResult {
  items: ParsedCaptureItem[];
}

/** Data needed to pre-fill TaskEventForm */
export interface TaskEventFormPrefill {
  title: string;
  type: 'task' | 'event' | 'depositIdea' | 'reflection';
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedKeyRelationshipIds: string[];
  is_deposit_idea?: boolean;
}

/**
 * Fetch wellness domains for the user (cached per call for reuse).
 */
export async function getUserDomains(userId: string): Promise<Array<{ id: string; label: string }>> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('0008-ap-domains')
    .select('id, name');
  return (data || []).map((d: any) => ({ id: d.id, label: d.name }));
}

/**
 * Analyze user free text — splits into multiple items, each with type suggestion,
 * role/domain/key-relationship mapping, and optional clarification questions.
 */
export async function analyzeCapture(
  userId: string,
  text: string,
  roles: RoleFocusData[],
  domains?: Array<{ id: string; label: string }>,
): Promise<CaptureAnalysisResult> {
  const supabase = getSupabaseClient();

  // Get domains if not provided
  if (!domains) {
    domains = await getUserDomains(userId);
  }

  // Get key relationships for name matching
  const { data: keyRels } = await supabase
    .from('0008-ap-key-relationships')
    .select('id, name')
    .eq('user_id', userId);

  const roleContext = roles.map((r) => `${r.role_name} (id: ${r.role_id})`).join(', ');
  const domainContext = domains.map((d) => `${d.label} (id: ${d.id})`).join(', ');
  const krContext = (keyRels || []).map((k: { id: string; name: string }) => `${k.name} (id: ${k.id})`).join(', ');

  try {
    const { data, error } = await supabase.functions.invoke('alignment-coach', {
      body: {
        mode: 'morning',
        trigger: 'capture_analysis',
        user_state: { roles: roleContext, domains: domainContext, key_relationships: krContext },
        messages: [
          {
            role: 'system',
            content: `You are the Development Director — a thoughtful coach helping someone organize their thoughts into action.

TITLE FORMATTING RULES (CRITICAL):
1. ALWAYS start the title with a VERB (Go, Take, Write, Call, Study, Meet, Review, etc.)
2. STRIP all "I want to", "I need to", "I should", "I'm going to", "I will" prefixes
3. Keep it concise — 3-7 words ideal
4. Examples:
   "I should go to the zoo with Ben" → "Go to the zoo with Ben"
   "I need to go on a walk today" → "Go on a walk"
   "I want to take my wife to lunch at noon" → "Take wife to lunch"
   "I will take John out for ice cream today at 4:00 pm" → "Take John for ice cream"
   "Maybe I could write a thank you email to my son" → "Write thank-you email to son"

ITEM TYPE RULES:
- task = a concrete, actionable commitment ("Do X by Y")
- event = something with a specific time/date mentioned ("at 4pm", "at noon", "tomorrow at 3")
- reflection = a thought or realization worth capturing
- rose = something positive, grateful, or celebratory
- thorn = a challenge, frustration, or difficulty
- depositIdea = a "maybe someday" idea, not a firm commitment

AMBIGUITY DETECTION:
Set needs_clarification=true when language is soft:
- "I want to..." / "I should..." / "Maybe I could..." / "It would be nice to..."
- Ask a brief conversational question like: "Are you committing to go to the zoo, or is that an idea you're parking for later?"

PERSON MATCHING:
When names of people are mentioned, check the key relationships list below. If a name matches (first name match is sufficient), include their ID in suggested_key_relationship_ids.

WELLNESS ZONE MATCHING:
An item can belong to MULTIPLE wellness zones. For example:
- "Go to the zoo with Ben" → Recreational + Social
- "Go on a walk" → Physical
- "Study for exam" → Intellectual
Include ALL relevant zone IDs in suggested_domain_ids (array).

For each item return:
- title: clean verb-first title (see rules above)
- suggested_type: one of the types above
- needs_clarification: boolean
- clarification_question: string or null
- alternative_type: string or null (what it would be if user answers differently)
- suggested_role_id: the most relevant role ID, or null
- suggested_role_name: the role name, or null
- suggested_domain_ids: array of matching wellness domain IDs (can be multiple)
- suggested_domain_names: array of matching domain names
- suggested_key_relationship_ids: array of matching key relationship IDs
- suggested_key_relationship_names: array of matching names
- reasoning: one brief sentence

Available roles: ${roleContext}
Available wellness domains: ${domainContext}
Available key relationships: ${krContext}

Return a JSON object with a single "items" array. Return ONLY valid JSON, no markdown fences.`,
          },
          { role: 'user', content: text },
        ],
      },
    });

    if (error) throw error;

    // Parse the response
    const responseText = typeof data === 'string' ? data : data?.text || data?.message || JSON.stringify(data);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const items: ParsedCaptureItem[] = (parsed.items || [parsed]).map((item: any) => ({
        title: item.title || text.trim(),
        suggested_type: item.suggested_type || 'task',
        needs_clarification: item.needs_clarification || false,
        clarification_question: item.clarification_question || null,
        alternative_type: item.alternative_type || null,
        suggested_role_id: item.suggested_role_id || null,
        suggested_role_name: item.suggested_role_name || null,
        suggested_domain_ids: item.suggested_domain_ids || (item.suggested_domain_id ? [item.suggested_domain_id] : []),
        suggested_domain_names: item.suggested_domain_names || (item.suggested_domain_name ? [item.suggested_domain_name] : []),
        suggested_key_relationship_ids: item.suggested_key_relationship_ids || [],
        suggested_key_relationship_names: item.suggested_key_relationship_names || [],
        reasoning: item.reasoning || '',
      }));
      return { items };
    }
  } catch (err) {
    console.error('Capture analysis failed, using fallback:', err);
  }

  // Fallback: simple heuristic with verb-first title cleanup
  let cleanTitle = text.trim()
    .replace(/^(I\s+)?(want\s+to|need\s+to|should|will|am\s+going\s+to|have\s+to|'m\s+going\s+to)\s+/i, '')
    .replace(/^(i\s+)/i, '');
  // Capitalize first letter
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  const lower = text.toLowerCase();
  let type: ParsedCaptureItem['suggested_type'] = 'task';
  let needsClarification = false;
  let clarificationQ: string | null = null;
  let altType: ParsedCaptureItem['suggested_type'] | null = null;

  if (lower.includes('i want') || lower.includes('i should') || lower.includes('maybe')) {
    needsClarification = true;
    clarificationQ = 'Are you committing to do this, or is it more of an idea to explore later?';
    altType = 'depositIdea';
  } else if (lower.includes('grateful') || lower.includes('thankful')) {
    type = 'rose';
  } else if (lower.includes('frustrated') || lower.includes('struggle')) {
    type = 'thorn';
  } else if (lower.includes('idea') || lower.includes('could')) {
    type = 'depositIdea';
  } else if (/\b(at\s+\d|meeting|call|appointment|noon|pm|am)\b/i.test(text)) {
    type = 'event';
  }

  return {
    items: [{
      title: cleanTitle,
      suggested_type: type,
      needs_clarification: needsClarification,
      clarification_question: clarificationQ,
      alternative_type: altType,
      suggested_role_id: null,
      suggested_role_name: null,
      suggested_domain_ids: [],
      suggested_domain_names: [],
      suggested_key_relationship_ids: [],
      suggested_key_relationship_names: [],
      reasoning: 'Auto-categorized (coach unavailable)',
    }],
  };
}

/**
 * Build a pre-fill object for TaskEventForm from a finalized capture item.
 * Maps rose/thorn to reflection type for the form.
 */
export function buildFormPrefill(item: ParsedCaptureItem): TaskEventFormPrefill {
  // Map item types to form types
  let formType: TaskEventFormPrefill['type'];
  switch (item.suggested_type) {
    case 'task':
      formType = 'task';
      break;
    case 'event':
      formType = 'event';
      break;
    case 'depositIdea':
      formType = 'depositIdea';
      break;
    case 'rose':
    case 'thorn':
    case 'reflection':
      formType = 'reflection';
      break;
    default:
      formType = 'task';
  }

  return {
    title: item.title,
    type: formType,
    selectedRoleIds: item.suggested_role_id ? [item.suggested_role_id] : [],
    selectedDomainIds: item.suggested_domain_ids || [],
    selectedKeyRelationshipIds: item.suggested_key_relationship_ids || [],
    is_deposit_idea: item.suggested_type === 'depositIdea',
  };
}

// ============ FINAL COMMITMENT REVIEW ============

export interface FinalReviewEvent {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  roles: CommitmentTaskRelation[];
  domains: CommitmentTaskRelation[];
}

export interface FinalReviewTask {
  id: string;
  title: string;
  is_urgent: boolean;
  is_important: boolean;
  type: string;
  roles: CommitmentTaskRelation[];
  domains: CommitmentTaskRelation[];
  keyRelationships: CommitmentTaskRelation[];
  source: 'task' | 'goal_action';
  goal_title?: string;
}

export interface FinalReviewData {
  events: FinalReviewEvent[];
  committedTasks: FinalReviewTask[];
}

/**
 * Get today's events and committed tasks for the final review screen.
 * Committed tasks = one_thing=true (from step 3) + any goal actions committed (passed as IDs).
 */
export async function getFinalReviewData(
  userId: string,
  sessionCommittedTaskIds: string[],
  committedGoalActionIds: string[],
): Promise<FinalReviewData> {
  const supabase = getSupabaseClient();
  const todayStr = toLocalISOString(new Date()).split('T')[0];

  // 1. Get today's events
  const { data: events } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, start_time, end_time, is_all_day')
    .eq('user_id', userId)
    .eq('type', 'event')
    .eq('status', 'pending')
    .is('deleted_at', null)
    .eq('due_date', todayStr)
    .order('start_time', { ascending: true });

  // 2. Get committed tasks — ONLY the ones selected in THIS session's step 3
  let committedTasks: any[] = [];
  if (sessionCommittedTaskIds.length > 0) {
    const { data } = await supabase
      .from('0008-ap-tasks')
      .select('id, title, is_urgent, is_important, type')
      .in('id', sessionCommittedTaskIds)
      .eq('status', 'pending')
      .is('deleted_at', null);
    committedTasks = data || [];
  }

  // 3. Get committed goal action titles (from step 4 selections)
  let goalActions: FinalReviewTask[] = [];
  if (committedGoalActionIds.length > 0) {
    const { data: actionTasks } = await supabase
      .from('0008-ap-tasks')
      .select('id, title, is_urgent, is_important, type')
      .in('id', committedGoalActionIds);

    // Get goal names for each action
    const { data: goalJoins } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id, twelve_wk_goal_id, custom_goal_id, goal_type')
      .in('parent_id', committedGoalActionIds)
      .eq('parent_type', 'task');

    // Get goal titles
    const goalIds12 = (goalJoins || []).filter((j: any) => j.twelve_wk_goal_id).map((j: any) => j.twelve_wk_goal_id);
    const goalIdsCustom = (goalJoins || []).filter((j: any) => j.custom_goal_id).map((j: any) => j.custom_goal_id);

    const [goals12, goalsCustom] = await Promise.all([
      goalIds12.length > 0
        ? supabase.from('0008-ap-goals-12wk').select('id, title').in('id', goalIds12)
        : { data: [] },
      goalIdsCustom.length > 0
        ? supabase.from('0008-ap-goals-custom').select('id, title').in('id', goalIdsCustom)
        : { data: [] },
    ]);

    const goalTitleMap = new Map<string, string>();
    for (const g of goals12.data || []) goalTitleMap.set(g.id, g.title);
    for (const g of goalsCustom.data || []) goalTitleMap.set(g.id, g.title);

    goalActions = (actionTasks || []).map((t: any) => {
      const join = (goalJoins || []).find((j: any) => j.parent_id === t.id);
      const goalId = join?.twelve_wk_goal_id || join?.custom_goal_id;
      return {
        id: t.id,
        title: t.title,
        is_urgent: t.is_urgent || false,
        is_important: t.is_important || false,
        type: t.type || 'task',
        roles: [],
        domains: [],
        keyRelationships: [],
        source: 'goal_action' as const,
        goal_title: goalId ? goalTitleMap.get(goalId) : undefined,
      };
    });
  }

  // 4. Collect all task IDs for relation lookups
  const allTaskIds = [
    ...(events || []).map((e: any) => e.id),
    ...(committedTasks || []).map((t: any) => t.id),
  ];

  // Fetch relations for events and committed tasks
  let roleLabelMap = new Map<string, string>();
  let domainLabelMap = new Map<string, string>();
  let krLabelMap = new Map<string, string>();
  let taskRolesMap = new Map<string, CommitmentTaskRelation[]>();
  let taskDomainsMap = new Map<string, CommitmentTaskRelation[]>();
  let taskKrsMap = new Map<string, CommitmentTaskRelation[]>();

  if (allTaskIds.length > 0) {
    const [rolesR, domainsR, krsR] = await Promise.all([
      supabase.from('0008-ap-universal-roles-join').select('parent_id, role_id').in('parent_id', allTaskIds).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-domains-join').select('parent_id, domain_id').in('parent_id', allTaskIds).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship_id').in('parent_id', allTaskIds).eq('parent_type', 'task'),
    ]);

    const rIds = [...new Set((rolesR.data || []).map((r: any) => r.role_id))];
    const dIds = [...new Set((domainsR.data || []).map((d: any) => d.domain_id))];
    const kIds = [...new Set((krsR.data || []).map((k: any) => k.key_relationship_id))];

    const [rLabels, dLabels, kLabels] = await Promise.all([
      rIds.length > 0 ? supabase.from('0008-ap-roles').select('id, label').in('id', rIds) : { data: [] },
      dIds.length > 0 ? supabase.from('0008-ap-domains').select('id, name').in('id', dIds) : { data: [] },
      kIds.length > 0 ? supabase.from('0008-ap-key-relationships').select('id, name').in('id', kIds) : { data: [] },
    ]);

    roleLabelMap = new Map((rLabels.data || []).map((r: any) => [r.id, r.label]));
    domainLabelMap = new Map((dLabels.data || []).map((d: any) => [d.id, d.name]));
    krLabelMap = new Map((kLabels.data || []).map((k: any) => [k.id, k.name]));

    for (const r of rolesR.data || []) {
      const arr = taskRolesMap.get(r.parent_id) || [];
      arr.push({ id: r.role_id, label: roleLabelMap.get(r.role_id) || '' });
      taskRolesMap.set(r.parent_id, arr);
    }
    for (const d of domainsR.data || []) {
      const arr = taskDomainsMap.get(d.parent_id) || [];
      arr.push({ id: d.domain_id, label: domainLabelMap.get(d.domain_id) || '' });
      taskDomainsMap.set(d.parent_id, arr);
    }
    for (const k of krsR.data || []) {
      const arr = taskKrsMap.get(k.parent_id) || [];
      arr.push({ id: k.key_relationship_id, label: krLabelMap.get(k.key_relationship_id) || '' });
      taskKrsMap.set(k.parent_id, arr);
    }
  }

  // Build events
  const finalEvents: FinalReviewEvent[] = (events || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    end_time: e.end_time,
    is_all_day: e.is_all_day || false,
    roles: taskRolesMap.get(e.id) || [],
    domains: taskDomainsMap.get(e.id) || [],
  }));

  // Build committed tasks — sorted: urgent+important first, then urgent, then important, then rest
  const finalTasks: FinalReviewTask[] = (committedTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    is_urgent: t.is_urgent || false,
    is_important: t.is_important || false,
    type: t.type || 'task',
    roles: taskRolesMap.get(t.id) || [],
    domains: taskDomainsMap.get(t.id) || [],
    keyRelationships: taskKrsMap.get(t.id) || [],
    source: 'task' as const,
  }));

  // Merge goal actions and sort all by priority
  const allTasks = [...finalTasks, ...goalActions];
  allTasks.sort((a, b) => {
    const aPriority = (a.is_urgent ? 2 : 0) + (a.is_important ? 1 : 0);
    const bPriority = (b.is_urgent ? 2 : 0) + (b.is_important ? 1 : 0);
    return bPriority - aPriority;
  });

  return {
    events: finalEvents,
    committedTasks: allTasks,
  };
}

/**
 * Remove a task from today's commitments (clear committed_date).
 */
export async function removeFromTodayCommitments(userId: string, taskId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const todayStr = toLocalISOString(new Date()).split('T')[0];
  await supabase
    .from('0008-ap-ritual-committed-tasks')
    .delete()
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .eq('committed_date', todayStr);
}
