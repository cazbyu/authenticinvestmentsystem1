// ============================================================================
// SixCheckStep.tsx - Step 4 of Weekly Alignment (Goals Review)
// ============================================================================
// Design Pattern: Matches Steps 1-3 layout
// - 72x72 container with 56x56 compass icon
// - Starts with Annual Goals (1-year directional goals)
// - Shows Campaigns (12-week + Custom) nested under annual goals
// - Reviews Leading Indicators (actions) for the week
// - Offers guided setup if no annual goals exist
// - Blue color scheme (#4169E1)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
  TextInput,
} from 'react-native';
import { ChevronRight, Check, HelpCircle, TrendingUp, Calendar, ChevronDown, ChevronUp, Repeat, Rocket, Plus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { AlignmentEscortCard } from './AlignmentEscortCard';
import { fetchPlannedActionsForWeek, PlannedActionsResult } from '@/hooks/fetchPlannedActionsforWeek';
import { parseLocalDate } from '@/lib/dateUtils';
import { useGoals, Timeline } from '@/hooks/useGoals';
import ActionEffortModal from '@/components/goals/ActionEffortModal';

// Compass Goals icon for Step 4 header
const CompassGoalsIcon = require('@/assets/images/compass-goals.png');

// Goal icon for card headers (matches app-wide icon)
import { GoalIcon } from '@/components/icons/CustomIcons';

interface SixCheckStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  onDataCapture: (data: {
    goalsReviewed: boolean;
    annualGoalsCount: number;
    campaignsCount: number;
    plannedActionsCount: number;
    leadingIndicatorCount: number;
    boostActionsCount: number;
    weekNumber?: number;
    keyFocusGoal?: string;
  }) => void;
  guidedModeEnabled?: boolean;
  weekPlanItems?: import('@/types/weekPlan').WeekPlanItem[];
  onAddWeekPlanItem?: (item: Omit<import('@/types/weekPlan').WeekPlanItem, 'id' | 'created_at'>) => void;
}

interface AnnualGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
  year_target_date?: string;
  priority?: number;
  campaigns?: Campaign[];
}

interface Campaign {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  goal_type: '12week' | 'custom';
  start_date?: string;
  end_date?: string;
  parent_goal_id?: string;
  parent_goal_type?: string;
  weeks_remaining?: number;
  actions?: GoalAction[];
  // Added for display
  annualGoalTitle?: string;
}

interface GoalAction {
  id: string;
  title: string;
  weeklyTarget: number;
  weeklyActual: number;
  isComplete: boolean;
}

interface WellnessZone {
  id: string;
  name: string;
  priority_order: number;
}

interface Role {
  id: string;
  label: string;
  color: string;
  priority_order: number;
}

// Flow states for the step
type FlowState = 
  | 'loading'
  | 'main'                    // Hub with scoreboard
  | 'annual-goals'            // List annual goals or empty state
  | 'setup-intro'             // Offer to help set up goals
  | 'setup-priorities'        // Show wellness zones + roles
  | 'setup-vision'            // Time remaining, what to achieve
  | 'setup-campaigns-intro'   // Introduce 12-week campaigns
  | 'review-campaigns'        // List all campaigns
  | 'goal-detail'             // View specific goal with campaigns & actions
  | 'review-actions';         // Review leading indicators for week

// Brand color for Goals (blue)
const GOALS_COLOR = '#4169E1';
const GOALS_COLOR_LIGHT = '#4169E115';
const GOALS_COLOR_BORDER = '#4169E140';

// Helper functions
function getProgressColor(progress: number): string {
  if (progress >= 75) return '#10B981';
  if (progress >= 50) return '#3B82F6';
  if (progress >= 25) return '#F59E0B';
  return '#6B7280';
}

function getDaysUntilYearEnd(): { months: number; days: number } {
  const now = new Date();
  const yearEnd = new Date(now.getFullYear(), 11, 31); // Dec 31
  const diffTime = yearEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  return { months, days };
}

// Helper to get the current week's date range based on user's preferred week start day
// weekStartDay: 0 = Sunday, 1 = Monday, etc.
function getCurrentWeekDateRange(weekStartDay: number = 1): string {
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate the start of the week based on user preference
  let daysToStart = currentDayOfWeek - weekStartDay;
  if (daysToStart < 0) daysToStart += 7;
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToStart);
  
  // Calculate end of week (6 days after start)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  // Format as "Feb 3 - 9" or "Jan 27 - Feb 2" if spans months
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monthNames[weekStart.getMonth()];
  const endMonth = monthNames[weekEnd.getMonth()];
  
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}`;
  } else {
    return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;
  }
}

// Convert week_start_day to number - handles string names, numbers, or numeric strings
function parseWeekStartDay(weekStartDay: string | number | null | undefined): number {
  if (weekStartDay === null || weekStartDay === undefined) return 1; // Default to Monday
  
  // If it's already a number
  if (typeof weekStartDay === 'number') {
    return weekStartDay >= 0 && weekStartDay <= 6 ? weekStartDay : 1;
  }
  
  // If it's a numeric string like "0" or "1"
  const numericValue = parseInt(weekStartDay, 10);
  if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 6) {
    return numericValue;
  }
  
  // If it's a day name string
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };
  
  const normalized = weekStartDay.toString().toLowerCase().trim();
  return dayMap[normalized] ?? 1; // Default to Monday if unrecognized
}

export function SixCheckStep({
  userId,
  colors,
  onNext,
  onBack,
  onRegisterBackHandler,
  onDataCapture,
  guidedModeEnabled = true,
  weekPlanItems = [],
  onAddWeekPlanItem,
}: SixCheckStepProps) {
  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  
  // Data state
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [topWellnessZones, setTopWellnessZones] = useState<WellnessZone[]>([]);
  const [topRoles, setTopRoles] = useState<Role[]>([]);
  const [weekStartDay, setWeekStartDay] = useState<number>(1); // Default Monday
  
  // Planned actions state (from new helper)
  const [plannedActionsData, setPlannedActionsData] = useState<PlannedActionsResult | null>(null);

  // Escort card dismissed state
  const [escortDismissed, setEscortDismissed] = useState<Record<string, boolean>>({});
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<AnnualGoal | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  
  // Setup wizard state
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [visionText, setVisionText] = useState('');
  
  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for back handler
  const flowStateRef = useRef<FlowState>(flowState);

  // Quick Add Modal state
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddCampaign, setQuickAddCampaign] = useState<Campaign | null>(null);

  // Get timeline and createTaskWithWeekPlan from useGoals hook
  const { currentTimeline, createTaskWithWeekPlan, fetchCurrentTimeline } = useGoals();
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  // Back handler for parent component
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => {
        const currentFlowState = flowStateRef.current;
        
        if (currentFlowState === 'main') {
          return false;
        } else if (currentFlowState === 'annual-goals') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'setup-intro') {
          setFlowState('annual-goals');
          return true;
        } else if (currentFlowState === 'setup-priorities') {
          setFlowState('setup-intro');
          return true;
        } else if (currentFlowState === 'setup-vision') {
          setFlowState('setup-priorities');
          return true;
        } else if (currentFlowState === 'setup-campaigns-intro') {
          setFlowState('setup-vision');
          return true;
        } else if (currentFlowState === 'review-campaigns') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'goal-detail') {
          setSelectedGoal(null);
          setFlowState('annual-goals');
          return true;
        } else if (currentFlowState === 'review-actions') {
          setFlowState('main');
          return true;
        }
        return false;
      });
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const supabase = getSupabaseClient();

      // Fetch the current timeline for task creation
      const fetchedTimeline = await fetchCurrentTimeline();
      if (fetchedTimeline) {
        setTimeline(fetchedTimeline);
        console.log('[SixCheckStep] Timeline loaded:', fetchedTimeline.id, fetchedTimeline.source);
      }

      // Load user preferences for week_start_day from main users table
      const { data: userData, error: userError } = await supabase
        .from('0008-ap-users')
        .select('week_start_day')
        .eq('id', userId)
        .single();

      console.log('[SixCheckStep] Week start day from users table:', { userData, userError });
      
      if (!userError && userData?.week_start_day !== undefined && userData?.week_start_day !== null) {
        const parsedDay = parseWeekStartDay(userData.week_start_day);
        console.log('[SixCheckStep] Parsed week_start_day:', { raw: userData.week_start_day, parsed: parsedDay });
        setWeekStartDay(parsedDay);
      } else {
        console.log('[SixCheckStep] Using default week_start_day: 1 (Monday)');
      }

      // Load annual goals
      const { data: annualData, error: annualError } = await supabase
        .from('0008-ap-goals-1y')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('priority', { ascending: true });

      if (annualError) throw annualError;

      // Create a map of annual goal IDs to titles for quick lookup
      const annualGoalMap: Record<string, string> = {};
      (annualData || []).forEach(ag => {
        annualGoalMap[ag.id] = ag.title;
      });
      
      console.log('[SixCheckStep] Annual goals map:', annualGoalMap);

      // Load 12-week campaigns
      const { data: twelveWeekData, error: twelveWeekError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('archived', false)
        .order('start_date', { ascending: true });

      if (twelveWeekError) throw twelveWeekError;

      // Load custom campaigns
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-goals-custom')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('start_date', { ascending: true });

      if (customError && customError.code !== 'PGRST116') throw customError;

      // Process campaigns
      const today = new Date();
      const allCampaigns: Campaign[] = [];

      // Process 12-week campaigns
      (twelveWeekData || []).forEach(goal => {
        const startDate = goal.start_date ? new Date(goal.start_date) : today;
        const endDate = goal.end_date ? new Date(goal.end_date) : new Date(startDate.getTime() + 12 * 7 * 24 * 60 * 60 * 1000);
        
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, totalDays - daysElapsed);
        const weeksRemaining = Math.ceil(daysRemaining / 7);

        console.log('[SixCheckStep] 12wk campaign:', { 
          id: goal.id, 
          title: goal.title, 
          parent_goal_id: goal.parent_goal_id,
          parent_goal_type: goal.parent_goal_type,
          mappedTitle: goal.parent_goal_id ? annualGoalMap[goal.parent_goal_id] : 'none'
        });

        allCampaigns.push({
          ...goal,
          goal_type: '12week',
          weeks_remaining: weeksRemaining,
          annualGoalTitle: goal.parent_goal_id ? annualGoalMap[goal.parent_goal_id] : undefined,
        });
      });

      // Process custom campaigns
      (customData || []).forEach(goal => {
        const startDate = goal.start_date ? new Date(goal.start_date) : today;
        const endDate = goal.end_date ? new Date(goal.end_date) : today;
        
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, totalDays - daysElapsed);
        const weeksRemaining = Math.ceil(daysRemaining / 7);

        console.log('[SixCheckStep] Custom campaign:', { 
          id: goal.id, 
          title: goal.title, 
          parent_goal_id: goal.parent_goal_id,
          parent_goal_type: goal.parent_goal_type,
          mappedTitle: goal.parent_goal_id ? annualGoalMap[goal.parent_goal_id] : 'none'
        });

        allCampaigns.push({
          ...goal,
          goal_type: 'custom',
          weeks_remaining: weeksRemaining,
          annualGoalTitle: goal.parent_goal_id ? annualGoalMap[goal.parent_goal_id] : undefined,
        });
      });

      // Load top 3 wellness zones
      const { data: zonesData } = await supabase
        .from('0008-ap-user-wellness-zones')
        .select('domain_id, priority_order, domain:0008-ap-domains(id, name)')
        .eq('user_id', userId)
        .not('priority_order', 'is', null)
        .order('priority_order', { ascending: true })
        .limit(3);

      if (zonesData) {
        setTopWellnessZones(zonesData.map(z => ({
          id: z.domain_id,
          name: (z.domain as any)?.name || 'Unknown',
          priority_order: z.priority_order,
        })));
      }

      // Load top 3 roles
      const { data: rolesData } = await supabase
        .from('0008-ap-roles')
        .select('id, label, color, priority_order')
        .eq('user_id', userId)
        .eq('is_active', true)
        .not('priority_order', 'is', null)
        .order('priority_order', { ascending: true })
        .limit(3);

      if (rolesData) {
        setTopRoles(rolesData);
      }

      // ============================================
      // LOAD PLANNED ACTIONS using new helper
      // ============================================
      const plannedActions = await fetchPlannedActionsForWeek();
      setPlannedActionsData(plannedActions);
      
      console.log('[SixCheckStep] Planned actions loaded:', {
        leadingIndicators: plannedActions.leadingIndicators.count,
        leadingIndicatorTarget: plannedActions.leadingIndicators.totalTarget,
        leadingIndicatorActual: plannedActions.leadingIndicators.totalActual,
        boostActions: plannedActions.boostActions.count,
        boostCompleted: plannedActions.boostActions.completed,
        weekNumber: plannedActions.week?.weekNumber,
        actions: plannedActions.leadingIndicators.actions?.map(a => ({
          id: a.id,
          title: a.title,
          goalId: a.goalId,
        })),
      });

      // ============================================
      // MAP ACTIONS TO CAMPAIGNS (FIX FOR DISPLAY BUG)
      // ============================================
      const campaignsWithActions = allCampaigns.map(campaign => {
        // Find leading indicators for this campaign by goalId
        const campaignActions = (plannedActions.leadingIndicators.actions || [])
          .filter(action => action.goalId === campaign.id)
          .map(li => ({
            id: li.id,
            title: li.title,
            weeklyTarget: li.targetDays,
            weeklyActual: li.actualDays,
            isComplete: li.actualDays >= li.targetDays,
          }));

        console.log('[SixCheckStep] Campaign actions mapped:', {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          actionsCount: campaignActions.length,
        });

        return {
          ...campaign,
          actions: campaignActions,
        };
      });

      // Update campaigns with actions
      setCampaigns(campaignsWithActions);

      // Also update annual goals to include campaigns with actions
      const annualGoalsUpdated = (annualData || []).map(ag => ({
        ...ag,
        campaigns: campaignsWithActions.filter(c => c.parent_goal_id === ag.id),
      }));
      setAnnualGoals(annualGoalsUpdated);

      setFlowState('main');

    } catch (error) {
      console.error('Error loading goals data:', error);
      setFlowState('main');
    } finally {
      setLoading(false);
    }
  }

  // Slide transition helper
  function slideToState(newState: FlowState) {
    Animated.timing(slideAnim, {
      toValue: -1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setFlowState(newState);
      slideAnim.setValue(1);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }

  function toggleCampaignExpanded(campaignId: string) {
    setExpandedCampaigns(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId],
    }));
  }

  function togglePrioritySelection(id: string) {
    setSelectedPriorities(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }

  function handleContinue() {
    const leadingCount = plannedActionsData?.leadingIndicators.count || 0;
    const boostCount = plannedActionsData?.boostActions.count || 0;
    
    onDataCapture({
      goalsReviewed: true,
      annualGoalsCount: annualGoals.length,
      campaignsCount: campaigns.length,
      plannedActionsCount: leadingCount + boostCount,
      leadingIndicatorCount: leadingCount,
      boostActionsCount: boostCount,
      weekNumber: plannedActionsData?.week?.weekNumber,
      keyFocusGoal: undefined,
    });
    
    onNext();
  }

  function handleOpenGoalDetail(goal: AnnualGoal) {
    setSelectedGoal(goal);
    slideToState('goal-detail');
  }

  // Quick Add handlers
  function handleOpenQuickAdd(campaign: Campaign) {
    setQuickAddCampaign(campaign);
    setShowQuickAddModal(true);
  }

  function handleQuickAddClose() {
    setShowQuickAddModal(false);
    setQuickAddCampaign(null);
  }

  async function handleQuickAddSave() {
    // Refresh data after save
    setShowQuickAddModal(false);
    setQuickAddCampaign(null);
    // Reload data to show the new action
    setLoading(true);
    await loadAllData();
  }

  // ============================================
  // SCOREBOARD DATA (from helper)
  // ============================================
  const annualGoalsCount = annualGoals.length;
  const campaignsCount = campaigns.length;
  
  // Leading indicators (recurring actions)
  const leadingIndicatorCount = plannedActionsData?.leadingIndicators.count || 0;
  const leadingIndicatorTarget = plannedActionsData?.leadingIndicators.totalTarget || 0;
  const leadingIndicatorActual = plannedActionsData?.leadingIndicators.totalActual || 0;
  
  // Boost actions (one-time tasks)
  const boostActionsCount = plannedActionsData?.boostActions.count || 0;
  const boostActionsCompleted = plannedActionsData?.boostActions.completed || 0;
  const boostActionsPending = plannedActionsData?.boostActions.pending || 0;
  
  // Combined count for display
  const totalPlannedActions = leadingIndicatorCount + boostActionsCount;
  
  // Current week info - use actual dates from timeline data
  const currentWeekNumber = plannedActionsData?.week?.weekNumber;
  
  // Use actual timeline week dates if available, otherwise calculate
  const currentWeekDateRange = (() => {
    const weekData = plannedActionsData?.week;
    if (weekData?.startDate && weekData?.endDate) {
      // Use parseLocalDate for consistent timezone handling
      const startDate = parseLocalDate(weekData.startDate);
      const endDate = parseLocalDate(weekData.endDate);
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = monthNames[startDate.getMonth()];
      const endMonth = monthNames[endDate.getMonth()];
      
      if (startMonth === endMonth) {
        return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}`;
      } else {
        return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}`;
      }
    }
    // Fallback to calculation if no timeline data
    return getCurrentWeekDateRange(weekStartDay);
  })();

  const { months: monthsLeft, days: daysLeft } = getDaysUntilYearEnd();

  // ===== RENDER: LOADING STATE =====
  if (flowState === 'loading' || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GOALS_COLOR} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your goals...
        </Text>
      </View>
    );
  }

  // ===== RENDER: SETUP INTRO STATE =====
  if (flowState === 'setup-intro') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Let's Set Goals</Text>
              </View>
            </View>
          </View>

          <View style={[styles.setupCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Text style={[styles.setupEmoji]}>🎯</Text>
            <Text style={[styles.setupTitle, { color: colors.text }]}>
              Ready to Set Your First Annual Goal?
            </Text>
            <Text style={[styles.setupText, { color: colors.textSecondary }]}>
              Annual goals are directional—they guide your focus for the year. We'll help you create one based on your priorities.
            </Text>
          </View>

          <View style={[styles.timeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Calendar size={24} color={GOALS_COLOR} />
            <View style={styles.timeCardContent}>
              <Text style={[styles.timeCardTitle, { color: colors.text }]}>
                {monthsLeft} months and {daysLeft} days left in the year
              </Text>
              <Text style={[styles.timeCardSubtext, { color: colors.textSecondary }]}>
                There's still time to make meaningful progress!
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: GOALS_COLOR }]}
            onPress={() => slideToState('setup-priorities')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Yes, Help Me Set Goals</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => slideToState('annual-goals')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>I'll Do This Later</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: SETUP PRIORITIES STATE =====
  if (flowState === 'setup-priorities') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Your Priorities</Text>
              </View>
            </View>
          </View>

          <View style={[styles.instructionCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Text style={[styles.instructionText, { color: colors.text }]}>
              Based on your earlier selections, here are your top priorities. Which would you like to focus a goal on?
            </Text>
          </View>

          {/* Top Wellness Zones */}
          {topWellnessZones.length > 0 && (
            <View style={styles.prioritySection}>
              <Text style={[styles.prioritySectionTitle, { color: colors.text }]}>
                🌿 Your Top Wellness Zones
              </Text>
              {topWellnessZones.map((zone, index) => (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.priorityItem,
                    {
                      backgroundColor: selectedPriorities.includes(`zone-${zone.id}`) ? GOALS_COLOR_LIGHT : colors.surface,
                      borderColor: selectedPriorities.includes(`zone-${zone.id}`) ? GOALS_COLOR : colors.border,
                    }
                  ]}
                  onPress={() => togglePrioritySelection(`zone-${zone.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.priorityBadge, { backgroundColor: '#39b54a' }]}>
                    <Text style={styles.priorityBadgeText}>W{index + 1}</Text>
                  </View>
                  <Text style={[styles.priorityLabel, { color: colors.text }]}>{zone.name}</Text>
                  {selectedPriorities.includes(`zone-${zone.id}`) && (
                    <View style={[styles.checkCircle, { backgroundColor: GOALS_COLOR }]}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Top Roles */}
          {topRoles.length > 0 && (
            <View style={styles.prioritySection}>
              <Text style={[styles.prioritySectionTitle, { color: colors.text }]}>
                👤 Your Top Roles
              </Text>
              {topRoles.map((role, index) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.priorityItem,
                    {
                      backgroundColor: selectedPriorities.includes(`role-${role.id}`) ? GOALS_COLOR_LIGHT : colors.surface,
                      borderColor: selectedPriorities.includes(`role-${role.id}`) ? GOALS_COLOR : colors.border,
                    }
                  ]}
                  onPress={() => togglePrioritySelection(`role-${role.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.priorityBadge, { backgroundColor: role.color || '#6B7280' }]}>
                    <Text style={styles.priorityBadgeText}>R{index + 1}</Text>
                  </View>
                  <Text style={[styles.priorityLabel, { color: colors.text }]}>{role.label}</Text>
                  {selectedPriorities.includes(`role-${role.id}`) && (
                    <View style={[styles.checkCircle, { backgroundColor: GOALS_COLOR }]}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {topWellnessZones.length === 0 && topRoles.length === 0 && (
            <View style={[styles.emptyPriorities, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyPrioritiesText, { color: colors.textSecondary }]}>
                Complete earlier steps to see your priorities here. You can still create goals manually.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: GOALS_COLOR }]}
            onPress={() => slideToState('setup-vision')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: SETUP VISION STATE =====
  if (flowState === 'setup-vision') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Your Vision</Text>
              </View>
            </View>
          </View>

          <View style={[styles.questionCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Text style={[styles.questionText, { color: colors.text }]}>
              What would you love to achieve by December 31st?
            </Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>
              Think about the areas you selected. What progress would make this year meaningful?
            </Text>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="I want to..."
              placeholderTextColor={colors.textSecondary}
              value={visionText}
              onChangeText={setVisionText}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: GOALS_COLOR, opacity: visionText.trim().length > 10 ? 1 : 0.5 }]}
            onPress={() => slideToState('setup-campaigns-intro')}
            disabled={visionText.trim().length <= 10}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Skip for Now</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: SETUP CAMPAIGNS INTRO STATE =====
  if (flowState === 'setup-campaigns-intro') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>How Goals Work</Text>
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Text style={styles.infoEmoji}>🎯</Text>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Annual Goals</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Big-picture direction for the year. Where do you want to be by December 31st?
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: '#3B82F615', borderColor: '#3B82F640' }]}>
            <Text style={styles.infoEmoji}>🚀</Text>
            <Text style={[styles.infoTitle, { color: colors.text }]}>12-Week Campaigns</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Focused sprints within annual goals. 12 weeks is short enough to maintain urgency, long enough to achieve meaningful results.
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
            <Text style={styles.infoEmoji}>⚡</Text>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Custom Campaigns</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Need a different timeline? Create custom campaigns for school semesters, projects, or any unique schedule you need.
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
            <Text style={styles.infoEmoji}>📊</Text>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Leading Indicators</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Each campaign has weekly actions (leading indicators) that drive progress. Complete these consistently and you'll hit your goals.
            </Text>
          </View>

          <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              💡 Don't worry if you're starting late—just start! Progress beats perfection.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: GOALS_COLOR }]}
            onPress={() => {
              // Here we would typically navigate to the goal creation flow
              // For now, go back to main
              slideToState('main');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Got It! Let's Continue</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: ANNUAL GOALS STATE =====
  if (flowState === 'annual-goals') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Your Annual Goals</Text>
              </View>
            </View>
          </View>

          {annualGoals.length === 0 ? (
            <>
              <View style={[styles.emptyCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
                <GoalIcon size={40} color={GOALS_COLOR} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No Annual Goals Yet
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Annual goals give direction to your year. Would you like some help setting them up?
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: GOALS_COLOR }]}
                onPress={() => slideToState('setup-intro')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Yes, Help Me Set Goals</Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
                onPress={() => slideToState('main')}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Maybe Later</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
                <View style={styles.identityHeader}>
                  <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
                    <GoalIcon size={12} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>ANNUAL GOALS ({new Date().getFullYear()})</Text>
                </View>
                <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
                  Tap a goal to see its campaigns and leading indicators
                </Text>
              </View>

              {annualGoals.map(goal => {
                const campaignCount = goal.campaigns?.length || 0;

                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.annualGoalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleOpenGoalDetail(goal)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.annualGoalHeader}>
                      <Text style={[styles.annualGoalTitle, { color: colors.text }]} numberOfLines={2}>
                        {goal.title}
                      </Text>
                      <ChevronRight size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.annualGoalMeta}>
                      <View style={styles.metaItem}>
                        <GoalIcon size={14} color={GOALS_COLOR} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {guidedModeEnabled && annualGoals.length > 0 && (
                <View style={{ marginVertical: 12 }}>
                  <AlignmentEscortCard
                    type="nudge"
                    icon="compass"
                    message="These are the mountains you're climbing. Which one gets your focus this week?"
                    colors={{
                      background: GOALS_COLOR_LIGHT,
                      text: colors.text,
                      accent: GOALS_COLOR,
                      border: GOALS_COLOR_BORDER,
                    }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
                onPress={() => slideToState('main')}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Done Reviewing</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: GOAL DETAIL STATE =====
  if (flowState === 'goal-detail' && selectedGoal) {
    const goalCampaigns = campaigns.filter(c => c.parent_goal_id === selectedGoal.id);

    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Annual Goal</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]} numberOfLines={2}>
                  {selectedGoal.title}
                </Text>
              </View>
            </View>
          </View>

          {selectedGoal.description && (
            <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>
              {selectedGoal.description}
            </Text>
          )}

          {/* Campaigns Section */}
          <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
                <GoalIcon size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>GOAL CAMPAIGNS</Text>
            </View>
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              {goalCampaigns.length > 0 
                ? 'Expand a campaign to see this week\'s leading indicators'
                : 'No campaigns linked to this goal yet'}
            </Text>
          </View>

          {goalCampaigns.map(campaign => {
            const isExpanded = expandedCampaigns[campaign.id];
            const progressColor = getProgressColor(campaign.progress || 0);

            return (
              <View key={campaign.id} style={styles.campaignWrapper}>
                <TouchableOpacity
                  style={[styles.campaignCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => toggleCampaignExpanded(campaign.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.campaignHeader}>
                    <View style={styles.campaignTitleRow}>
                      <View style={[styles.campaignTypeBadge, { backgroundColor: campaign.goal_type === '12week' ? '#3B82F615' : '#F59E0B15' }]}>
                        <Text style={[styles.campaignTypeText, { color: campaign.goal_type === '12week' ? '#3B82F6' : '#F59E0B' }]}>
                          {campaign.goal_type === '12week' ? '12W' : 'Custom'}
                        </Text>
                      </View>
                      <Text style={[styles.campaignTitle, { color: colors.text }]} numberOfLines={1}>
                        {campaign.title}
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={colors.textSecondary} />
                    )}
                  </View>

                  <View style={styles.campaignProgress}>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { backgroundColor: progressColor, width: `${campaign.progress || 0}%` }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.progressText, { color: progressColor }]}>
                      {campaign.progress || 0}%
                    </Text>
                  </View>

                  <Text style={[styles.campaignMeta, { color: colors.textSecondary }]}>
                    {campaign.weeks_remaining} weeks remaining
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.actionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.actionsHeader}>
                      <Text style={[styles.actionsTitle, { color: colors.text }]}>
                        This Week's Leading Indicators
                      </Text>
                      <TouchableOpacity
                        style={[styles.quickAddButton, { backgroundColor: GOALS_COLOR }]}
                        onPress={() => handleOpenQuickAdd(campaign)}
                        activeOpacity={0.7}
                      >
                        <Plus size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    {campaign.actions && campaign.actions.length > 0 ? (
                      campaign.actions.map(action => (
                        <View key={action.id} style={styles.actionItem}>
                          <View 
                            style={[
                              styles.actionCheck, 
                              { 
                                borderColor: action.isComplete ? '#10B981' : colors.border,
                                backgroundColor: action.isComplete ? '#10B981' : 'transparent',
                              }
                            ]}
                          >
                            {action.isComplete && <Check size={12} color="#FFFFFF" />}
                          </View>
                          <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>
                            {action.title}
                          </Text>
                          <Text style={[styles.actionProgress, { color: colors.textSecondary }]}>
                            {action.weeklyActual}/{action.weeklyTarget}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.noActionsText, { color: colors.textSecondary }]}>
                        No leading indicators set for this campaign
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {goalCampaigns.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <GoalIcon size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Campaigns Yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Create a 12-week or custom campaign to start tracking progress toward this goal.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
            onPress={() => {
              setSelectedGoal(null);
              slideToState('annual-goals');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Back to Goals</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Quick Add Action Modal */}
        {timeline && (
          <ActionEffortModal
            visible={showQuickAddModal}
            onClose={handleQuickAddClose}
            goal={quickAddCampaign ? {
              id: quickAddCampaign.id,
              title: quickAddCampaign.title,
              description: quickAddCampaign.description,
              goal_type: quickAddCampaign.goal_type === '12week' ? '12week' : 'custom',
            } : null}
            cycleWeeks={[]}
            timeline={timeline}
            createTaskWithWeekPlan={createTaskWithWeekPlan}
            mode="create"
            quickAddMode={true}
            currentWeekData={plannedActionsData?.week ? {
              weekNumber: plannedActionsData.week.weekNumber,
              startDate: plannedActionsData.week.startDate,
              endDate: plannedActionsData.week.endDate,
            } : undefined}
          />
        )}
      </Animated.View>
    );
  }

  // ===== RENDER: REVIEW CAMPAIGNS STATE =====
  if (flowState === 'review-campaigns') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>All Goal Campaigns</Text>
              </View>
            </View>
          </View>

          <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
                <GoalIcon size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>
                {campaignsCount} ACTIVE GOAL CAMPAIGN{campaignsCount !== 1 ? 'S' : ''}
              </Text>
            </View>
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              Expand a campaign to see this week's leading indicators
            </Text>
          </View>

          {campaigns.map(campaign => {
            const isExpanded = expandedCampaigns[campaign.id];
            const progressColor = getProgressColor(campaign.progress || 0);

            return (
              <View key={campaign.id} style={styles.campaignWrapper}>
                <TouchableOpacity
                  style={[styles.campaignCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => toggleCampaignExpanded(campaign.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.campaignHeader}>
                    <View style={styles.campaignTitleRow}>
                      <View style={[styles.campaignTypeBadge, { backgroundColor: campaign.goal_type === '12week' ? '#3B82F615' : '#F59E0B15' }]}>
                        <Text style={[styles.campaignTypeText, { color: campaign.goal_type === '12week' ? '#3B82F6' : '#F59E0B' }]}>
                          {campaign.goal_type === '12week' ? '12W' : 'Custom'}
                        </Text>
                      </View>
                      <Text style={[styles.campaignTitle, { color: colors.text }]} numberOfLines={1}>
                        {campaign.title}
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={colors.textSecondary} />
                    )}
                  </View>

                  <View style={styles.campaignProgress}>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { backgroundColor: progressColor, width: `${campaign.progress || 0}%` }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.progressText, { color: progressColor }]}>
                      {campaign.progress || 0}%
                    </Text>
                  </View>

                  <Text style={[styles.campaignMeta, { color: colors.textSecondary }]}>
                    {campaign.weeks_remaining} weeks remaining
                  </Text>
                  
                  {/* Annual Goal Link */}
                  {campaign.annualGoalTitle && (
                    <View style={styles.annualGoalLink}>
                      <TrendingUp size={12} color={GOALS_COLOR} />
                      <Text style={[styles.annualGoalLinkText, { color: GOALS_COLOR }]} numberOfLines={1}>
                        {campaign.annualGoalTitle}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.actionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.actionsHeader}>
                      <Text style={[styles.actionsTitle, { color: colors.text }]}>
                        This Week's Leading Indicators
                      </Text>
                      <TouchableOpacity
                        style={[styles.quickAddButton, { backgroundColor: GOALS_COLOR }]}
                        onPress={() => handleOpenQuickAdd(campaign)}
                        activeOpacity={0.7}
                      >
                        <Plus size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    {campaign.actions && campaign.actions.length > 0 ? (
                      campaign.actions.map(action => (
                        <View key={action.id} style={styles.actionItem}>
                          <View 
                            style={[
                              styles.actionCheck, 
                              { 
                                borderColor: action.isComplete ? '#10B981' : colors.border,
                                backgroundColor: action.isComplete ? '#10B981' : 'transparent',
                              }
                            ]}
                          >
                            {action.isComplete && <Check size={12} color="#FFFFFF" />}
                          </View>
                          <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>
                            {action.title}
                          </Text>
                          <Text style={[styles.actionProgress, { color: colors.textSecondary }]}>
                            {action.weeklyActual}/{action.weeklyTarget}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.noActionsText, { color: colors.textSecondary }]}>
                        No leading indicators set for this campaign
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Done Reviewing</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Quick Add Action Modal */}
        {timeline && (
          <ActionEffortModal
            visible={showQuickAddModal}
            onClose={handleQuickAddClose}
            goal={quickAddCampaign ? {
              id: quickAddCampaign.id,
              title: quickAddCampaign.title,
              description: quickAddCampaign.description,
              goal_type: quickAddCampaign.goal_type === '12week' ? '12week' : 'custom',
            } : null}
            cycleWeeks={[]}
            timeline={timeline}
            createTaskWithWeekPlan={createTaskWithWeekPlan}
            mode="create"
            quickAddMode={true}
            currentWeekData={plannedActionsData?.week ? {
              weekNumber: plannedActionsData.week.weekNumber,
              startDate: plannedActionsData.week.startDate,
              endDate: plannedActionsData.week.endDate,
            } : undefined}
          />
        )}
      </Animated.View>
    );
  }

  // ===== RENDER: MAIN STATE (Hub View) =====
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
            <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Six Check: Goals</Text>
          </View>
          <TouchableOpacity
            style={styles.tooltipButton}
            onPress={() => setShowTooltip(!showTooltip)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HelpCircle size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showTooltip && (
          <View style={[styles.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              We work to align our goals with our day-to-day behavior so we are building what matters most.
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>Annual Goals</Text> are directional and end on December 31st each year.
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>12-Week Campaigns</Text> are embedded within annual goals—4 per year if you follow our timelines.
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>Custom Campaigns</Text> let you manage goals on any timeline (school semesters, projects, etc.).
              {'\n\n'}
              💡 Don't worry if you're starting late—just start!
            </Text>
          </View>
        )}
      </View>

      {/* Scoreboard Card - Now includes Week Badge */}
      <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
            <GoalIcon size={12} color="#FFFFFF" />
          </View>
          <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>GOALS SCOREBOARD</Text>
        </View>
        
        {/* Week Badge Row - Inside the scoreboard */}
        {currentWeekNumber && (
          <View style={styles.weekBadgeRow}>
            <Calendar size={14} color={GOALS_COLOR} />
            <Text style={[styles.weekBadgeText, { color: GOALS_COLOR }]}>
              Week {currentWeekNumber} ({currentWeekDateRange})
            </Text>
          </View>
        )}
        
        {/* Row: Annual Goals & Goal Campaigns */}
        <View style={styles.scoreboardRow}>
          <View style={styles.scoreboardItem}>
            <Text style={[styles.scoreboardNumber, { color: GOALS_COLOR }]}>{annualGoalsCount}</Text>
            <Text style={[styles.scoreboardLabel, { color: colors.textSecondary }]}>Annual Goals</Text>
          </View>
          <View style={[styles.scoreboardDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreboardItem}>
            <Text style={[styles.scoreboardNumber, { color: '#10B981' }]}>{campaignsCount}</Text>
            <Text style={[styles.scoreboardLabel, { color: colors.textSecondary }]}>Goal Campaigns</Text>
          </View>
        </View>
      </View>

      {/* Escort: When reviewing active campaigns */}
      {guidedModeEnabled && !escortDismissed['step4-campaigns'] && (
        <AlignmentEscortCard
          type="nudge"
          message="These are the mountains you're climbing. Which one gets your focus this week?"
          icon="compass"
          stepColor={GOALS_COLOR}
          onDismiss={() => setEscortDismissed(prev => ({ ...prev, 'step4-campaigns': true }))}
        />
      )}

      {/* Escort: If no items created yet by Step 4 */}
      {guidedModeEnabled && !escortDismissed['step4-no-items'] && weekPlanItems.length === 0 && (
        <AlignmentEscortCard
          type="nudge"
          message="You've done great reflection work so far. Before we move to your commitment, let's turn some of that thinking into action items for this week."
          actionLabel="Start Adding Actions"
          stepColor={GOALS_COLOR}
          onAction={() => {
            setEscortDismissed(prev => ({ ...prev, 'step4-no-items': true }));
          }}
          onDismiss={() => setEscortDismissed(prev => ({ ...prev, 'step4-no-items': true }))}
        />
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtonsSection}>
        {/* Review Annual Goals */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: GOALS_COLOR, borderWidth: 2 }]}
          onPress={() => slideToState('annual-goals')}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionButtonIcon, { backgroundColor: GOALS_COLOR }]}>
              <GoalIcon size={16} color="#FFFFFF" />
            </View>
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: GOALS_COLOR }]}>
                Review Annual Goals
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                {annualGoalsCount > 0 ? `${annualGoalsCount} goals set for ${new Date().getFullYear()}` : 'Set your direction for the year'}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={GOALS_COLOR} />
        </TouchableOpacity>

        {/* Review Goal Campaigns */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            { 
              backgroundColor: colors.surface, 
              borderColor: campaignsCount > 0 ? GOALS_COLOR : colors.border,
              borderWidth: campaignsCount > 0 ? 2 : 1,
              opacity: campaignsCount > 0 ? 1 : 0.6,
            }
          ]}
          onPress={() => campaignsCount > 0 && slideToState('review-campaigns')}
          disabled={campaignsCount === 0}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionButtonIcon, { backgroundColor: campaignsCount > 0 ? GOALS_COLOR : colors.border }]}>
              <GoalIcon size={16} color="#FFFFFF" />
            </View>
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: campaignsCount > 0 ? GOALS_COLOR : colors.text }]}>
                Review Goal Campaigns
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                {campaignsCount > 0 
                  ? `${campaignsCount} active campaign${campaignsCount !== 1 ? 's' : ''}`
                  : 'No active campaigns'}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={campaignsCount > 0 ? GOALS_COLOR : colors.textSecondary} />
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: GOALS_COLOR }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue to Deployment</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  
  // Header
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compassContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassIcon: {
    width: 56,
    height: 56,
  },
  headerTextContainer: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  tooltipButton: {
    padding: 8,
  },
  tooltipContent: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Week Badge Row (inside scoreboard)
  weekBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(65, 105, 225, 0.2)',
    gap: 6,
  },
  weekBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Identity Card
  identityCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  identityIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  identitySubtext: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Scoreboard
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  scoreboardItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  scoreboardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreboardNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  scoreboardLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  scoreboardSubLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  scoreboardDivider: {
    width: 1,
    height: 50,
    marginHorizontal: 8,
  },

  // Action Buttons
  actionButtonsSection: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  actionButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonTextWrap: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionButtonSubtext: {
    fontSize: 13,
  },

  // Primary Button
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Secondary Button
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Setup Card
  setupCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  setupEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  setupText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Time Card
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  timeCardContent: {
    flex: 1,
  },
  timeCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeCardSubtext: {
    fontSize: 13,
  },

  // Instruction Card
  instructionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 24,
  },

  // Priority Section
  prioritySection: {
    marginBottom: 16,
  },
  prioritySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  priorityBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  priorityLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPriorities: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyPrioritiesText: {
    fontSize: 15,
    textAlign: 'center',
  },

  // Question Card
  questionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 8,
  },
  questionHint: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Input
  inputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },

  // Info Cards
  infoCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
  },
  infoEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Tip Card
  tipCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Empty Card
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Annual Goal Card
  annualGoalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  annualGoalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  annualGoalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  annualGoalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },

  // Goal Description
  goalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },

  // Campaign Card
  campaignWrapper: {
    marginBottom: 10,
  },
  campaignCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  campaignTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  campaignTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  campaignTypeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  campaignTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  campaignProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  campaignMeta: {
    fontSize: 13,
  },
  
  // Annual Goal Link (shown under campaigns)
  annualGoalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  annualGoalLinkText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  // Progress Bar
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Actions Container
  actionsContainer: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  actionCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 14,
  },
  actionProgress: {
    fontSize: 12,
    fontWeight: '600',
  },
  noActionsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default SixCheckStep;