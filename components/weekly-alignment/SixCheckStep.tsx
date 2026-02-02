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
import { ChevronRight, Check, HelpCircle, Target, TrendingUp, AlertTriangle, Calendar, Flag, Zap, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

// Compass Goals icon for Step 4 header
const CompassGoalsIcon = require('@/assets/images/compass-goals.png');

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
    keyFocusGoal?: string;
  }) => void;
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
  one_year_goal_id?: string;
  is_lagging?: boolean;
  weeks_remaining?: number;
  actions?: GoalAction[];
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
function getProgressColor(progress: number, isLagging?: boolean): string {
  if (isLagging) return '#EF4444';
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

export function SixCheckStep({
  userId,
  colors,
  onNext,
  onBack,
  onRegisterBackHandler,
  onDataCapture,
}: SixCheckStepProps) {
  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  
  // Data state
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [plannedActions, setPlannedActions] = useState<GoalAction[]>([]);
  const [topWellnessZones, setTopWellnessZones] = useState<WellnessZone[]>([]);
  const [topRoles, setTopRoles] = useState<Role[]>([]);
  
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

      // Load annual goals
      const { data: annualData, error: annualError } = await supabase
        .from('0008-ap-goals-1y')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('priority', { ascending: true });

      if (annualError) throw annualError;

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

        const expectedProgress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;
        const actualProgress = goal.progress || 0;
        const isLagging = actualProgress < (expectedProgress - 10);

        allCampaigns.push({
          ...goal,
          goal_type: '12week',
          is_lagging: isLagging,
          weeks_remaining: weeksRemaining,
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

        const expectedProgress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;
        const actualProgress = goal.progress || 0;
        const isLagging = actualProgress < (expectedProgress - 10);

        allCampaigns.push({
          ...goal,
          goal_type: 'custom',
          is_lagging: isLagging,
          weeks_remaining: weeksRemaining,
        });
      });

      setCampaigns(allCampaigns);

      // Attach campaigns to annual goals
      const annualGoalsWithCampaigns = (annualData || []).map(ag => ({
        ...ag,
        campaigns: allCampaigns.filter(c => c.one_year_goal_id === ag.id),
      }));

      setAnnualGoals(annualGoalsWithCampaigns);

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

      // Load planned actions for this week (leading indicators)
      // This would need the current week's tasks - simplified for now
      const { data: actionsData } = await supabase
        .from('0008-ap-tasks')
        .select('id, title, weekly_target')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(20);

      if (actionsData) {
        setPlannedActions(actionsData.map(a => ({
          id: a.id,
          title: a.title,
          weeklyTarget: a.weekly_target || 0,
          weeklyActual: 0,
          isComplete: false,
        })));
      }

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
    onDataCapture({
      goalsReviewed: true,
      annualGoalsCount: annualGoals.length,
      campaignsCount: campaigns.length,
      plannedActionsCount: plannedActions.length,
      keyFocusGoal: undefined,
    });
    
    onNext();
  }

  function handleOpenGoalDetail(goal: AnnualGoal) {
    setSelectedGoal(goal);
    slideToState('goal-detail');
  }

  // Counts for scoreboard
  const annualGoalsCount = annualGoals.length;
  const campaignsCount = campaigns.length;
  const plannedActionsCount = plannedActions.length;
  const laggingCampaignsCount = campaigns.filter(c => c.is_lagging).length;

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
                  <View style={[styles.priorityBadge, { backgroundColor: role.color || '#9370DB' }]}>
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

          {(topWellnessZones.length === 0 && topRoles.length === 0) && (
            <View style={[styles.emptyPriorities, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyPrioritiesText, { color: colors.textSecondary }]}>
                Complete Steps 2 and 3 first to see your priorities here.
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
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

          <View style={[styles.timeCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Calendar size={24} color={GOALS_COLOR} />
            <View style={styles.timeCardContent}>
              <Text style={[styles.timeCardTitle, { color: colors.text }]}>
                The year ends in {monthsLeft} months and {daysLeft} days
              </Text>
            </View>
          </View>

          <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.questionText, { color: colors.text }]}>
              What would you love to have accomplished by December 31st?
            </Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>
              Think big but achievable. This becomes your North Star for the year.
            </Text>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="By the end of this year, I want to..."
              placeholderTextColor={colors.textSecondary}
              value={visionText}
              onChangeText={setVisionText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: visionText.trim() ? GOALS_COLOR : colors.border }]}
            onPress={() => slideToState('setup-campaigns-intro')}
            disabled={!visionText.trim()}
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
                <Text style={[styles.stepTitle, { color: colors.text }]}>Goal Campaigns</Text>
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Text style={styles.infoEmoji}>🚀</Text>
            <Text style={[styles.infoTitle, { color: colors.text }]}>12-Week Campaigns</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Break your annual goal into focused 12-week campaigns. This creates urgency and allows you to pack 4 powerful campaigns into each year.
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
                <Target size={40} color={GOALS_COLOR} />
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
                    <Flag size={12} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>ANNUAL GOALS ({new Date().getFullYear()})</Text>
                </View>
                <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
                  Tap a goal to see its campaigns and leading indicators
                </Text>
              </View>

              {annualGoals.map(goal => {
                const campaignCount = goal.campaigns?.length || 0;
                const laggingCount = goal.campaigns?.filter(c => c.is_lagging).length || 0;

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
                        <Target size={14} color={GOALS_COLOR} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {laggingCount > 0 && (
                        <View style={styles.metaItem}>
                          <AlertTriangle size={14} color="#EF4444" />
                          <Text style={[styles.metaText, { color: '#EF4444' }]}>
                            {laggingCount} behind
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

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
    const goalCampaigns = campaigns.filter(c => c.one_year_goal_id === selectedGoal.id);

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
                <Zap size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>CAMPAIGNS</Text>
            </View>
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              {goalCampaigns.length > 0 
                ? 'Expand a campaign to see this week\'s leading indicators'
                : 'No campaigns linked to this goal yet'}
            </Text>
          </View>

          {goalCampaigns.map(campaign => {
            const isExpanded = expandedCampaigns[campaign.id];
            const progressColor = getProgressColor(campaign.progress || 0, campaign.is_lagging);

            return (
              <View key={campaign.id} style={styles.campaignWrapper}>
                <TouchableOpacity
                  style={[
                    styles.campaignCard,
                    { 
                      backgroundColor: colors.surface, 
                      borderColor: campaign.is_lagging ? '#EF4444' : colors.border,
                      borderLeftColor: progressColor,
                      borderLeftWidth: 4,
                    }
                  ]}
                  onPress={() => toggleCampaignExpanded(campaign.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.campaignHeader}>
                    <View style={styles.campaignTitleRow}>
                      <View style={[styles.campaignTypeBadge, { backgroundColor: campaign.goal_type === '12week' ? '#3B82F620' : '#F59E0B20' }]}>
                        <Text style={[styles.campaignTypeText, { color: campaign.goal_type === '12week' ? '#3B82F6' : '#F59E0B' }]}>
                          {campaign.goal_type === '12week' ? '12W' : 'Custom'}
                        </Text>
                      </View>
                      <Text style={[styles.campaignTitle, { color: colors.text }]} numberOfLines={2}>
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
                      <View style={[styles.progressBarFill, { backgroundColor: progressColor, width: `${Math.min(100, campaign.progress || 0)}%` }]} />
                    </View>
                    <Text style={[styles.progressText, { color: progressColor }]}>
                      {campaign.progress || 0}%
                    </Text>
                  </View>

                  <Text style={[styles.campaignMeta, { color: colors.textSecondary }]}>
                    {campaign.weeks_remaining} week{campaign.weeks_remaining !== 1 ? 's' : ''} remaining
                    {campaign.is_lagging && <Text style={{ color: '#EF4444' }}> • Behind schedule</Text>}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.actionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.actionsTitle, { color: colors.text }]}>
                      📋 This Week's Leading Indicators
                    </Text>
                    {(campaign.actions || []).length > 0 ? (
                      campaign.actions?.map(action => (
                        <View key={action.id} style={styles.actionItem}>
                          <View style={[
                            styles.actionCheck,
                            { 
                              backgroundColor: action.isComplete ? '#10B981' : 'transparent',
                              borderColor: action.isComplete ? '#10B981' : colors.border,
                            }
                          ]}>
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
                        No actions planned for this week. Add some in the Goals section.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {goalCampaigns.length === 0 && (
            <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                💡 Create campaigns in the Goals section to break this annual goal into focused sprints.
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
            <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Back to Annual Goals</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
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
                <Text style={[styles.stepTitle, { color: colors.text }]}>All Campaigns</Text>
              </View>
            </View>
          </View>

          <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
                <Zap size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>ACTIVE CAMPAIGNS</Text>
            </View>
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              Your 12-week and custom goal campaigns
            </Text>
          </View>

          {campaigns.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Zap size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Campaigns</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Create campaigns in the Goals section to track your progress.
              </Text>
            </View>
          ) : (
            campaigns.map(campaign => {
              const progressColor = getProgressColor(campaign.progress || 0, campaign.is_lagging);

              return (
                <View
                  key={campaign.id}
                  style={[
                    styles.campaignCard,
                    { 
                      backgroundColor: colors.surface, 
                      borderColor: campaign.is_lagging ? '#EF4444' : colors.border,
                      borderLeftColor: progressColor,
                      borderLeftWidth: 4,
                    }
                  ]}
                >
                  <View style={styles.campaignHeader}>
                    <View style={styles.campaignTitleRow}>
                      <View style={[styles.campaignTypeBadge, { backgroundColor: campaign.goal_type === '12week' ? '#3B82F620' : '#F59E0B20' }]}>
                        <Text style={[styles.campaignTypeText, { color: campaign.goal_type === '12week' ? '#3B82F6' : '#F59E0B' }]}>
                          {campaign.goal_type === '12week' ? '12W' : 'Custom'}
                        </Text>
                      </View>
                      <Text style={[styles.campaignTitle, { color: colors.text }]} numberOfLines={2}>
                        {campaign.title}
                      </Text>
                    </View>
                    {campaign.is_lagging && (
                      <View style={[styles.statusBadge, { backgroundColor: '#EF444420' }]}>
                        <AlertTriangle size={12} color="#EF4444" />
                        <Text style={[styles.statusBadgeText, { color: '#EF4444' }]}>Behind</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.campaignProgress}>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                      <View style={[styles.progressBarFill, { backgroundColor: progressColor, width: `${Math.min(100, campaign.progress || 0)}%` }]} />
                    </View>
                    <Text style={[styles.progressText, { color: progressColor }]}>
                      {campaign.progress || 0}%
                    </Text>
                  </View>

                  <Text style={[styles.campaignMeta, { color: colors.textSecondary }]}>
                    {campaign.weeks_remaining} week{campaign.weeks_remaining !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              );
            })
          )}

          {laggingCampaignsCount > 0 && (
            <View style={[styles.alertCard, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
              <AlertTriangle size={20} color="#EF4444" />
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
                  {laggingCampaignsCount} Campaign{laggingCampaignsCount > 1 ? 's' : ''} Behind
                </Text>
                <Text style={[styles.alertText, { color: colors.textSecondary }]}>
                  Consider dedicating focused time this week to catch up.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Done Reviewing</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
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

      {/* Scoreboard Card */}
      <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
            <Target size={12} color="#FFFFFF" />
          </View>
          <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>GOALS SCOREBOARD</Text>
        </View>
        
        <View style={styles.scoreboardRow}>
          <View style={styles.scoreboardItem}>
            <Text style={[styles.scoreboardNumber, { color: GOALS_COLOR }]}>{annualGoalsCount}</Text>
            <Text style={[styles.scoreboardLabel, { color: colors.textSecondary }]}>Annual Goals</Text>
          </View>
          <View style={[styles.scoreboardDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreboardItem}>
            <Text style={[styles.scoreboardNumber, { color: laggingCampaignsCount > 0 ? '#F59E0B' : '#10B981' }]}>{campaignsCount}</Text>
            <Text style={[styles.scoreboardLabel, { color: colors.textSecondary }]}>Campaigns</Text>
          </View>
          <View style={[styles.scoreboardDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreboardItem}>
            <Text style={[styles.scoreboardNumber, { color: colors.text }]}>{plannedActionsCount}</Text>
            <Text style={[styles.scoreboardLabel, { color: colors.textSecondary }]}>Planned Actions</Text>
          </View>
        </View>
      </View>

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
              <Flag size={16} color="#FFFFFF" />
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

        {/* Review Campaigns */}
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
              <Zap size={16} color="#FFFFFF" />
            </View>
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: campaignsCount > 0 ? GOALS_COLOR : colors.text }]}>
                Review Campaigns
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                {campaignsCount > 0 
                  ? `${campaignsCount} active (${laggingCampaignsCount} behind)`
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

      {laggingCampaignsCount > 0 && (
        <View style={[styles.alertCard, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
          <AlertTriangle size={20} color="#EF4444" />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
              {laggingCampaignsCount} Campaign{laggingCampaignsCount > 1 ? 's' : ''} Behind
            </Text>
            <Text style={[styles.alertText, { color: colors.textSecondary }]}>
              Review your campaigns to get back on track.
            </Text>
          </View>
        </View>
      )}

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

  // Identity Card
  identityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  identityIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  identitySubtext: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Scoreboard
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  scoreboardItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreboardNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  scoreboardLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  scoreboardDivider: {
    width: 1,
    height: 40,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonTextWrap: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Setup Cards
  setupCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  setupEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
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
    marginBottom: 16,
    gap: 12,
  },
  timeCardContent: {
    flex: 1,
  },
  timeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeCardSubtext: {
    fontSize: 13,
    marginTop: 2,
  },

  // Instruction Card
  instructionCard: {
    padding: 20,
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
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
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

  // Alert Card
  alertCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default SixCheckStep;