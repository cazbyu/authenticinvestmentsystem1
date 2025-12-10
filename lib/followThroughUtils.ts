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
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (tasksError) throw tasksError;

    const { data: reflections, error: reflectionsError } = await supabase
      .from('0008-ap-reflections')
      .select('id, reflection_title, content, created_at, daily_rose, daily_thorn')
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (reflectionsError) throw reflectionsError;

    const { data: depositIdeas, error: depositIdeasError } = await supabase
      .from('0008-ap-deposit-ideas')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (depositIdeasError) throw depositIdeasError;

    // Collect all item IDs to fetch notes in bulk
    const allItemIds = [
      ...(tasks || []).map(t => t.id),
      ...(reflections || []).map(r => r.id),
      ...(depositIdeas || []).map(d => d.id)
    ];

    // Fetch notes for all items
    const notesMap = new Map<string, boolean>();
    if (allItemIds.length > 0) {
      const { data: notesData } = await supabase
        .from('0008-ap-universal-notes-join')
        .select('parent_id')
        .in('parent_id', allItemIds);

      if (notesData) {
        notesData.forEach(note => {
          notesMap.set(note.parent_id, true);
        });
      }
    }

    // Process tasks
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
          has_notes: notesMap.has(task.id),
          status: task.status,
          completed_at: task.completed_at,
        });
      }
    }

    // Process reflections
    if (reflections) {
      for (const reflection of reflections) {
        const type = getItemTypeFromReflection(reflection);
        items.push({
          id: reflection.id,
          title: reflection.reflection_title || 'Untitled',
          type,
          created_at: reflection.created_at,
          has_notes: !!reflection.content || notesMap.has(reflection.id),
        });
      }
    }

    // Process deposit ideas
    if (depositIdeas) {
      for (const depositIdea of depositIdeas) {
        items.push({
          id: depositIdea.id,
          title: depositIdea.title || 'Untitled',
          type: 'depositIdea',
          created_at: depositIdea.created_at,
          has_notes: notesMap.has(depositIdea.id),
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
      .eq('parent_id', parentId);

    if (tasksError) throw tasksError;

    // Count reflections linked to this parent
    const { count: reflectionsCount, error: reflectionsError } = await supabase
      .from('0008-ap-reflections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('parent_id', parentId);

    if (reflectionsError) throw reflectionsError;

    // Count deposit ideas linked to this parent
    const { count: depositIdeasCount, error: depositIdeasError } = await supabase
      .from('0008-ap-deposit-ideas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('parent_id', parentId);

    if (depositIdeasError) throw depositIdeasError;

    return (tasksCount || 0) + (reflectionsCount || 0) + (depositIdeasCount || 0);
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

    const [tasksData, reflectionsData, depositIdeasData] = await Promise.all([
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
        .in('parent_id', allParentIds),

      supabase
        .from('0008-ap-deposit-ideas')
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

    if (depositIdeasData.error) {
      console.error('Error fetching bulk deposit ideas:', depositIdeasData.error);
    }

    const taskCounts = new Map<string, number>();
    (tasksData.data || []).forEach(task => {
      taskCounts.set(task.parent_id, (taskCounts.get(task.parent_id) || 0) + 1);
    });

    const reflectionCounts = new Map<string, number>();
    (reflectionsData.data || []).forEach(reflection => {
      reflectionCounts.set(reflection.parent_id, (reflectionCounts.get(reflection.parent_id) || 0) + 1);
    });

    const depositIdeaCounts = new Map<string, number>();
    (depositIdeasData.data || []).forEach(depositIdea => {
      depositIdeaCounts.set(depositIdea.parent_id, (depositIdeaCounts.get(depositIdea.parent_id) || 0) + 1);
    });

    allParentIds.forEach(parentId => {
      const taskCount = taskCounts.get(parentId) || 0;
      const reflectionCount = reflectionCounts.get(parentId) || 0;
      const depositIdeaCount = depositIdeaCounts.get(parentId) || 0;
      countsMap.set(parentId, taskCount + reflectionCount + depositIdeaCount);
    });

    return countsMap;
  } catch (error) {
    console.error('Error fetching bulk linked items counts:', error);
    return countsMap;
  }
}
