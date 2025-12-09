import { getSupabaseClient } from './supabase';
import { AssociatedItem } from '@/components/followThrough/AssociatedItemsList';

export type ItemType = 'task' | 'event' | 'rose' | 'thorn' | 'reflection' | 'depositIdea';
export type ParentType = 'task' | 'event' | 'reflection' | 'rose' | 'thorn' | 'depositIdea';

export async function fetchAssociatedItems(
  parentId: string,
  parentType: ParentType,
  userId: string
): Promise<AssociatedItem[]> {
  const supabase = getSupabaseClient();
  const items: AssociatedItem[] = [];

  try {
    const { data: tasks, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('id, title, type, created_at, due_date, start_date, start_time, end_time, status, completed_at, deleted_at')
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .eq('parent_type', parentType)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (tasksError) throw tasksError;

    if (tasks) {
      for (const task of tasks) {
        const type = getItemTypeFromTask(task);
        items.push({
          id: task.id,
          title: task.title || 'Untitled',
          type,
          created_at: task.created_at,
          due_date: task.due_date,
          start_date: task.start_date || task.due_date,
          has_notes: false,
          status: task.status,
          completed_at: task.completed_at,
        });
      }
    }

    const { data: reflections, error: reflectionsError } = await supabase
      .from('0008-ap-reflections')
      .select('id, reflection_title, content, created_at, daily_rose, daily_thorn')
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .eq('parent_type', parentType)
      .order('created_at', { ascending: false });

    if (reflectionsError) throw reflectionsError;

    if (reflections) {
      for (const reflection of reflections) {
        const type = getItemTypeFromReflection(reflection);
        items.push({
          id: reflection.id,
          title: reflection.reflection_title || 'Untitled',
          type,
          created_at: reflection.created_at,
          has_notes: !!reflection.content,
        });
      }
    }

    return items;
  } catch (error) {
    console.error('Error fetching associated items:', error);
    return [];
  }
}

export function getItemTypeFromTask(task: any): ItemType {
  // Use the actual type field from the database as the source of truth
  if (task.type === 'event') {
    return 'event';
  }
  return 'task';
}

export function getItemTypeFromReflection(reflection: any): ItemType {
  if (reflection.daily_rose) {
    return 'rose';
  }
  if (reflection.daily_thorn) {
    return 'thorn';
  }
  return 'reflection';
}

export function determineParentType(item: any, itemSource: 'task' | 'reflection' | 'depositIdea'): ParentType {
  if (itemSource === 'depositIdea') {
    return 'depositIdea';
  }

  if (itemSource === 'reflection') {
    if (item.daily_rose) {
      return 'rose';
    }
    if (item.daily_thorn) {
      return 'thorn';
    }
    return 'reflection';
  }

  if (itemSource === 'task') {
    // Use the actual type field from the database as the source of truth
    if (item.type === 'event') {
      return 'event';
    }
    return 'task';
  }

  return 'task';
}

export function getIconColorForType(type: ItemType): string {
  const colors = {
    task: '#3b82f6',
    event: '#8b5cf6',
    rose: '#10b981',
    thorn: '#ef4444',
    reflection: '#6366f1',
    depositIdea: '#f59e0b',
  };
  return colors[type] || colors.task;
}

export async function fetchLinkedItemsCount(
  parentId: string,
  parentType: ParentType,
  userId: string
): Promise<number> {
  const supabase = getSupabaseClient();

  try {
    // Count tasks linked to this parent
    const { count: tasksCount, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .eq('parent_type', parentType);

    if (tasksError) throw tasksError;

    // Count reflections linked to this parent
    const { count: reflectionsCount, error: reflectionsError } = await supabase
      .from('0008-ap-reflections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .eq('parent_type', parentType);

    if (reflectionsError) throw reflectionsError;

    return (tasksCount || 0) + (reflectionsCount || 0);
  } catch (error) {
    console.error('Error fetching linked items count:', error);
    return 0;
  }
}

export async function fetchBulkLinkedItemsCounts(
  parentEntries: Array<{ id: string; type: ParentType }>,
  userId: string
): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  const countsMap = new Map<string, number>();

  if (!parentEntries || parentEntries.length === 0) {
    return countsMap;
  }

  try {
    const taskParentIds = parentEntries
      .filter(entry => entry.type === 'task')
      .map(entry => entry.id);

    const reflectionParentIds = parentEntries
      .filter(entry => entry.type === 'reflection')
      .map(entry => entry.id);

    const depositIdeaParentIds = parentEntries
      .filter(entry => entry.type === 'depositIdea')
      .map(entry => entry.id);

    const allParentIds = parentEntries.map(entry => entry.id);

    const [tasksData, reflectionsData] = await Promise.all([
      supabase
        .from('0008-ap-tasks')
        .select('parent_id')
        .eq('user_id', userId)
        .in('parent_id', allParentIds)
        .is('deleted_at', null),

      supabase
        .from('0008-ap-reflections')
        .select('parent_id')
        .eq('user_id', userId)
        .in('parent_id', allParentIds)
    ]);

    if (tasksData.error) {
      console.error('Error fetching bulk tasks:', tasksData.error);
    }

    if (reflectionsData.error) {
      console.error('Error fetching bulk reflections:', reflectionsData.error);
    }

    const taskCounts = new Map<string, number>();
    (tasksData.data || []).forEach(task => {
      taskCounts.set(task.parent_id, (taskCounts.get(task.parent_id) || 0) + 1);
    });

    const reflectionCounts = new Map<string, number>();
    (reflectionsData.data || []).forEach(reflection => {
      reflectionCounts.set(reflection.parent_id, (reflectionCounts.get(reflection.parent_id) || 0) + 1);
    });

    allParentIds.forEach(parentId => {
      const taskCount = taskCounts.get(parentId) || 0;
      const reflectionCount = reflectionCounts.get(parentId) || 0;
      countsMap.set(parentId, taskCount + reflectionCount);
    });

    return countsMap;
  } catch (error) {
    console.error('Error fetching bulk linked items counts:', error);
    return countsMap;
  }
}
