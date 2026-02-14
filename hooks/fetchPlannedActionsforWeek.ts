// hooks/fetchPlannedActionsForWeek.ts
import { getSupabaseClient } from '@/lib/supabase';

// Inline date formatter (YYYY-MM-DD in local time)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Result shape for the scoreboard
 */
export interface PlannedActionsResult {
  leadingIndicators: {
    count: number;           // Number of recurring actions scheduled this week
    totalTarget: number;     // Sum of target_days across all actions
    totalActual: number;     // Sum of completed occurrences this week
    actions: LeadingIndicatorSummary[];
  };
  boostActions: {
    count: number;           // Total boost actions due this week
    completed: number;       // Completed boost actions
    pending: number;         // Pending boost actions
    actions: BoostActionSummary[];
  };
  week: {
    weekNumber: number;
    startDate: string;
    endDate: string;
  } | null;
  timeline: {
    id: string;
    source: 'global' | 'custom';
    title?: string;
  } | null;
}

export interface LeadingIndicatorSummary {
  id: string;
  title: string;
  targetDays: number;
  actualDays: number;
  goalId: string;
  goalTitle?: string;
}

export interface BoostActionSummary {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  completed: boolean;
  goalId: string;
  goalTitle?: string;
}

/**
 * Fetch planned actions (leading indicators + boost) for the current week.
 * This is designed for scoreboard/summary views that need counts and totals.
 * 
 * Data flow:
 * - Leading Indicators: tasks → task-week-plan (has timeline_id directly)
 * - Boost Actions: tasks → goals-join → goals (12wk or custom) → timeline_id
 */
export async function fetchPlannedActionsForWeek(): Promise<PlannedActionsResult> {
  const emptyResult: PlannedActionsResult = {
    leadingIndicators: { count: 0, totalTarget: 0, totalActual: 0, actions: [] },
    boostActions: { count: 0, completed: 0, pending: 0, actions: [] },
    week: null,
    timeline: null,
  };

  try {
    const supabase = getSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    
    if (!user) {
      console.log('[fetchPlannedActionsForWeek] No authenticated user');
      return emptyResult;
    }

    // ============================================
    // STEP 1: Get active timeline (global first, then custom)
    // ============================================
    const timeline = await getActiveTimeline(supabase, user.id);
    
    if (!timeline) {
      console.log('[fetchPlannedActionsForWeek] No active timeline found');
      return emptyResult;
    }

    console.log('[fetchPlannedActionsForWeek] Active timeline:', {
      id: timeline.id,
      source: timeline.source,
      title: timeline.title,
    });

    // ============================================
    // STEP 2: Get current week from unified view
    // ============================================
    const currentWeek = await getCurrentWeek(supabase, user.id, timeline);
    
    if (!currentWeek) {
      console.log('[fetchPlannedActionsForWeek] Could not determine current week');
      return { ...emptyResult, timeline };
    }

    console.log('[fetchPlannedActionsForWeek] Current week:', currentWeek);

    // ============================================
    // STEP 3: Fetch leading indicators (recurring actions in task-week-plan)
    // ============================================
    const leadingIndicators = await fetchLeadingIndicators(
      supabase,
      user.id,
      timeline,
      currentWeek
    );

    // ============================================
    // STEP 4: Fetch boost actions (one-time tasks linked to goals)
    // ============================================
    const boostActions = await fetchBoostActions(
      supabase,
      user.id,
      timeline,
      currentWeek
    );

    const result: PlannedActionsResult = {
      leadingIndicators,
      boostActions,
      week: currentWeek,
      timeline: {
        id: timeline.id,
        source: timeline.source,
        title: timeline.title,
      },
    };

    console.log('[fetchPlannedActionsForWeek] Final result:', {
      leadingIndicators: {
        count: result.leadingIndicators.count,
        totalTarget: result.leadingIndicators.totalTarget,
        totalActual: result.leadingIndicators.totalActual,
      },
      boostActions: {
        count: result.boostActions.count,
        completed: result.boostActions.completed,
        pending: result.boostActions.pending,
      },
    });

    return result;

  } catch (error) {
    console.error('[fetchPlannedActionsForWeek] Unexpected error:', error);
    return emptyResult;
  }
}

/**
 * Get the user's active timeline (prefers global over custom)
 */
async function getActiveTimeline(
  supabase: any,
  userId: string
): Promise<{ id: string; source: 'global' | 'custom'; title?: string } | null> {
  
  // Try global timeline first
  const { data: globalTimeline, error: globalError } = await supabase
    .from('0008-ap-user-global-timelines')
    .select(`
      id,
      title,
      global_cycle:0008-ap-global-cycles(title, cycle_label)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (globalError) {
    console.error('[getActiveTimeline] Error fetching global timeline:', globalError);
  }

  if (globalTimeline) {
    return {
      id: globalTimeline.id,
      source: 'global',
      title: globalTimeline.title || globalTimeline.global_cycle?.title || globalTimeline.global_cycle?.cycle_label,
    };
  }

  // Fall back to custom timeline
  const { data: customTimeline, error: customError } = await supabase
    .from('0008-ap-custom-timelines')
    .select('id, title')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (customError) {
    console.error('[getActiveTimeline] Error fetching custom timeline:', customError);
  }

  if (customTimeline) {
    return {
      id: customTimeline.id,
      source: 'custom',
      title: customTimeline.title,
    };
  }

  return null;
}

/**
 * Get the current week based on today's date
 */
async function getCurrentWeek(
  supabase: any,
  userId: string,
  timeline: { id: string; source: 'global' | 'custom' }
): Promise<{ weekNumber: number; startDate: string; endDate: string } | null> {
  
  const today = formatLocalDate(new Date());

  const { data: weekData, error } = await supabase
    .from('v_unified_timeline_weeks')
    .select('week_number, week_start, week_end')
    .eq('timeline_id', timeline.id)
    .eq('source', timeline.source)
    .lte('week_start', today)
    .gte('week_end', today)
    .maybeSingle();

  if (error) {
    console.error('[getCurrentWeek] Error fetching current week:', error);
    return null;
  }

  if (!weekData) {
    // If today is outside the timeline, try to get the closest week
    console.log('[getCurrentWeek] Today not in any week, checking timeline bounds');
    
    const { data: allWeeks } = await supabase
      .from('v_unified_timeline_weeks')
      .select('week_number, week_start, week_end')
      .eq('timeline_id', timeline.id)
      .eq('source', timeline.source)
      .order('week_number', { ascending: true });

    if (allWeeks && allWeeks.length > 0) {
      // If before timeline, return first week
      if (today < allWeeks[0].week_start) {
        return {
          weekNumber: allWeeks[0].week_number,
          startDate: allWeeks[0].week_start,
          endDate: allWeeks[0].week_end,
        };
      }
      // If after timeline, return last week
      const lastWeek = allWeeks[allWeeks.length - 1];
      if (today > lastWeek.week_end) {
        return {
          weekNumber: lastWeek.week_number,
          startDate: lastWeek.week_start,
          endDate: lastWeek.week_end,
        };
      }
    }
    
    return null;
  }

  return {
    weekNumber: weekData.week_number,
    startDate: weekData.week_start,
    endDate: weekData.week_end,
  };
}

/**
 * Fetch leading indicators (recurring actions) for the current week
 */
async function fetchLeadingIndicators(
  supabase: any,
  userId: string,
  timeline: { id: string; source: 'global' | 'custom' },
  week: { weekNumber: number; startDate: string; endDate: string }
): Promise<PlannedActionsResult['leadingIndicators']> {
  
  const emptyResult = { count: 0, totalTarget: 0, totalActual: 0, actions: [] };

  try {
    // Determine the correct timeline column
    const timelineColumn = timeline.source === 'global' 
      ? 'user_global_timeline_id' 
      : 'user_custom_timeline_id';

    // Query task-week-plan for this week
    const { data: weekPlans, error: wpError } = await supabase
      .from('0008-ap-task-week-plan')
      .select(`
        task_id,
        target_days,
        task:0008-ap-tasks!inner(
          id,
          title,
          user_id,
          status,
          deleted_at
        )
      `)
      .eq(timelineColumn, timeline.id)
      .eq('week_number', week.weekNumber)
      .is('deleted_at', null);

    if (wpError) {
      console.error('[fetchLeadingIndicators] Error fetching week plans:', wpError);
      return emptyResult;
    }

    if (!weekPlans || weekPlans.length === 0) {
      return emptyResult;
    }

    // Filter out deleted/cancelled tasks and tasks not belonging to user
    const validPlans = weekPlans.filter((wp: any) => 
      wp.task && 
      wp.task.user_id === userId &&
      wp.task.deleted_at === null &&
      !['completed', 'cancelled'].includes(wp.task.status)
    );

    if (validPlans.length === 0) {
      return emptyResult;
    }

    const taskIds = validPlans.map((wp: any) => wp.task_id);

    // Get goal associations for these tasks
    const { data: goalJoins } = await supabase
      .from('0008-ap-universal-goals-join')
      .select(`
        parent_id,
        twelve_wk_goal_id,
        custom_goal_id,
        goal_12wk:0008-ap-goals-12wk(id, title),
        goal_custom:0008-ap-goals-custom(id, title)
      `)
      .in('parent_id', taskIds)
      .eq('parent_type', 'task');

    // Count completed occurrences for each task this week (using recurrence-expanded view)
    const { data: completedOccurrences, error: occError } = await supabase
      .from('v_tasks_with_recurrence_expanded')
      .select('source_task_id')
      .eq('user_id', userId)
      .in('source_task_id', taskIds)
      .not('completed_at', 'is', null)
      .gte('occurrence_date', week.startDate)
      .lte('occurrence_date', week.endDate);

    if (occError) {
      console.error('[fetchLeadingIndicators] Error fetching occurrences:', occError);
    }

    // Count occurrences per task (keyed by source_task_id = template id)
    const occurrenceCounts: Record<string, number> = {};
    (completedOccurrences || []).forEach((occ: any) => {
      occurrenceCounts[occ.source_task_id] = (occurrenceCounts[occ.source_task_id] || 0) + 1;
    });

    // Build action summaries
    const actions: LeadingIndicatorSummary[] = validPlans.map((wp: any) => {
      const goalJoin = goalJoins?.find((gj: any) => gj.parent_id === wp.task_id);
      const goalId = goalJoin?.twelve_wk_goal_id || goalJoin?.custom_goal_id || '';
      const goalTitle = goalJoin?.goal_12wk?.title || goalJoin?.goal_custom?.title;

      return {
        id: wp.task_id,
        title: wp.task.title,
        targetDays: wp.target_days,
        actualDays: occurrenceCounts[wp.task_id] || 0,
        goalId,
        goalTitle,
      };
    });

    const totalTarget = actions.reduce((sum, a) => sum + a.targetDays, 0);
    const totalActual = actions.reduce((sum, a) => sum + Math.min(a.actualDays, a.targetDays), 0);

    return {
      count: actions.length,
      totalTarget,
      totalActual,
      actions,
    };

  } catch (error) {
    console.error('[fetchLeadingIndicators] Unexpected error:', error);
    return emptyResult;
  }
}

/**
 * Fetch boost actions (one-time tasks) for the current week
 * Boost actions get their timeline through the goal they're linked to
 */
async function fetchBoostActions(
  supabase: any,
  userId: string,
  timeline: { id: string; source: 'global' | 'custom' },
  week: { weekNumber: number; startDate: string; endDate: string }
): Promise<PlannedActionsResult['boostActions']> {
  
  const emptyResult = { count: 0, completed: 0, pending: 0, actions: [] };

  try {
    // For global timelines: join through goals-12wk
    // For custom timelines: join through goals-custom
    // We need to handle both since universal-goals-join can point to either

    let boostTasks: any[] = [];

    if (timeline.source === 'global') {
      // Query boost actions linked to 12-week goals on this timeline
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select(`
          id,
          title,
          due_date,
          status,
          goal_join:0008-ap-universal-goals-join!inner(
            twelve_wk_goal_id,
            goal:0008-ap-goals-12wk!inner(
              id,
              title,
              user_global_timeline_id
            )
          )
        `)
        .eq('user_id', userId)
        .is('recurrence_rule', null)
        .is('parent_task_id', null)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('due_date', week.startDate)
        .lte('due_date', week.endDate)
        .eq('goal_join.goal.user_global_timeline_id', timeline.id);

      if (error) {
        console.error('[fetchBoostActions] Error fetching global boost tasks:', error);
      } else {
        boostTasks = data || [];
      }
    } else {
      // Query boost actions linked to custom goals on this timeline
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select(`
          id,
          title,
          due_date,
          status,
          goal_join:0008-ap-universal-goals-join!inner(
            custom_goal_id,
            goal:0008-ap-goals-custom!inner(
              id,
              title,
              custom_timeline_id
            )
          )
        `)
        .eq('user_id', userId)
        .is('recurrence_rule', null)
        .is('parent_task_id', null)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('due_date', week.startDate)
        .lte('due_date', week.endDate)
        .eq('goal_join.goal.custom_timeline_id', timeline.id);

      if (error) {
        console.error('[fetchBoostActions] Error fetching custom boost tasks:', error);
      } else {
        boostTasks = data || [];
      }
    }

    if (boostTasks.length === 0) {
      return emptyResult;
    }

    // Build action summaries
    const actions: BoostActionSummary[] = boostTasks.map((task: any) => {
      const goalJoin = Array.isArray(task.goal_join) ? task.goal_join[0] : task.goal_join;
      const goal = goalJoin?.goal;
      
      return {
        id: task.id,
        title: task.title,
        dueDate: task.due_date,
        status: task.status,
        completed: task.status === 'completed',
        goalId: goal?.id || '',
        goalTitle: goal?.title,
      };
    });

    const completed = actions.filter(a => a.completed).length;
    const pending = actions.filter(a => !a.completed).length;

    return {
      count: actions.length,
      completed,
      pending,
      actions,
    };

  } catch (error) {
    console.error('[fetchBoostActions] Unexpected error:', error);
    return emptyResult;
  }
}

/**
 * Convenience function to get just the counts (for scoreboard)
 */
export async function getPlannedActionsCounts(): Promise<{
  leadingIndicatorCount: number;
  leadingIndicatorTarget: number;
  leadingIndicatorActual: number;
  boostCount: number;
  boostCompleted: number;
  boostPending: number;
  weekNumber: number | null;
}> {
  const result = await fetchPlannedActionsForWeek();
  
  return {
    leadingIndicatorCount: result.leadingIndicators.count,
    leadingIndicatorTarget: result.leadingIndicators.totalTarget,
    leadingIndicatorActual: result.leadingIndicators.totalActual,
    boostCount: result.boostActions.count,
    boostCompleted: result.boostActions.completed,
    boostPending: result.boostActions.pending,
    weekNumber: result.week?.weekNumber ?? null,
  };
}