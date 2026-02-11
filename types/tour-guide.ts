// types/tour-guide.ts
// Type definitions for the Tour Guide AI coaching system

export interface QuestionResponse {
  question_text: string;
  response_text: string;
  domain: string; // 'mission' | 'vision' | 'values' | 'identity'
  detected_roles?: string[];
  detected_wellness_zones?: string[];
}

export interface RoleSummary {
  label: string;
  category: string;
  purpose?: string;
  tasks_this_week?: number;
  tasks_completed_this_week?: number;
  deposits_this_week?: number;
  last_deposit_date?: string;
}

export interface WellnessZoneSummary {
  name: string;
  fulfillment_vision?: string;
  recent_activity_count?: number;
}

export interface GoalSummary {
  title: string;
  domain?: string;
  target_date?: string;
  progress_percent?: number;
  tasks_linked?: number;
  tasks_completed?: number;
}

export interface ReflectionHighlight {
  type: "rose" | "thorn" | "daily" | "weekly" | "reflection";
  content: string;
  date: string;
  question_proud?: string;
  question_impact?: string;
}

export interface ActivitySummary {
  tasks_this_week: number;
  tasks_completed_this_week: number;
  tasks_overdue: number;
  deposits_this_week: number;
  recent_task_titles?: string[];
  recent_completed_titles?: string[];
  recent_reflections?: ReflectionHighlight[];
  recent_notes?: string[];
  role_activity?: RoleSummary[];
  neglected_roles?: string[];
  zone_activity?: WellnessZoneSummary[];
  neglected_zones?: string[];
  active_goals?: GoalSummary[];
  completion_rate_this_week?: number;
  completion_rate_last_week?: number;
  streak_days?: number;
}

export interface TourGuideUserState {
  // North Star
  core_identity?: string | null;
  mission_statement?: string | null;
  five_year_vision?: string | null;
  core_values?: string[] | null;
  life_motto?: string | null;

  // Raw answers to guided questions
  question_responses?: QuestionResponse[];

  // Compass
  roles?: RoleSummary[];
  wellness_zones?: WellnessZoneSummary[];
  goals?: GoalSummary[];

  // Activity
  activity?: ActivitySummary;

  // Pulse
  total_alignments_completed: number;
  current_step_time_seconds?: number;
  week_number?: number;
}

export interface TourGuideRequest {
  step: "step_1" | "step_2" | "step_3" | "step_4" | "step_5" | "morning_spark" | "evening_review";
  trigger: "enter" | "idle" | "complete" | "skip" | "return";
  user_state: TourGuideUserState;
}

export interface TourGuideResponse {
  message: string;
  tone: "welcome" | "encourage" | "slow_down" | "push_forward" | "celebrate" | "challenge" | "reflect";
  thread_reference?: string;
  suggested_action?: string;
  next_nudge_seconds?: number;
}
