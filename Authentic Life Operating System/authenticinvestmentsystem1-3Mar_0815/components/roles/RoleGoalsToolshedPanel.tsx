import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';

/**
 * RoleGoalsToolshedPanel — R-4 panel for the role-side Toolshed > Goals
 * surface. No wellness twin — collapses 2 thin pass-through layers
 * (ZoneGoalsToolshedPanel → ZoneGoalsSection) into 1 file for the
 * role side.
 *
 * Direct mapping: goals.map(g => <GoalProgressCard ...>). Data fetching
 * is owned by R-5 (roles.tsx), passed in as props. R-4 just renders.
 *
 * GoalProgressCard is reused as-is (scope-agnostic).
 */

export interface RoleGoalsToolshedPanelProps {
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask?: (goalId: string) => void;
  onGoalPress?: (goal: any) => void;
}

export function RoleGoalsToolshedPanel({
  goals,
  goalProgress,
  onAddGoalTask,
  onGoalPress,
}: RoleGoalsToolshedPanelProps) {
  const { colors } = useTheme();

  if (goals.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No active goals tagged to this role.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {goals.map((goal) => {
        const progress = goalProgress[goal.id];
        if (!progress) return null;
        return (
          <GoalProgressCard
            key={goal.id}
            goal={goal}
            progress={progress}
            compact={true}
            onAddAction={onAddGoalTask ? () => onAddGoalTask(goal.id) : undefined}
            onPress={onGoalPress ? () => onGoalPress(goal) : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  emptyWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
