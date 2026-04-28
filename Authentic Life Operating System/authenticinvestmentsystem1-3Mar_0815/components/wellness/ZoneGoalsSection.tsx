import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';

/**
 * ZoneGoalsSection — Goals list for a single zone (domain).
 *
 * Renders a mix of 12wk and custom goals that share the same presentation.
 * Parent owns data-fetching (via `fetchZoneGoals` + `fetchZoneGoalsProgress`
 * in `lib/zoneDataService.ts`) and the task-form state; this component
 * just maps goals into progress cards. Styles preserve the original card
 * treatment (12px radius, no border, flat white) — KRTile-style polish
 * is a separate follow-up.
 */

export interface ZoneGoalsSectionProps {
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask: (goalId: string) => void;
  // Optional tap-to-detail handler. When provided, each goal card
  // becomes tappable and forwards the goal object to the parent.
  onGoalPress?: (goal: any) => void;
}

export function ZoneGoalsSection({
  goals,
  goalProgress,
  onAddGoalTask,
  onGoalPress,
}: ZoneGoalsSectionProps) {
  if (goals.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Goals</Text>
      <View style={styles.list}>
        {goals.map(goal => {
          const progress = goalProgress[goal.id];
          if (!progress) return null;

          return (
            <GoalProgressCard
              key={goal.id}
              goal={goal}
              progress={progress}
              compact={true}
              onAddAction={() => onAddGoalTask(goal.id)}
              onPress={onGoalPress ? () => onGoalPress(goal) : undefined}
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
