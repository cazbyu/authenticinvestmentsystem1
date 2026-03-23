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

export interface CommitmentTask {
  id: string;
  title: string;
  due_date: string | null;
  is_urgent: boolean;
  is_important: boolean;
  one_thing: boolean;
  status: string;
  type: string;
}

export interface GoalPulseData {
  id: string;
  title: string;
  end_date: string | null;
  execution_rate: number; // 0-100
  weeks_remaining: number | null;
}

export interface RoleFocusData {
  role_id: string;
  role_name: string;
  role_mission: string | null;
  slot_code: string;
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
 * Get pending tasks for today's commitment selection.
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
    .limit(10);

  if (error) {
    console.error('Error fetching tasks for commitment:', error);
    return [];
  }

  return (data || []).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    is_urgent: t.is_urgent,
    is_important: t.is_important,
    one_thing: t.one_thing || false,
    status: t.status,
    type: t.type,
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

/**
 * Get the most recent active 12-week goal with execution rate.
 */
export async function getGoalPulse(userId: string): Promise<GoalPulseData | null> {
  const supabase = getSupabaseClient();

  const { data: goal, error } = await supabase
    .from('0008-ap-goals-12wk')
    .select('id, title, end_date')
    .eq('user_id', userId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !goal) return null;

  // Calculate execution rate over last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = toLocalISOString(sevenDaysAgo);

  const { count: completedCount } = await supabase
    .from('0008-ap-tasks')
    .select('id', { count: 'exact', head: true })
    .eq('goal_12wk_id', goal.id)
    .eq('status', 'completed')
    .gte('completed_at', sevenDaysAgoStr);

  const { count: totalCount } = await supabase
    .from('0008-ap-tasks')
    .select('id', { count: 'exact', head: true })
    .eq('goal_12wk_id', goal.id)
    .gte('created_at', sevenDaysAgoStr);

  const total = totalCount || 0;
  const completed = completedCount || 0;
  const executionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate weeks remaining
  let weeksRemaining: number | null = null;
  if (goal.end_date) {
    const endDate = new Date(goal.end_date);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    weeksRemaining = Math.ceil(daysRemaining / 7);
  }

  return {
    id: goal.id,
    title: goal.title,
    end_date: goal.end_date,
    execution_rate: executionRate,
    weeks_remaining: weeksRemaining,
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

  return mappings.map((m) => {
    const role = roles.find((r) => r.id === m.mapped_entity_id);
    return {
      role_id: m.mapped_entity_id,
      role_name: role?.label || m.mapped_entity_label || 'Unknown Role',
      role_mission: role?.role_mission || null,
      slot_code: m.slot_code,
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
