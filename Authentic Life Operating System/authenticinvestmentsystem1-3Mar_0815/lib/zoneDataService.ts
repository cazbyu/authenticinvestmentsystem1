import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';
import { calculateGoalProgress, fetchGoalsForJoinRows } from './taskUtils';

/**
 * Zone data service — deposits + ideas fetchers for a single domain (zone).
 *
 * Extracted from the inline `fetchDomainTasks` in `app/(tabs)/wellness.tsx`
 * during Phase B 3b. Queries are unchanged from the original; state-setting
 * and Alert logic stay in the caller. `abortSignal` is advisory — Supabase
 * queries are not cancellable, so the caller must still gate its own state
 * updates on its controller.
 */

export async function fetchZoneDeposits(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  abortSignal?: AbortSignal,
): Promise<any[]> {
  // First, get task IDs that are associated with this specific domain
  const { data: domainJoinData, error: domainJoinError } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'task')
    .eq('domain_id', domainId);

  if (domainJoinError) throw domainJoinError;

  const domainTaskIds = domainJoinData?.map(dj => dj.parent_id) || [];

  if (domainTaskIds.length === 0) {
    return [];
  }

  // Now fetch only the tasks that have this domain
  const { data: tasksData, error: tasksError } = await supabase
    .from('v_user_tasks')
    .select('*, custom_timeline_id')
    .eq('user_id', userId)
    .in('id', domainTaskIds)
    .is('deleted_at', null)
    .is('parent_task_id', null)
    .not('status', 'in', '(completed,cancelled)')
    .in('type', ['task', 'event']);

  if (tasksError) throw tasksError;

  if (abortSignal?.aborted) return [];

  // Filter out Goal Bank actions by checking for week plans
  let allTasks: any[] = [];

  if (tasksData && tasksData.length > 0) {
    const taskIds = tasksData.map(t => t.id);
    const { data: weekPlans, error: weekPlansError } = await supabase
      .from('0008-ap-task-week-plan')
      .select('task_id')
      .in('task_id', taskIds)
      .is('deleted_at', null);

    if (weekPlansError) throw weekPlansError;

    if (abortSignal?.aborted) return [];

    // Create a Set of task IDs that have week plans (Goal Bank actions)
    const goalBankActionIds = new Set(weekPlans?.map(wp => wp.task_id) || []);

    // Only include standalone tasks (tasks WITHOUT week plans)
    allTasks = tasksData.filter(task => !goalBankActionIds.has(task.id));
  }

  // Fetch join data only if we have tasks
  let rolesData: any[] = [];
  let domainsData: any[] = [];
  let goalsData: any[] = [];
  let notesData: any[] = [];
  let keyRelationshipsData: any[] = [];

  if (allTasks.length > 0) {
    const taskIdsForJoins = allTasks.map(t => t.id);

    const [
      { data: rolesDataResult, error: rolesError },
      { data: domainsDataResult, error: domainsError },
      { data: goalsDataResult, error: goalsError },
      { data: notesDataResult, error: notesError },
      { data: keyRelationshipsDataResult, error: keyRelationshipsError }
    ] = await Promise.all([
      supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-goals-join').select('parent_id, goal_id, goal_type').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task')
    ]);

    if (rolesError) throw rolesError;
    if (domainsError) throw domainsError;
    if (goalsError) throw goalsError;
    if (notesError) throw notesError;
    if (keyRelationshipsError) throw keyRelationshipsError;

    rolesData = rolesDataResult || [];
    domainsData = domainsDataResult || [];
    goalsData = goalsDataResult || [];
    notesData = notesDataResult || [];
    keyRelationshipsData = keyRelationshipsDataResult || [];
  }

  const goalsById = await fetchGoalsForJoinRows(supabase, goalsData);

  if (abortSignal?.aborted) return [];

  return allTasks.map(task => ({
    ...task,
    roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
    domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
    goals: goalsData?.filter(g => g.parent_id === task.id).map(g => goalsById.get(g.goal_id)).filter(Boolean) || [],
    keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
    has_notes: notesData?.some(n => n.parent_id === task.id),
    has_delegates: false,
    has_attachments: false,
  }));
}

export async function fetchZoneIdeas(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  abortSignal?: AbortSignal,
): Promise<any[]> {
  // First, get deposit idea IDs that are associated with this specific domain
  const { data: domainJoinData, error: domainJoinError } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'depositIdea')
    .eq('domain_id', domainId);

  if (domainJoinError) throw domainJoinError;

  const domainDepositIdeaIds = domainJoinData?.map(dj => dj.parent_id) || [];

  if (domainDepositIdeaIds.length === 0) {
    return [];
  }

  // Now fetch only the deposit ideas that have this domain
  const { data: depositIdeasData, error: depositIdeasError } = await supabase
    .from('0008-ap-deposit-ideas')
    .select('*')
    .eq('user_id', userId)
    .in('id', domainDepositIdeaIds)
    .eq('archived', false)
    .eq('is_active', true)
    .is('activated_task_id', null);

  if (depositIdeasError) throw depositIdeasError;

  if (abortSignal?.aborted) return [];

  // Fetch join data only if we have deposit ideas
  let rolesData: any[] = [];
  let domainsData: any[] = [];
  let krData: any[] = [];
  let notesData: any[] = [];

  if (depositIdeasData && depositIdeasData.length > 0) {
    const depositIdeaIds = depositIdeasData.map(di => di.id);

    const [
      { data: rolesDataResult, error: rolesError },
      { data: domainsDataResult, error: domainsError },
      { data: krDataResult, error: krError },
      { data: notesDataResult, error: notesError }
    ] = await Promise.all([
      supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
      supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
      supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
      supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
    ]);

    if (rolesError) throw rolesError;
    if (domainsError) throw domainsError;
    if (krError) throw krError;
    if (notesError) throw notesError;

    rolesData = rolesDataResult || [];
    domainsData = domainsDataResult || [];
    krData = krDataResult || [];
    notesData = notesDataResult || [];
  }

  if (abortSignal?.aborted) return [];

  return (depositIdeasData || []).map(di => ({
    ...di,
    roles: rolesData?.filter(r => r.parent_id === di.id).map(r => r.role).filter(Boolean) || [],
    domains: domainsData?.filter(d => d.parent_id === di.id).map(d => d.domain).filter(Boolean) || [],
    keyRelationships: krData?.filter(kr => kr.parent_id === di.id).map(kr => kr.key_relationship).filter(Boolean) || [],
    has_notes: notesData?.some(n => n.parent_id === di.id),
    has_attachments: false,
  }));
}

/**
 * Fetch active goals (both 12wk and custom) tagged to a domain.
 *
 * Queries `0008-ap-universal-domains-join` for parent rows where
 * `parent_type` in {'twelve_wk_goal', 'custom_goal'} and `domain_id`
 * matches, splits by parent_type, then fetches each goal table in
 * parallel with `status = 'active'`. Returns a unified array with a
 * `goal_type` discriminator on each row ('twelve_wk_goal' | 'custom_goal').
 *
 * Bypasses `useGoals`' timeline-source filter (which would return only
 * one goal type based on the active timeline). Zone goals are considered
 * independent of timeline-source selection.
 *
 * Throws on query error. `abortSignal` is advisory (Supabase HTTP is
 * not cancellable) — caller must still gate its own state updates.
 */
export async function fetchZoneGoals(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  abortSignal?: AbortSignal,
): Promise<any[]> {
  // Get goal IDs tagged to this domain, split by goal type
  const { data: domainJoinData, error: domainJoinError } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id, parent_type')
    .in('parent_type', ['twelve_wk_goal', 'custom_goal'])
    .eq('domain_id', domainId);

  if (domainJoinError) throw domainJoinError;
  if (abortSignal?.aborted) return [];

  const twelveWkIds: string[] = [];
  const customIds: string[] = [];
  for (const row of domainJoinData ?? []) {
    if (row.parent_type === 'twelve_wk_goal') twelveWkIds.push(row.parent_id);
    else if (row.parent_type === 'custom_goal') customIds.push(row.parent_id);
  }

  if (twelveWkIds.length === 0 && customIds.length === 0) {
    return [];
  }

  // Date-gate to the current cycle: "active goal" in ALOS means both
  // status='active' AND today is within the goal's date window. The
  // status column lags reality (past-cycle rows stay 'active' in the
  // DB until backlog item 7's auto-flip trigger lands). Columns are
  // DATE type; compared as local YYYY-MM-DD via formatLocalDate.
  const todayStr = formatLocalDate(new Date());

  // Parallel-fetch active goals from both tables.
  // Pattern matches fetchGoalsForJoinRows in taskUtils: empty arm uses
  // a plain { data, error } placeholder so Promise.all resolves cleanly.
  const [twelveWkResult, customResult] = await Promise.all([
    twelveWkIds.length
      ? supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .in('id', twelveWkIds)
      : { data: [] as any[], error: null },
    customIds.length
      ? supabase
          .from('0008-ap-goals-custom')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .in('id', customIds)
      : { data: [] as any[], error: null },
  ]);

  if (twelveWkResult.error) throw twelveWkResult.error;
  if (customResult.error) throw customResult.error;
  if (abortSignal?.aborted) return [];

  // Annotate with goal_type discriminator and unify
  const twelveWk = (twelveWkResult.data ?? []).map(g => ({
    ...g,
    goal_type: 'twelve_wk_goal' as const,
  }));
  const custom = (customResult.data ?? []).map(g => ({
    ...g,
    goal_type: 'custom_goal' as const,
  }));

  return [...twelveWk, ...custom];
}

/**
 * Compute live progress for each goal, keyed by goal id.
 *
 * Mirrors the per-goal pattern in `app/(tabs)/roles.tsx` — calls
 * `calculateGoalProgress` from taskUtils for each goal, mapping
 * `goal_type` to the progress-calc type enum ('twelve_wk_goal' ->
 * '12week', 'custom_goal' -> 'custom').
 *
 * Deliberately more defensive than roles.tsx: per-goal try/catch means
 * one bad goal (e.g. corrupted log row) is skipped and logged, while
 * the rest still render. roles.tsx uses Promise.all without per-goal
 * guards, so one failure breaks all progress. If that fails visibly in
 * roles later, mirror this pattern there.
 *
 * Target defaults (`|| 3`, `|| 36`) match roles.tsx's existing fallback.
 * Imperfect for custom goals (useGoals hydrates them to total_target=100) —
 * filed as backlog for a future "progress calc unification" pass.
 */
export async function fetchZoneGoalsProgress(
  supabase: SupabaseClient,
  goals: any[],
  abortSignal?: AbortSignal,
): Promise<Record<string, any>> {
  if (goals.length === 0) return {};

  const entries = await Promise.all(
    goals.map(async goal => {
      const calcType: '12week' | 'custom' =
        goal.goal_type === 'custom_goal' ? 'custom' : '12week';
      try {
        const progress = await calculateGoalProgress(
          supabase,
          goal.id,
          calcType,
          goal.weekly_target || 3,
          goal.total_target || 36,
        );
        return [goal.id, progress] as const;
      } catch (err) {
        console.error(`fetchZoneGoalsProgress: failed for goal ${goal.id}:`, err);
        return null;
      }
    }),
  );

  if (abortSignal?.aborted) return {};

  const map: Record<string, any> = {};
  for (const entry of entries) {
    if (entry) map[entry[0]] = entry[1];
  }
  return map;
}
