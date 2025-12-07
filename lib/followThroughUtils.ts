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
      .select('id, title, created_at, due_date, start_time, end_time, status, completed_at, deleted_at')
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
          start_date: task.due_date,
          has_notes: false,
          status: task.status,
          completed_at: task.completed_at,
        });
      }
    }

    const { data: reflections, error: reflectionsError } = await supabase
      .from('0008-ap-reflections')
      .select('id, reflection_title, content, created_at, daily_rose, daily_thorn, is_deposit_idea')
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
  if (task.start_time || task.end_time) {
    return 'event';
  }
  return 'task';
}

export function getItemTypeFromReflection(reflection: any): ItemType {
  if (reflection.is_deposit_idea) {
    return 'depositIdea';
  }
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
    if (item.is_deposit_idea) {
      return 'depositIdea';
    }
    if (item.daily_rose) {
      return 'rose';
    }
    if (item.daily_thorn) {
      return 'thorn';
    }
    return 'reflection';
  }

  if (itemSource === 'task') {
    if (item.start_time || item.end_time) {
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
