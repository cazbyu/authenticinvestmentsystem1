// lib/tour-guide-state.ts
// Data gathering and state building for the Tour Guide AI

import { getSupabaseClient } from './supabase';
import type { 
  TourGuideUserState, 
  ActivitySummary,
  RoleSummary,
  WellnessZoneSummary,
  GoalSummary,
  QuestionResponse,
  ReflectionHighlight,
} from '../types/tour-guide';

// Helper: get Monday of current week
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper: get Sunday of current week
function getSunday(d: Date): Date {
  const monday = getMonday(new Date(d));
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// Call this once per Weekly Alignment session or per step as needed
export async function buildTourGuideState(
  userId: string,
  options: {
    includeRoles?: boolean;
    includeWellness?: boolean;
    includeGoals?: boolean;
    includeActivity?: boolean;
  } = {}
): Promise<TourGuideUserState> {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getMonday(new Date()).toISOString().split('T')[0];
  const weekEnd = getSunday(new Date()).toISOString().split('T')[0];

  // Run queries in parallel for speed
  const queries = [
    fetchNorthStar(userId),
    fetchQuestionResponses(userId),
    fetchAlignmentCount(userId),
  ];

  if (options.includeRoles) {
    queries.push(fetchRolesWithActivity(userId, weekStart, weekEnd));
  }
  
  if (options.includeActivity) {
    queries.push(fetchActivitySummary(userId, today, weekStart, weekEnd));
    queries.push(fetchRecentReflections(userId, weekStart));
    queries.push(fetchRecentNotes(userId, weekStart));
  }

  if (options.includeGoals) {
    queries.push(fetchGoals(userId, weekStart, weekEnd));
  }

  const results = await Promise.all(queries);
  
  let resultIndex = 0;
  const northStar = results[resultIndex++];
  const questionResponses = results[resultIndex++];
  const alignmentCount = results[resultIndex++];
  
  let roles: RoleSummary[] = [];
  let activity: ActivitySummary | undefined;
  let reflections: ReflectionHighlight[] = [];
  let notes: string[] = [];
  let goals: GoalSummary[] = [];

  if (options.includeRoles) {
    roles = results[resultIndex++] as RoleSummary[];
  }

  if (options.includeActivity) {
    activity = results[resultIndex++] as ActivitySummary;
    reflections = results[resultIndex++] as ReflectionHighlight[];
    notes = results[resultIndex++] as string[];
  }

  if (options.includeGoals) {
    goals = results[resultIndex++] as GoalSummary[];
  }

  // Identify neglected roles (active roles with zero tasks this week)
  const neglectedRoles = roles
    .filter(r => (r.tasks_this_week || 0) === 0)
    .map(r => r.label);

  return {
    core_identity: northStar?.core_identity || null,
    mission_statement: northStar?.mission_statement || null,
    five_year_vision: northStar?.five_year_vision || null,
    core_values: northStar?.core_values || null,
    life_motto: northStar?.life_motto || null,
    question_responses: questionResponses,
    roles: roles.length > 0 ? roles : undefined,
    goals: goals.length > 0 ? goals : undefined,
    activity: activity ? {
      ...activity,
      neglected_roles: neglectedRoles.length > 0 ? neglectedRoles : undefined,
      recent_reflections: reflections.length > 0 ? reflections : undefined,
      recent_notes: notes.length > 0 ? notes : undefined,
    } : undefined,
    total_alignments_completed: alignmentCount,
  };
}

// Query 1: North Star
async function fetchNorthStar(userId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('0008-ap-north-star')
    .select('core_identity, mission_statement, 5yr_vision, core_values, life_motto')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching North Star:', error);
    return null;
  }

  // Parse core_values from jsonb to string array
  let coreValues: string[] | null = null;
  if (data?.core_values) {
    if (Array.isArray(data.core_values)) {
      coreValues = data.core_values.map((v: any) => {
        if (typeof v === 'string') return v;
        if (typeof v === 'object' && v.name) return v.name;
        return String(v);
      });
    }
  }

  return {
    core_identity: data?.core_identity || null,
    mission_statement: data?.mission_statement || null,
    five_year_vision: data?.['5yr_vision'] || null,
    core_values: coreValues,
    life_motto: data?.life_motto || null,
  };
}

// Query 2: Question Responses
async function fetchQuestionResponses(userId: string): Promise<QuestionResponse[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('0008-ap-question-responses')
    .select(`
      response_text,
      domain,
      detected_roles,
      detected_wellness_zones,
      question:0008-ap-power-questions(question_text)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching question responses:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    question_text: r.question?.question_text || '',
    response_text: r.response_text || '',
    domain: r.domain || '',
    detected_roles: r.detected_roles || [],
    detected_wellness_zones: r.detected_wellness_zones || [],
  }));
}

// Query 3: Alignment Count
async function fetchAlignmentCount(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('0008-ap-weekly-alignments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null);

  if (error) {
    console.error('Error fetching alignment count:', error);
    return 0;
  }

  return count || 0;
}

// Query 4: Roles with Activity
async function fetchRolesWithActivity(
  userId: string, 
  weekStart: string, 
  weekEnd: string
): Promise<RoleSummary[]> {
  const supabase = getSupabaseClient();
  
  // First get all active roles
  const { data: rolesData, error: rolesError } = await supabase
    .from('0008-ap-roles')
    .select('id, label, category, purpose')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority_order', { ascending: true });

  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
    return [];
  }

  if (!rolesData || rolesData.length === 0) return [];

  // For each role, count tasks this week
  const rolesWithActivity: RoleSummary[] = await Promise.all(
    rolesData.map(async (role) => {
      // Count tasks linked to this role this week
      const { data: taskLinks } = await supabase
        .from('0008-ap-universal-roles-join')
        .select(`
          parent_id,
          task:0008-ap-tasks(
            id,
            status,
            is_deposit_idea,
            due_date,
            completed_at
          )
        `)
        .eq('user_id', userId)
        .eq('role_id', role.id)
        .eq('parent_type', 'task')
        .gte('task.due_date', weekStart)
        .lte('task.due_date', weekEnd)
        .neq('task.status', 'cancelled');

      const tasks = (taskLinks || []).map((link: any) => link.task).filter(Boolean);
      const completed = tasks.filter((t: any) => t.status === 'completed').length;
      const deposits = tasks.filter((t: any) => t.is_deposit_idea === true).length;

      return {
        label: role.label,
        category: role.category || '',
        purpose: role.purpose || undefined,
        tasks_this_week: tasks.length,
        tasks_completed_this_week: completed,
        deposits_this_week: deposits,
      };
    })
  );

  return rolesWithActivity;
}

// Query 7: Activity Summary
async function fetchActivitySummary(
  userId: string,
  today: string,
  weekStart: string,
  weekEnd: string
): Promise<ActivitySummary> {
  const supabase = getSupabaseClient();

  // Tasks this week
  const { count: tasksThisWeek } = await supabase
    .from('0008-ap-tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('due_date', weekStart)
    .lte('due_date', weekEnd)
    .neq('status', 'cancelled');

  // Completed this week
  const { count: completedThisWeek } = await supabase
    .from('0008-ap-tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('due_date', weekStart)
    .lte('due_date', weekEnd)
    .eq('status', 'completed');

  // Overdue tasks
  const { count: overdue } = await supabase
    .from('0008-ap-tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lt('due_date', today)
    .not('status', 'in', '(completed,cancelled)');

  // Deposits this week
  const { count: deposits } = await supabase
    .from('0008-ap-tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('due_date', weekStart)
    .lte('due_date', weekEnd)
    .eq('is_deposit_idea', true)
    .neq('status', 'cancelled');

  // Recent completed titles
  const { data: recentCompleted } = await supabase
    .from('0008-ap-tasks')
    .select('title')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', weekStart)
    .order('completed_at', { ascending: false })
    .limit(5);

  // Pending tasks
  const { data: pendingTasks } = await supabase
    .from('0008-ap-tasks')
    .select('title')
    .eq('user_id', userId)
    .gte('due_date', today)
    .lte('due_date', weekEnd)
    .not('status', 'in', '(completed,cancelled)')
    .order('due_date', { ascending: true })
    .limit(5);

  const completionRate = tasksThisWeek && tasksThisWeek > 0
    ? Math.round((completedThisWeek || 0) / tasksThisWeek * 100)
    : 0;

  return {
    tasks_this_week: tasksThisWeek || 0,
    tasks_completed_this_week: completedThisWeek || 0,
    tasks_overdue: overdue || 0,
    deposits_this_week: deposits || 0,
    recent_completed_titles: (recentCompleted || []).map(t => t.title),
    recent_task_titles: (pendingTasks || []).map(t => t.title),
    completion_rate_this_week: completionRate,
  };
}

// Query 6: Goals
async function fetchGoals(
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<GoalSummary[]> {
  const supabase = getSupabaseClient();

  const { data: goals, error } = await supabase
    .from('0008-ap-goals-12wk')
    .select('id, title, target_date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching goals:', error);
    return [];
  }

  if (!goals || goals.length === 0) return [];

  // For each goal, count linked tasks
  const goalsWithActivity: GoalSummary[] = await Promise.all(
    goals.map(async (goal) => {
      const { count: linkedTasks } = await supabase
        .from('0008-ap-task-12wkgoals')
        .select('task:0008-ap-tasks(id)', { count: 'exact', head: true })
        .eq('goal_id', goal.id);

      const { count: completedTasks } = await supabase
        .from('0008-ap-task-12wkgoals')
        .select('task:0008-ap-tasks!inner(id)', { count: 'exact', head: true })
        .eq('goal_id', goal.id)
        .eq('task.status', 'completed');

      const progressPercent = linkedTasks && linkedTasks > 0
        ? Math.round((completedTasks || 0) / linkedTasks * 100)
        : 0;

      return {
        title: goal.title,
        target_date: goal.target_date || undefined,
        tasks_linked: linkedTasks || 0,
        tasks_completed: completedTasks || 0,
        progress_percent: progressPercent,
      };
    })
  );

  return goalsWithActivity;
}

// Query 9: Recent Reflections
async function fetchRecentReflections(
  userId: string,
  weekStart: string
): Promise<ReflectionHighlight[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-reflections')
    .select('reflection_type, content, date, question_proud, question_impact, daily_rose, daily_thorn')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching reflections:', error);
    return [];
  }

  return (data || []).map((r: any) => {
    let type: ReflectionHighlight['type'] = 'reflection';
    
    if (r.daily_rose) type = 'rose';
    else if (r.daily_thorn) type = 'thorn';
    else if (r.reflection_type) type = r.reflection_type;

    return {
      type,
      content: (r.content || '').substring(0, 100),
      date: r.date,
      question_proud: r.question_proud || undefined,
      question_impact: r.question_impact || undefined,
    };
  });
}

// Query 10: Recent Notes
async function fetchRecentNotes(userId: string, weekStart: string): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-notes')
    .select('content')
    .eq('user_id', userId)
    .gte('created_at', weekStart)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching notes:', error);
    return [];
  }

  return (data || []).map(n => (n.content || '').substring(0, 80));
}

// Lightweight version for Step 1 (only North Star + alignment count)
export async function buildStep1State(userId: string): Promise<TourGuideUserState> {
  return buildTourGuideState(userId, {
    includeRoles: false,
    includeWellness: false,
    includeGoals: false,
    includeActivity: false,
  });
}

// Medium version for Step 2 (adds roles)
export async function buildStep2State(userId: string): Promise<TourGuideUserState> {
  return buildTourGuideState(userId, {
    includeRoles: true,
    includeWellness: false,
    includeGoals: false,
    includeActivity: true,
  });
}

// Full version for Steps 4-5 (everything)
export async function buildFullState(userId: string): Promise<TourGuideUserState> {
  return buildTourGuideState(userId, {
    includeRoles: true,
    includeWellness: true,
    includeGoals: true,
    includeActivity: true,
  });
}
