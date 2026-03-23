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
}

export interface WellnessGapData {
  zone_id: string;
  zone_name: string;
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
    .eq('ritual_type', 'evening_review')
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
 * Commit selected tasks as today's commitments (set one_thing = true).
 */
export async function commitTodaysTasks(taskIds: string[]): Promise<void> {
  const supabase = getSupabaseClient();

  // First reset any existing one_thing flags for today
  // (in case user re-enters the morning spark)
  // We only reset tasks that are pending — completed ones keep their flag
  for (const id of taskIds) {
    await supabase
      .from('0008-ap-tasks')
      .update({ one_thing: true })
      .eq('id', id);
  }
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

      // Show action if: scheduled today AND not completed today,
      // OR not yet complete for the week (needs catch-up)
      if ((isScheduledToday && !completedToday) || (!isCompleteForWeek && !completedToday)) {
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

/**
 * Get user's top priority roles (R1, R2 slots).
 */
export async function getRoleFocus(userId: string): Promise<RoleFocusData[]> {
  const supabase = getSupabaseClient();

  const { data: mappings, error: mappingError } = await supabase
    .from('0008-ap-user-slot-mappings')
    .select('slot_code, mapped_entity_id, mapped_entity_label')
    .eq('user_id', userId)
    .in('slot_code', ['R1', 'R2']);

  if (mappingError || !mappings || mappings.length === 0) return [];

  const roleIds = mappings.map((m) => m.mapped_entity_id).filter(Boolean);

  const { data: roles, error: rolesError } = await supabase
    .from('0008-ap-roles')
    .select('id, label, role_mission')
    .in('id', roleIds);

  if (rolesError || !roles) return [];

  // Get pending task counts per role via universal-roles-join
  const taskCountMap: Record<string, number> = {};
  for (const roleId of roleIds) {
    const { count } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('parent_id', { count: 'exact', head: true })
      .eq('role_id', roleId)
      .eq('parent_type', 'task')
      .in('parent_id',
        (await supabase
          .from('0008-ap-tasks')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .is('deleted_at', null)
        ).data?.map((t: { id: string }) => t.id) || []
      );
    taskCountMap[roleId] = count || 0;
  }

  return mappings.map((m) => {
    const role = roles.find((r) => r.id === m.mapped_entity_id);
    return {
      role_id: m.mapped_entity_id,
      role_name: role?.label || m.mapped_entity_label || 'Unknown Role',
      role_mission: role?.role_mission || null,
      slot_code: m.slot_code,
      pending_task_count: taskCountMap[m.mapped_entity_id] || 0,
    };
  });
}

// ============ WELLNESS PULSE ============

/**
 * Find wellness zones that have had no activity in the last 7 days.
 */
export async function getWellnessGaps(userId: string): Promise<WellnessGapData[]> {
  const supabase = getSupabaseClient();

  // Get all domain IDs
  const { data: allDomains, error: domainError } = await supabase
    .from('0008-ap-domains')
    .select('id, name');

  if (domainError || !allDomains) return [];

  // Get domain IDs that have had activity in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = toLocalISOString(sevenDaysAgo);

  const { data: activeJoins, error: joinError } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('domain_id')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgoStr);

  if (joinError) return [];

  const activeDomainIds = new Set((activeJoins || []).map((j) => j.domain_id));

  // Find domains with no activity
  const gaps = allDomains
    .filter((d) => !activeDomainIds.has(d.id))
    .map((d) => ({
      zone_id: d.id,
      zone_name: d.name,
    }));

  return gaps;
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
    .eq('ritual_type', 'morning_spark')
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
      ritual_type: 'morning_spark',
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
  /** Domain/wellness zone suggestions */
  suggested_domain_id: string | null;
  suggested_domain_name: string | null;
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
 * role/domain mapping, and optional clarification questions.
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

  const roleContext = roles.map((r) => `${r.role_name} (id: ${r.role_id})`).join(', ');
  const domainContext = domains.map((d) => `${d.label} (id: ${d.id})`).join(', ');

  try {
    const { data, error } = await supabase.functions.invoke('alignment-coach', {
      body: {
        mode: 'morning',
        trigger: 'capture_analysis',
        user_state: { roles: roleContext, domains: domainContext },
        messages: [
          {
            role: 'system',
            content: `You are the Development Director — a thoughtful coach helping someone organize their thoughts into action.

Your job: Parse the user's free-text input and break it into SEPARATE items. The user may mention multiple things in one sentence or paragraph. Split them intelligently.

For each item, return:
- title: a clean, concise action title (rewrite vague language into clear titles)
- suggested_type: one of "task", "event", "reflection", "rose", "thorn", "depositIdea"
  - task = a concrete, actionable commitment ("Do X by Y")
  - event = something with a specific time/date ("Meet with X at noon")
  - reflection = a thought or realization worth capturing
  - rose = something positive, grateful, or celebratory
  - thorn = a challenge, frustration, or difficulty
  - depositIdea = a "maybe someday" idea, not a firm commitment
- needs_clarification: boolean — set TRUE when the language is ambiguous
  Examples of ambiguity: "I want to..." (commitment or wish?), "I should..." (task or idea?), "Maybe I could..." (idea or task?)
- clarification_question: if needs_clarification is true, write a brief, conversational question to ask. Examples:
  "Are you committing to take your wife to lunch today, or is that an idea you're parking for later?"
  "Is the thank-you email something you'll do today, or more of a reminder for when you get to it?"
- alternative_type: if needs_clarification is true, what would the type be if the user answers differently (e.g. "depositIdea" if the suggested_type is "task")
- suggested_role_id: the role ID it most relates to, or null
- suggested_role_name: the role name, or null
- suggested_domain_id: the wellness domain ID, or null
- suggested_domain_name: the wellness domain name, or null
- reasoning: one brief sentence explaining your categorization

Available roles: ${roleContext}
Available wellness domains: ${domainContext}

Return a JSON object with a single "items" array. Return ONLY valid JSON, no markdown fences.
Example: {"items": [{"title": "...", "suggested_type": "task", ...}, {"title": "...", ...}]}`,
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
        suggested_domain_id: item.suggested_domain_id || null,
        suggested_domain_name: item.suggested_domain_name || null,
        reasoning: item.reasoning || '',
      }));
      return { items };
    }
  } catch (err) {
    console.error('Capture analysis failed, using fallback:', err);
  }

  // Fallback: treat as single item with heuristic typing
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
  } else if (lower.includes('meeting') || lower.includes('call') || lower.includes('at noon') || lower.includes('appointment')) {
    type = 'event';
  }

  return {
    items: [{
      title: text.trim(),
      suggested_type: type,
      needs_clarification: needsClarification,
      clarification_question: clarificationQ,
      alternative_type: altType,
      suggested_role_id: null,
      suggested_role_name: null,
      suggested_domain_id: null,
      suggested_domain_name: null,
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
    selectedDomainIds: item.suggested_domain_id ? [item.suggested_domain_id] : [],
    is_deposit_idea: item.suggested_type === 'depositIdea',
  };
}
