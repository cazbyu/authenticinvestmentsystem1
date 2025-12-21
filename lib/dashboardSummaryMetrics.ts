import { getSupabaseClient } from './supabase';
import { calculateTaskPoints } from './taskUtils';

export type TimePeriod = 'today' | 'week' | 'month' | 'all';

export interface DashboardMetrics {
  tasks: {
    count: number;
    score: number;
  };
  events: {
    count: number;
    score: number;
  };
  depositIdeas: {
    pending: number;
    activated: number;
  };
  roses: number;
  thorns: number;
  reflections: number;
}

function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();

  switch (period) {
    case 'today':
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return { start: todayStart, end: todayEnd };

    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };

    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 27);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: monthStart, end: monthEnd };

    case 'all':
      const allStart = new Date('2000-01-01');
      allStart.setHours(0, 0, 0, 0);
      const allEnd = new Date(now);
      allEnd.setHours(23, 59, 59, 999);
      return { start: allStart, end: allEnd };
  }
}

export async function fetchDashboardMetrics(
  userId: string,
  period: TimePeriod = 'week'
): Promise<DashboardMetrics> {
  const { start, end } = getDateRange(period);
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const supabase = getSupabaseClient();

  try {
    const completedTasksQuery = supabase
      .from('0008-ap-tasks')
      .select('id, title, type, is_urgent, is_important, is_twelve_week_goal, completed_at')
      .eq('user_id', userId)
      .eq('type', 'task')
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('completed_at', startStr)
      .lte('completed_at', endStr);

    const completedEventsQuery = supabase
      .from('0008-ap-tasks')
      .select('id, title, type, is_urgent, is_important, is_twelve_week_goal, completed_at')
      .eq('user_id', userId)
      .eq('type', 'event')
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('completed_at', startStr)
      .lte('completed_at', endStr);

    const pendingDepositIdeasQuery = supabase
      .from('0008-ap-deposit-ideas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('archived', false)
      .is('activated_at', null);

    const activatedDepositIdeasQuery = supabase
      .from('0008-ap-deposit-ideas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('archived', false)
      .not('activated_at', 'is', null)
      .gte('activated_at', startStr)
      .lte('activated_at', endStr);

    const rosesQuery = supabase
      .from('0008-ap-reflections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('daily_rose', true)
      .eq('archived', false)
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const thornsQuery = supabase
      .from('0008-ap-reflections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('daily_thorn', true)
      .eq('archived', false)
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const reflectionsQuery = supabase
      .from('0008-ap-reflections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('daily_rose', false)
      .eq('daily_thorn', false)
      .eq('archived', false)
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const notesQuery = supabase
      .from('0008-ap-notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const [
      tasksResult,
      eventsResult,
      pendingDepositIdeasResult,
      activatedDepositIdeasResult,
      rosesResult,
      thornsResult,
      reflectionsResult,
      notesResult
    ] = await Promise.all([
      completedTasksQuery,
      completedEventsQuery,
      pendingDepositIdeasQuery,
      activatedDepositIdeasQuery,
      rosesQuery,
      thornsQuery,
      reflectionsQuery,
      notesQuery
    ]);

    let taskScore = 0;
    let taskCount = 0;
    if (tasksResult.data && tasksResult.data.length > 0) {
      const taskIds = tasksResult.data.map((t: any) => t.id);

      const [rolesRes, domainsRes, goalsRes] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, goal_type, tw:0008-ap-goals-12wk(id, title, status), cg:0008-ap-goals-custom(id, title, status)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task')
      ]);

      const rolesByTask = new Map<string, any[]>();
      (rolesRes.data || []).forEach((r: any) => {
        if (!rolesByTask.has(r.parent_id)) rolesByTask.set(r.parent_id, []);
        rolesByTask.get(r.parent_id)!.push(r.role);
      });

      const domainsByTask = new Map<string, any[]>();
      (domainsRes.data || []).forEach((d: any) => {
        if (!domainsByTask.has(d.parent_id)) domainsByTask.set(d.parent_id, []);
        domainsByTask.get(d.parent_id)!.push(d.domain);
      });

      const goalsByTask = new Map<string, any[]>();
      (goalsRes.data || []).forEach((g: any) => {
        if (!goalsByTask.has(g.parent_id)) goalsByTask.set(g.parent_id, []);
        const goal = g.goal_type === 'twelve_wk_goal' ? g.tw : g.cg;
        if (goal && goal.status !== 'archived' && goal.status !== 'cancelled') {
          goalsByTask.get(g.parent_id)!.push(goal);
        }
      });

      tasksResult.data.forEach((task: any) => {
        const roles = rolesByTask.get(task.id) || [];
        const domains = domainsByTask.get(task.id) || [];
        const goals = goalsByTask.get(task.id) || [];
        taskScore += calculateTaskPoints(task, roles, domains, goals);
        taskCount++;
      });
    }

    let eventScore = 0;
    let eventCount = 0;
    if (eventsResult.data && eventsResult.data.length > 0) {
      const eventIds = eventsResult.data.map((e: any) => e.id);

      const [rolesRes, domainsRes, goalsRes] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', eventIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', eventIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, goal_type, tw:0008-ap-goals-12wk(id, title, status), cg:0008-ap-goals-custom(id, title, status)')
          .in('parent_id', eventIds)
          .eq('parent_type', 'task')
      ]);

      const rolesByEvent = new Map<string, any[]>();
      (rolesRes.data || []).forEach((r: any) => {
        if (!rolesByEvent.has(r.parent_id)) rolesByEvent.set(r.parent_id, []);
        rolesByEvent.get(r.parent_id)!.push(r.role);
      });

      const domainsByEvent = new Map<string, any[]>();
      (domainsRes.data || []).forEach((d: any) => {
        if (!domainsByEvent.has(d.parent_id)) domainsByEvent.set(d.parent_id, []);
        domainsByEvent.get(d.parent_id)!.push(d.domain);
      });

      const goalsByEvent = new Map<string, any[]>();
      (goalsRes.data || []).forEach((g: any) => {
        if (!goalsByEvent.has(g.parent_id)) goalsByEvent.set(g.parent_id, []);
        const goal = g.goal_type === 'twelve_wk_goal' ? g.tw : g.cg;
        if (goal && goal.status !== 'archived' && goal.status !== 'cancelled') {
          goalsByEvent.get(g.parent_id)!.push(goal);
        }
      });

      eventsResult.data.forEach((event: any) => {
        const roles = rolesByEvent.get(event.id) || [];
        const domains = domainsByEvent.get(event.id) || [];
        const goals = goalsByEvent.get(event.id) || [];
        eventScore += calculateTaskPoints(event, roles, domains, goals);
        eventCount++;
      });
    }

    return {
      tasks: {
        count: taskCount,
        score: Math.round(taskScore * 10) / 10
      },
      events: {
        count: eventCount,
        score: Math.round(eventScore * 10) / 10
      },
      depositIdeas: {
        pending: pendingDepositIdeasResult.count || 0,
        activated: activatedDepositIdeasResult.count || 0
      },
      roses: rosesResult.count || 0,
      thorns: thornsResult.count || 0,
      reflections: (reflectionsResult.count || 0) + (notesResult.count || 0)
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return {
      tasks: { count: 0, score: 0 },
      events: { count: 0, score: 0 },
      depositIdeas: { pending: 0, activated: 0 },
      roses: 0,
      thorns: 0,
      reflections: 0
    };
  }
}
