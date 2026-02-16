/**
 * Alignment Coach - Unified Type Definitions
 *
 * Merges concepts from tour-guide.ts (one-way guidance) and chatBubble.ts (two-way chat)
 * into a single type system for the unified alignment-coach edge function.
 */

// Re-export shared types from existing modules (no duplication)
export type { CaptureData } from './chatBubble';
export type { CaptureType, RitualType } from '@/constants/chatBubble';

// Re-export sub-interfaces from tour-guide.ts
export type {
  QuestionResponse,
  RoleSummary,
  WellnessZoneSummary,
  GoalSummary,
  ReflectionHighlight,
  ActivitySummary,
} from './tour-guide';

import type { CaptureData } from './chatBubble';
import type { CaptureType } from '@/constants/chatBubble';
import type {
  QuestionResponse,
  RoleSummary,
  GoalSummary,
  ActivitySummary,
  ReflectionHighlight,
} from './tour-guide';

// ============================================
// REQUEST TYPES
// ============================================

/** Weekly alignment steps (maps to compass positions) */
export type AlignmentStep =
  | 'step_1'  // North Star (0° North)
  | 'step_2'  // Roles (270° West)
  | 'step_3'  // Wellness (90° East)
  | 'step_4'  // Goals (180° South)
  | 'step_5'  // Alignment Check (Full Compass)
  | 'step_6'; // Tactical Deployment (Compass fades)

/** Coaching mode - which ritual the user is in */
export type CoachMode = 'weekly' | 'morning' | 'evening';

/** What triggered the coach request */
export type CoachTrigger =
  | 'enter'              // User entered a step or started a ritual
  | 'idle'               // User has been inactive on current step
  | 'complete'           // User completed a step action
  | 'skip'               // User skipped a step
  | 'return'             // User returned to a previous step
  | 'user_message'       // User sent a chat message (2-way mode)
  // Step 1 specific triggers
  | 'identity_selected'  // User chose core identity from spark list
  | 'domain_started'     // User began mission/vision/values flow
  | 'question_answered'  // User answered a guided question
  | 'synthesis_ready'    // AI suggestions generated, displayed to user
  | 'domain_completed'   // User saved a mission/vision/value statement
  | 'domain_skipped'     // User backed out of a domain without saving
  // Step 2 — Roles triggers
  | 'roles_prioritized'       // User saved role priority order
  | 'role_reflection_opened'  // User tapped a role to open Living Vision Board
  | 'role_one_thing_saved'    // User saved ONE Thing task/event for a role
  | 'role_deposit_saved'      // User saved a deposit idea for a role
  | 'role_health_flagged'     // User flagged a role (thriving/stable/needs_attention)
  // Step 3 — Wellness triggers
  | 'zones_prioritized'       // User saved zone priority order
  | 'zone_reflection_opened'  // User opened a zone's WellnessVisionBoard
  | 'zone_one_thing_saved'    // User saved ONE Thing for a zone
  | 'zone_vision_saved'       // User saved a fulfillment vision for a zone
  // Step 4 — Goals triggers
  | 'goal_setup_started'      // User entered goal setup flow (no goals exist)
  | 'goal_detail_opened'      // User opened a specific goal's detail view
  | 'action_added'            // User added a leading indicator action
  | 'actions_reviewed'        // User entered review-actions flow
  // Step 5 — Alignment triggers
  | 'pq3_answered'            // User answered PQ3 (honest mirror)
  | 'pq3_skipped'             // User skipped PQ3
  | 'pq5_answered'            // User answered PQ5 (alignment check)
  | 'pq5_skipped'             // User skipped PQ5
  // Step 6 — Tactical triggers
  | 'tasks_committed'         // User toggled task commitments
  | 'delegation_made'         // User delegated a task
  | 'commitment_written'      // User wrote personal commitment text
  | 'contract_signed';        // User signed the weekly contract

// ============================================
// STEP 1 CONTEXT TYPES
// ============================================

/** Flow state within Step 1 (Touch Your Star) */
export type Step1FlowState =
  | 'hero-question'
  | 'identity-hub'
  | 'domain-intro'
  | 'choice'
  | 'direct-input'
  | 'guided-questions'
  | 'synthesis'
  | 'value-entry'
  | 'reflective-questions';

/** North Star domain being worked on */
export type NorthStarDomain = 'mission' | 'vision' | 'values';

/** Completion status of each North Star domain */
export interface DomainCompletionStatus {
  identity: boolean;
  mission: boolean;
  vision: boolean;
  values: boolean; // true if at least 1 value exists
}

/** Rich context for Step 1 coaching */
export interface Step1Context {
  /** Current UI flow state */
  flow_state: Step1FlowState;
  /** Which domain the user is currently working on (null if at identity-hub) */
  current_domain?: NorthStarDomain | null;
  /** Which domains are complete vs pending */
  domain_completion: DomainCompletionStatus;
  /** How the user selected their identity */
  identity_selection_method?: 'spark_list' | 'custom' | null;
  /** The spark list label they chose (e.g. "Child of God", "Steward") */
  spark_list_selection?: string | null;
  /** Identity insights text from the database */
  identity_insights?: string | null;
  /** Number of questions answered in the current domain flow */
  questions_answered_in_session?: number;
  /** Total questions available in the current domain flow */
  questions_total_in_session?: number;
  /** The current question text (for guided-questions flow state) */
  current_question_text?: string | null;
  /** Whether AI synthesis suggestions are currently displayed */
  synthesis_active?: boolean;
}

// ============================================
// STEPS 2-6 CONTEXT TYPE
// ============================================

/** Lightweight context for Steps 2-6 coaching (flow state + context bag) */
export interface StepContext {
  /** Current flow state within the step component */
  flow_state: string;
  /** Step-specific data payload — only include fields relevant to the trigger */
  context_data?: {
    // Step 2 — Roles
    selected_role_label?: string;
    selected_role_purpose?: string;
    roles_prioritized_count?: number;
    health_flag?: 'thriving' | 'stable' | 'needs_attention';
    // Step 3 — Wellness
    selected_zone_name?: string;
    zones_prioritized_count?: number;
    // Step 4 — Goals
    selected_goal_title?: string;
    selected_goal_progress?: number;
    action_count?: number;
    // Step 5 — Alignment
    pq3_question_text?: string;
    pq5_question_text?: string;
    // Step 6 — Tactical
    committed_task_count?: number;
    committed_event_count?: number;
    delegated_count?: number;
    personal_commitment_text?: string;
  };
}

/** Request payload sent to the alignment-coach edge function */
export interface AlignmentCoachRequest {
  /** Which ritual mode */
  mode: CoachMode;
  /** Current weekly alignment step (only for mode === 'weekly') */
  step?: AlignmentStep;
  /** What triggered this request */
  trigger: CoachTrigger;
  /** Conversation history for 2-way chat. Omit for one-way guidance. */
  messages?: ConversationMessage[];
  /** Energy level 1-3 (morning ritual only) */
  fuel_level?: number;
  /** Reason for energy level (morning ritual only) */
  fuel_reason?: string;
  /** Full user context for the AI */
  user_state: AlignmentCoachUserState;
  /** Step-specific context for Step 1 (Touch Your Star) */
  step1_context?: Step1Context;
  /** Lightweight context for Steps 2-6 */
  step_context?: StepContext;
}

// ============================================
// RESPONSE TYPES
// ============================================

/** Emotional register of the coach's response */
export type CoachTone =
  | 'welcome'
  | 'encourage'
  | 'slow_down'
  | 'push_forward'
  | 'celebrate'
  | 'challenge'
  | 'reflect';

/** Response from the alignment-coach edge function */
export interface AlignmentCoachResponse {
  /** Clean text with CAPTURE_OFFER markers stripped */
  text: string;
  /** Emotional tone of the response */
  tone: CoachTone;
  /** Parsed capture suggestions (tasks, events, roses, etc.) */
  captures: CaptureOffer[];
  /** Reference to a previous conversation thread */
  thread_reference?: string;
  /** Suggested next action for the UI */
  suggested_action?: string;
  /** Seconds before a follow-up nudge should appear */
  next_nudge_seconds?: number;
  /** Claude model used */
  model: string;
  /** Token usage stats */
  usage?: { input_tokens: number; output_tokens: number };
}

/** A parsed capture suggestion from the AI */
export interface CaptureOffer {
  captureType: CaptureType;
  data: CaptureData;
}

/** A single message in a 2-way conversation */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// USER STATE
// ============================================

/**
 * Complete user context sent to the alignment coach.
 * Superset of TourGuideUserState + chatBubbleService context.
 */
export interface AlignmentCoachUserState {
  // --- North Star ---
  /** User's self-defined identity statement */
  core_identity?: string | null;
  /** Personal mission statement */
  mission_statement?: string | null;
  /** 5-year vision */
  five_year_vision?: string | null;
  /** Core values list */
  core_values?: string[] | null;
  /** Life motto / mantra */
  life_motto?: string | null;
  /** AI-generated insights about the user's identity */
  identity_insights?: string | null;

  // --- Power Question Responses ---
  /** Recent answers to guided Power Questions */
  question_responses?: QuestionResponse[];

  // --- Compass: Roles ---
  /** Active roles with weekly activity stats */
  roles?: RoleSummary[];

  // --- Compass: Goals ---
  /** 12-week goals with progress tracking */
  goals?: GoalSummary[];

  // --- Activity & Stats ---
  /** Weekly activity summary (tasks, completions, streaks) */
  activity?: ActivitySummary;

  // --- Recent Reflections & Notes ---
  /** Recent reflection entries (roses, thorns, daily/weekly) */
  recent_reflections?: ReflectionHighlight[];
  /** Recent note snippets */
  recent_notes?: string[];

  // --- Pulse ---
  /** Total completed weekly alignments (experience indicator) */
  total_alignments_completed: number;

  // --- From chatBubbleService context ---
  /** Overdue task descriptions */
  overdue_items?: string[];
  /** Recent coaching session summaries */
  recent_summaries?: string[];
}

// ============================================
// LOCAL FALLBACK TYPE
// ============================================

/** Fallback response when edge function is unreachable */
export interface CoachFallback {
  message: string;
  tone: CoachTone;
}
