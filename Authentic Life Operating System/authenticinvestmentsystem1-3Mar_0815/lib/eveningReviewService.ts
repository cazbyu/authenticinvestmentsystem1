/**
 * Evening Review Service Layer
 *
 * Centralized data queries for the Evening Review ritual.
 * Handles task reconciliation, brain dump capture/routing,
 * role pulse checks, and session persistence.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

// ============ TYPES ============

export interface ReconciliationTask {
  id: string;
  title: string;
  status: string;
}

export interface RolePulseRole {
  role_id: string;
  role_name: string;
  tasks_completed_today: number;
  slot_code: string;
}

export interface RolePulseResponse {
  role_id: string;
  role_name: string;
  tasks_completed: number;
  response: 'felt_it' | 'neutral' | 'missed_it';
}

export interface EveningReviewSessionData {
  day_score: number;
  tasks_committed: number;
  tasks_completed: number;
  brain_dump_raw: string | null;
  brain_dump_processed: boolean;
  fuel_level: number | null;
  fuel_why: string | null;
  fuel_3_why: string | null;
  started_at: string;
  completed_at: string;
  role_pulse: RolePulseResponse[];
  carry_forward_count: number;
  release_count: number;
}

// ============ TASK RECONCILIATION ============

/**
 * Get today's committed tasks from ritual-committed-tasks join table.
 * These are the tasks the user committed to during Morning Spark.
 */
export async function getTodaysCommittedTasks(
  userId: string,
): Promise<ReconciliationTask[]> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  // 1. Get committed task IDs from join table
  const { data: committedRows, error: commitError } = await supabase
    .from('0008-ap-ritual-committed-tasks')
    .select('task_id')
    .eq('user_id', userId)
    .eq('committed_date', today);

  if (commitError) {
    console.error('[EveningReview] Error fetching committed task IDs:', commitError);
    return [];
  }

  const taskIds = (committedRows || []).map((r: { task_id: string }) => r.task_id);
  if (taskIds.length === 0) return [];

  // 2. Fetch task details
  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, title, status')
    .in('id', taskIds)
    .is('deleted_at', null);

  if (error) {
    console.error('[EveningReview] Error fetching task details:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
  }));
}

/**
 * Reconcile a single task: mark done, carry forward, or release.
 */
export async function reconcileTask(
  taskId: string,
  action: 'done' | 'carry_forward' | 'release',
): Promise<boolean> {
  const supabase = getSupabaseClient();

  let updatePayload: Record<string, unknown>;

  switch (action) {
    case 'done':
      updatePayload = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        one_thing: false,
      };
      break;
    case 'carry_forward':
      // Increment times_rescheduled and clear one_thing flag
      // We need to read current value first
      const { data: current } = await supabase
        .from('0008-ap-tasks')
        .select('times_rescheduled')
        .eq('id', taskId)
        .single();

      const currentCount = current?.times_rescheduled || 0;
      updatePayload = {
        times_rescheduled: currentCount + 1,
        one_thing: false,
      };
      break;
    case 'release':
      updatePayload = {
        status: 'cancelled',
        one_thing: false,
      };
      break;
    default:
      return false;
  }

  const { error } = await supabase
    .from('0008-ap-tasks')
    .update(updatePayload)
    .eq('id', taskId);

  if (error) {
    console.error('[EveningReview] Error reconciling task:', error);
    return false;
  }

  return true;
}

// ============ BRAIN DUMP ============

/**
 * Save raw brain dump text. Returns a placeholder sessionId
 * (the actual session row is upserted in saveEveningReviewSession).
 */
export async function saveBrainDump(
  userId: string,
  text: string,
): Promise<string> {
  // Brain dump text is stored on the ritual session row.
  // Return a temporary session reference; the real upsert happens in saveEveningReviewSession.
  console.log('[EveningReview] Brain dump captured for user:', userId, '— length:', text.length);
  return `brain_dump_${Date.now()}`;
}

/**
 * Route a single brain dump fragment to the appropriate table.
 */
export async function routeBrainDumpItem(
  userId: string,
  text: string,
  route: 'rose' | 'thorn' | 'idea' | 'task',
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    switch (route) {
      case 'rose': {
        const { error } = await supabase
          .from('0008-ap-reflections')
          .insert({
            content: text,
            user_id: userId,
            daily_rose: true,
            reflection_type: 'daily',
          });
        if (error) throw error;
        break;
      }
      case 'thorn': {
        const { error } = await supabase
          .from('0008-ap-reflections')
          .insert({
            content: text,
            user_id: userId,
            daily_thorn: true,
            reflection_type: 'daily',
          });
        if (error) throw error;
        break;
      }
      case 'idea': {
        const { error } = await supabase
          .from('0008-ap-deposit-ideas')
          .insert({
            title: text,
            user_id: userId,
            is_active: true,
          });
        if (error) throw error;
        break;
      }
      case 'task': {
        const { error } = await supabase
          .from('0008-ap-tasks')
          .insert({
            title: text,
            user_id: userId,
            status: 'pending',
            type: 'task',
          });
        if (error) throw error;
        break;
      }
      default:
        return false;
    }

    return true;
  } catch (error) {
    console.error('[EveningReview] Error routing brain dump item:', error);
    return false;
  }
}

// ============ ROLE PULSE ============

/**
 * Get top 3 roles (R1, R2, R3) from user-slot-mappings and count
 * tasks completed today for each via universal-roles-join.
 */
export async function getRolePulseData(
  userId: string,
): Promise<RolePulseRole[]> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  try {
    // Get the user's top 3 role slots (R1, R2, R3)
    // Get slot mappings for R1, R2, R3
    const { data: slotMappings, error: slotError } = await supabase
      .from('0008-ap-user-slot-mappings')
      .select('slot_code, mapped_entity_id, mapped_entity_label')
      .eq('user_id', userId)
      .in('slot_code', ['R1', 'R2', 'R3'])
      .order('slot_code', { ascending: true });

    if (slotError) {
      console.error('[EveningReview] Error fetching slot mappings:', slotError);
      return [];
    }

    if (!slotMappings || slotMappings.length === 0) {
      return [];
    }

    // Get role labels
    const roleIds = slotMappings.map((m: any) => m.mapped_entity_id).filter(Boolean);
    const { data: rolesData } = await supabase
      .from('0008-ap-roles')
      .select('id, label')
      .in('id', roleIds);

    // For each role, count tasks completed today
    const roles: RolePulseRole[] = [];

    for (const mapping of slotMappings) {
      const roleId = mapping.mapped_entity_id;
      const roleRecord = rolesData?.find((r: any) => r.id === roleId);
      const roleName = roleRecord?.label || mapping.mapped_entity_label || 'Unknown Role';

      // Get tasks linked to this role via universal-roles-join
      const { data: joinData } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('role_id', roleId)
        .eq('user_id', userId)
        .eq('parent_type', 'task');

      let tasksCompletedToday = 0;
      if (joinData && joinData.length > 0) {
        const taskIds = joinData.map((j: any) => j.parent_id).filter(Boolean);
        if (taskIds.length > 0) {
          const { count: directCount } = await supabase
            .from('0008-ap-tasks')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'completed')
            .in('id', taskIds)
            .not('completed_at', 'is', null)
            .gte('completed_at', `${today}T00:00:00`)
            .lt('completed_at', `${today}T23:59:59.999`);

          tasksCompletedToday = directCount || 0;
        }
      }

      roles.push({
        role_id: roleId,
        role_name: roleName,
        tasks_completed_today: tasksCompletedToday,
        slot_code: mapping.slot_code,
      });
    }

    return roles;
  } catch (error) {
    console.error('[EveningReview] Error getting role pulse data:', error);
    return [];
  }
}

// ============ SESSION PERSISTENCE ============

/**
 * Save (upsert) the evening review session for today.
 */
export async function saveEveningReviewSession(
  userId: string,
  data: EveningReviewSessionData,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const today = toLocalISOString(new Date()).split('T')[0];

  const payload = {
    user_id: userId,
    ritual_type: 'evening_review',
    session_date: today,
    day_score: data.day_score,
    tasks_committed: data.tasks_committed,
    tasks_completed: data.tasks_completed,
    brain_dump_raw: data.brain_dump_raw,
    brain_dump_processed: data.brain_dump_processed,
    fuel_level: data.fuel_level,
    fuel_1_why: data.fuel_why,
    fuel_3_why: data.fuel_3_why,
    started_at: data.started_at,
    completed_at: data.completed_at,
    role_pulse: data.role_pulse,
    carry_forward_count: data.carry_forward_count,
    release_count: data.release_count,
  };

  // Try to find existing session for today
  const { data: existing } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('ritual_type', 'evening_review')
    .eq('session_date', today)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('0008-ap-ritual-sessions')
      .update(payload)
      .eq('id', existing.id);

    if (error) {
      console.error('[EveningReview] Error updating session:', error);
      return null;
    }
    return existing.id;
  } else {
    // Insert new
    const { data: inserted, error } = await supabase
      .from('0008-ap-ritual-sessions')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('[EveningReview] Error inserting session:', error);
      return null;
    }
    return inserted?.id || null;
  }
}
