import React from 'react';
import { ZoneGoalsSection } from './ZoneGoalsSection';

/**
 * ZoneGoalsToolshedPanel — Minimalist Executive design system
 * Trivial wrapper around ZoneGoalsSection for the Toolshed Surfaces >
 * Goals tile. Receives goals + goalProgress + onAddGoalTask from
 * wellness.tsx (passed through ZoneToolshed) and renders the existing
 * goals card list.
 *
 * Empty state: ZoneGoalsSection returns null when goals.length === 0,
 * so the panel body collapses to nothing in that case (the panel
 * header with X stays visible).
 *
 * Until 1+6c removes the standalone ZoneGoalsSection invocation in
 * wellness.tsx, the same goals list renders in two places. Both
 * pull from the same wellness.tsx state (goals + goalProgress), so
 * they cannot diverge.
 */

export interface ZoneGoalsToolshedPanelProps {
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask: (goalId: string) => void;
  onGoalPress?: (goal: any) => void;
}

export function ZoneGoalsToolshedPanel({
  goals,
  goalProgress,
  onAddGoalTask,
  onGoalPress,
}: ZoneGoalsToolshedPanelProps) {
  return (
    <ZoneGoalsSection
      goals={goals}
      goalProgress={goalProgress}
      onAddGoalTask={onAddGoalTask}
      onGoalPress={onGoalPress}
    />
  );
}
