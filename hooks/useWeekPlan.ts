import { useState, useCallback } from 'react';

export interface WeekPlanItem {
  id: string;
  type: 'task' | 'event' | 'idea';
  title: string;
  source_step: 1 | 2 | 3 | 4 | 5;
  source_context: string;
  aligned_to?: string;
  created_at: string;
  item_id?: string;
  is_committed?: boolean;
}

export interface WeekPlanHook {
  items: WeekPlanItem[];
  addItem: (item: Omit<WeekPlanItem, 'id' | 'created_at'>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<WeekPlanItem>) => void;
  clearItems: () => void;
  getItemsByStep: (step: number) => WeekPlanItem[];
  getItemsByType: (type: 'task' | 'event' | 'idea') => WeekPlanItem[];
  getItemsBySource: (sourceContext: string) => WeekPlanItem[];
  itemCount: number;
  committedCount: number;
}

export function useWeekPlan(): WeekPlanHook {
  const [items, setItems] = useState<WeekPlanItem[]>([]);

  const addItem = useCallback((item: Omit<WeekPlanItem, 'id' | 'created_at'>) => {
    const newItem: WeekPlanItem = {
      ...item,
      id: `week-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      is_committed: false,
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<WeekPlanItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const getItemsByStep = useCallback(
    (step: number) => {
      return items.filter((item) => item.source_step === step);
    },
    [items]
  );

  const getItemsByType = useCallback(
    (type: 'task' | 'event' | 'idea') => {
      return items.filter((item) => item.type === type);
    },
    [items]
  );

  const getItemsBySource = useCallback(
    (sourceContext: string) => {
      return items.filter((item) => item.source_context.includes(sourceContext));
    },
    [items]
  );

  const itemCount = items.length;
  const committedCount = items.filter((item) => item.is_committed).length;

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    clearItems,
    getItemsByStep,
    getItemsByType,
    getItemsBySource,
    itemCount,
    committedCount,
  };
}
