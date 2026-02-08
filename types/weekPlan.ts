// ============================================================================
// Week Plan Types - Alignment Escort Feature
// ============================================================================
// Types for the week plan accumulator that collects tasks, events, and ideas
// created during the Weekly Alignment ritual flow (steps 2-4).
// ============================================================================

export interface WeekPlanItem {
  id: string;
  type: 'task' | 'event' | 'idea';
  title: string;
  source_step: 1 | 2 | 3 | 4;
  source_context: string; // e.g., "Role: Father" or "Wellness: Physical" or "Goal: Launch business"
  aligned_to?: string; // Which North Star element it connects to
  created_at: string;
}

export type EscortCardType = 'nudge' | 'prompt' | 'celebrate';

export interface AlignmentEscortCardProps {
  message: string;
  type: EscortCardType;
  actionLabel?: string;
  actionLabel2?: string;
  onAction?: () => void;
  onAction2?: () => void;
  onDismiss?: () => void;
  icon?: string;
  stepColor?: string;
}
