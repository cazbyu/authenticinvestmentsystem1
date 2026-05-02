import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';

/**
 * KRGoalsToolshedPanel — R-6-components-C sibling of components/roles/RoleGoalsToolshedPanel.tsx.
 *
 * Pure presentational panel for the KR-side Toolshed > Goals surface.
 * Direct mapping: goals.map(g => <GoalProgressCard ...>). Data fetching
 * is owned by R-6-mount (roles.tsx), passed in as props.
 *
 * GoalProgressCard is reused as-is (scope-agnostic — same component the
 * role-side and zone-side panels render).
 *
 * Per audit Q5 lock, the parent KRToolshed renders this with title "Goals"
 * (NOT "Active Goals" or "12-Week Goals"). Per audit data: KRs only tag
 * custom goals via 0008-ap-universal-key-relationships-join with
 * parent_type='custom_goal'; 6 such goals exist in production at audit
 * time, all with null start_date/end_date. fetchKRGoals (R-6-lib) handles
 * the null-date filter JS-side per the date-gate fix.
 */

export interface KRGoalsToolshedPanelProps {
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask?: (goalId: string) => void;
  onGoalPress?: (goal: any) => void;
}

export function KRGoalsToolshedPanel({
  goals,
  goalProgress,
  onAddGoalTask,
  onGoalPress,
}: KRGoalsToolshedPanelProps) {
  const { colors } = useTheme();

  if (goals.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No active goals tagged to this relationship.
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
