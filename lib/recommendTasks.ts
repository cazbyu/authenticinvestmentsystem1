import { getSupabaseClient } from './supabase';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  due_time?: string;
  role_id?: string;
  domain_id?: string;
  points?: number;
}

export async function recommendTasks(userId: string, limit: number = 3): Promise<Task[]> {
  try {
    const supabase = getSupabaseClient();

    const topRoleIds = await getTopRoles(userId);

    const today = new Date().toISOString().split('T')[0];

    const { data: tasks, error } = await supabase
      .from('0008-ap-tasks')
      .select(`
        id,
        title,
        description,
        priority,
        due_date,
        due_time,
        role_id,
        domain_id
      `)
      .eq('user_id', userId)
      .eq('type', 'task')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .or(`due_date.eq.${today},due_date.lt.${today},due_date.is.null`);

    if (error) throw error;

    if (!tasks || tasks.length === 0) {
      return [];
    }

    const scoredTasks = tasks
      .map((task) => {
        let score = 0;

        if (task.role_id && topRoleIds.includes(task.role_id)) {
          const roleRank = topRoleIds.indexOf(task.role_id);
          score += 100 - roleRank * 20;
        }

        if (task.priority === 'high') {
          score += 50;
        } else if (task.priority === 'medium') {
          score += 30;
        } else if (task.priority === 'low') {
          score += 10;
        }

        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          const todayDate = new Date(today);
          if (dueDate < todayDate) {
            score += 40;
          } else if (dueDate.getTime() === todayDate.getTime()) {
            score += 30;
          }
        }

        if (task.due_time) {
          score += 20;
        }

        return {
          task,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.task);

    return scoredTasks;
  } catch (error) {
    console.error('Error recommending tasks:', error);
    return [];
  }
}

async function getTopRoles(userId: string): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();

    const { data: preferences, error } = await supabase
      .from('0008-ap-user-preferences')
      .select('top_roles')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (preferences && preferences.top_roles) {
      return preferences.top_roles;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('0008-ap-roles')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(3);

    if (rolesError) throw rolesError;

    return roles ? roles.map((r) => r.id) : [];
  } catch (error) {
    console.error('Error getting top roles:', error);
    return [];
  }
}
