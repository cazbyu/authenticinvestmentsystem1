// Goals State Reducer for improved performance and state management

export type GoalBankTab = 'goals' | 'manage-timelines';

export interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  timeline_type?: string;
  global_cycle_id?: string;
  global_cycle?: {
    id: string;
    title?: string;
    cycle_label?: string;
    start_date?: string | null;
    end_date?: string | null;
  } | null;
}

export interface TimelineWeek {
  week_number: number;
  start_date: string;
  end_date: string;
}

export interface GoalsState {
  // Tab and timeline selection
  activeTab: GoalBankTab;
  selectedTimeline: Timeline | null;
  currentWeekIndex: number;

  // Timeline data
  allTimelines: Timeline[];
  timelineWeeks: TimelineWeek[];
  timelineDaysLeft: any;
  timelinesWithGoals: any[];
  loadingTimelines: boolean;

  // Goals data
  timelineGoals: any[];
  timelineGoalProgress: Record<string, any>;
  totalGoalProgress: Record<string, { totalActual: number; totalTarget: number; percentage: number }>;
  expandedGoals: Record<string, boolean>;

  // Week actions
  weekGoalActions: Record<string, any[]>;
  loadingWeekActions: boolean;
}

export type GoalsAction =
  // Tab and navigation
  | { type: 'SET_ACTIVE_TAB'; payload: GoalBankTab }
  | { type: 'SET_SELECTED_TIMELINE'; payload: Timeline | null }
  | { type: 'SET_CURRENT_WEEK_INDEX'; payload: number }
  | { type: 'NAVIGATE_WEEK'; payload: 'prev' | 'next' }

  // Timeline data
  | { type: 'SET_ALL_TIMELINES'; payload: Timeline[] }
  | { type: 'SET_TIMELINE_WEEKS'; payload: TimelineWeek[] }
  | { type: 'SET_TIMELINE_DAYS_LEFT'; payload: any }
  | { type: 'SET_TIMELINES_WITH_GOALS'; payload: any[] }
  | { type: 'SET_LOADING_TIMELINES'; payload: boolean }

  // Goals data
  | { type: 'SET_TIMELINE_GOALS'; payload: any[] }
  | { type: 'SET_TIMELINE_GOAL_PROGRESS'; payload: Record<string, any> }
  | { type: 'SET_TOTAL_GOAL_PROGRESS'; payload: Record<string, { totalActual: number; totalTarget: number; percentage: number }> }
  | { type: 'TOGGLE_GOAL_EXPANDED'; payload: string }
  | { type: 'SET_EXPANDED_GOALS'; payload: Record<string, boolean> }

  // Week actions
  | { type: 'SET_WEEK_GOAL_ACTIONS'; payload: Record<string, any[]> }
  | { type: 'UPDATE_WEEK_ACTION'; payload: { goalId: string; actionId: string; updates: any } }
  | { type: 'SET_LOADING_WEEK_ACTIONS'; payload: boolean }

  // Batch updates
  | { type: 'RESET_TO_TIMELINES' }
  | { type: 'SELECT_TIMELINE_AND_RESET'; payload: Timeline };

export const initialGoalsState: GoalsState = {
  activeTab: 'goals',
  selectedTimeline: null,
  currentWeekIndex: 0,

  allTimelines: [],
  timelineWeeks: [],
  timelineDaysLeft: null,
  timelinesWithGoals: [],
  loadingTimelines: true,

  timelineGoals: [],
  timelineGoalProgress: {},
  totalGoalProgress: {},
  expandedGoals: {},

  weekGoalActions: {},
  loadingWeekActions: false,
};

export function goalsReducer(state: GoalsState, action: GoalsAction): GoalsState {
  switch (action.type) {
    // Tab and navigation
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_SELECTED_TIMELINE':
      return { ...state, selectedTimeline: action.payload };

    case 'SET_CURRENT_WEEK_INDEX':
      return { ...state, currentWeekIndex: action.payload };

    case 'NAVIGATE_WEEK': {
      const maxIndex = state.timelineWeeks.length - 1;
      let newIndex = state.currentWeekIndex;

      if (action.payload === 'prev' && state.currentWeekIndex > 0) {
        newIndex = state.currentWeekIndex - 1;
      } else if (action.payload === 'next' && state.currentWeekIndex < maxIndex) {
        newIndex = state.currentWeekIndex + 1;
      }

      return { ...state, currentWeekIndex: newIndex };
    }

    // Timeline data
    case 'SET_ALL_TIMELINES':
      return { ...state, allTimelines: action.payload };

    case 'SET_TIMELINE_WEEKS':
      return { ...state, timelineWeeks: action.payload };

    case 'SET_TIMELINE_DAYS_LEFT':
      return { ...state, timelineDaysLeft: action.payload };

    case 'SET_TIMELINES_WITH_GOALS':
      return { ...state, timelinesWithGoals: action.payload };

    case 'SET_LOADING_TIMELINES':
      return { ...state, loadingTimelines: action.payload };

    // Goals data
    case 'SET_TIMELINE_GOALS':
      return { ...state, timelineGoals: action.payload };

    case 'SET_TIMELINE_GOAL_PROGRESS':
      return { ...state, timelineGoalProgress: action.payload };

    case 'SET_TOTAL_GOAL_PROGRESS':
      return { ...state, totalGoalProgress: action.payload };

    case 'TOGGLE_GOAL_EXPANDED':
      return {
        ...state,
        expandedGoals: {
          ...state.expandedGoals,
          [action.payload]: !state.expandedGoals[action.payload],
        },
      };

    case 'SET_EXPANDED_GOALS':
      return { ...state, expandedGoals: action.payload };

    // Week actions
    case 'SET_WEEK_GOAL_ACTIONS':
      return { ...state, weekGoalActions: action.payload };

    case 'UPDATE_WEEK_ACTION': {
      const { goalId, actionId, updates } = action.payload;
      const currentActions = state.weekGoalActions[goalId] || [];
      const updatedActions = currentActions.map(action =>
        action.id === actionId ? { ...action, ...updates } : action
      );

      return {
        ...state,
        weekGoalActions: {
          ...state.weekGoalActions,
          [goalId]: updatedActions,
        },
      };
    }

    case 'SET_LOADING_WEEK_ACTIONS':
      return { ...state, loadingWeekActions: action.payload };

    // Batch updates
    case 'RESET_TO_TIMELINES':
      return {
        ...state,
        activeTab: 'goals',
        selectedTimeline: null,
        currentWeekIndex: 0,
        timelineWeeks: [],
        timelineGoals: [],
        timelineGoalProgress: {},
        totalGoalProgress: {},
        weekGoalActions: {},
        loadingWeekActions: false,
        timelineDaysLeft: null,
        expandedGoals: {},
      };

    case 'SELECT_TIMELINE_AND_RESET':
      return {
        ...state,
        selectedTimeline: action.payload,
        activeTab: 'goals',
        currentWeekIndex: 0,
        timelineGoals: [],
        timelineGoalProgress: {},
        totalGoalProgress: {},
        weekGoalActions: {},
        loadingWeekActions: false,
        expandedGoals: {},
      };

    default:
      return state;
  }
}
