import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';

/**
 * ZoneGoalsSection — 12-Week Goals list for a single zone (domain).
 *
 * Extracted from the inline block in `app/(tabs)/wellness.tsx` during
 * Phase B 3b-2. Pure presentation: parent owns the `useGoalProgress` hook
 * and the task-form state; this component just maps goals into progress
 * cards. Styles preserve the original card treatment (12px radius, no
 * border, flat white) — KRTile-style polish is a separate follow-up.
 */

export interface ZoneGoalsSectionProps {
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask: (goalId: string) => void;
}

export function ZoneGoalsSection({
  goals,
  goalProgress,
  onAddGoalTask,
}: ZoneGoalsSectionProps) {
  if (goals.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>12-Week Goals</Text>
      <View style={styles.list}>
        {goals.map(goal => {
          const progress = goalProgress[goal.id];
          if (!progress) return null;

          return (
            <GoalProgressCard
              key={goal.id}
              goal={goal}
              progress={progress}
              onAddAction={() => onAddGoalTask(goal.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    padding: 16,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
