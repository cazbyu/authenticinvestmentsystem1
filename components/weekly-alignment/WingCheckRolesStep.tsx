// ============================================================================
// WingCheckRolesStep.tsx - Step 2 of Weekly Alignment
// ============================================================================
// Design Pattern: Matches TouchYourStarStep (Step 1) layout
// - 72x72 container with 56x56 compass icon
// - "This Week's Top Focus" card (styled like "My Core Identity" in Step 1)
// - NO back arrows in subheaders - parent handles back navigation
// - RolesIcon from CustomIcons used for card headers (like NorthStarIcon in Step 1)
// - RoleIcon from RoleIcon.tsx used for individual role display
//
// "My Living Vision Board" (role-reflection state):
// - Section 1: ONE Thing This Week (Task/Event save)
// - Section 2: Capture an Idea (deposit idea)
// - Section 3: Roses
// - Section 4: Thorns
// - Section 5: Capture a Thought (reflection)
// - Section 6: My Dream for this Role + Deeper Introspection (vision)
// - Section 7: My Purpose in this Role + Deeper Introspection (mission)
// - Section 8: Key Relationships (placeholder)
// - Section 9: [Role] Journal (JournalView)
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
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { 
  ChevronRight, 
  Check, 
  HelpCircle, 
  Settings,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  MessageCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { RoleIcon } from '@/components/icons/RoleIcon';
import { RoleIcon as RolesIcon } from '@/components/icons/CustomIcons';
import { getWeekStart, formatLocalDate } from '@/lib/dateUtils';
import { JournalView } from '@/components/journal/JournalView';

// Helper function to get Monday of current week
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Format a date as "Mon, Feb 3"
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Get dates for the current week (Sun-Sat or Mon-Sun)
function getWeekDates(weekStart: string): { label: string; value: string }[] {
  const start = new Date(weekStart + 'T12:00:00');
  const dates: { label: string; value: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const value = `${yyyy}-${mm}-${dd}`;
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    dates.push({ label, value });
  }
  return dates;
}

// Compass Roles icon for Step 2 header (matches Step 1 sizing: 56x56 in 72x72 container)
const CompassRolesIcon = require('@/assets/images/compass-roles.png');
const DepositIdeaIcon = require('@/assets/images/deposit-idea.png');
const RoseIcon = require('@/assets/images/rose-81.png');
const ThornIcon = require('@/assets/images/thorn-81.png');
const ReflectionsIcon = require('@/assets/images/reflections-72.png');
const TaskListIcon = require('@/assets/images/task-list.png');
const CalendarIcon = require('@/assets/images/calendar.png');

interface WingCheckRolesStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  onDataCapture: (data: {
    rolesReviewed: string[];
    roleHealthFlags: Record<string, 'thriving' | 'stable' | 'needs_attention'>;
  }) => void;
  onOpenTaskForm?: (initialData: any) => void;
}

interface Role {
  id: string;
  label: string;
  category: string;
  icon?: string;
  color?: string;
  purpose?: string;
  dream?: string;
  is_active: boolean;
  priority_order?: number | null;
  preset_role_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  type: 'task' | 'event';
  status: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_anytime?: boolean;
  one_thing?: boolean;
}

interface DepositIdea {
  id: string;
  title: string;
  one_thing?: boolean;
}

interface PowerQuestion {
  id: string;
  question_text: string;
  question_context?: string;
  ob_priority?: number;
  strategy_type: string;
}

interface QuestionResponse {
  id: string;
  question_id: string;
  response_text: string;
  created_at: string;
}

// Flow states for the step
type FlowState = 
  | 'loading'
  | 'activate-roles'
  | 'main'
  | 'prioritize'
  | 'review-roles'
  | 'role-reflection';

// Brand color for Roles (purple)
const ROLES_COLOR = '#9370DB';
const ROLES_COLOR_LIGHT = '#9370DB15';
const ROLES_COLOR_BORDER = '#9370DB40';

// Rose/Thorn colors
const ROSE_COLOR = '#F43F5E';
const THORN_COLOR = '#6B7280';

export function WingCheckRolesStep({
  userId,
  colors,
  onNext,
  onBack,
  onRegisterBackHandler,
  onDataCapture,
  onOpenTaskForm,
}: WingCheckRolesStepProps) {
  const router = useRouter();
  
  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  
  // Data state
  const [roles, setRoles] = useState<Role[]>([]);
  const [prioritizedRoles, setPrioritizedRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Role reflection state
  const [selectedReflectionRole, setSelectedReflectionRole] = useState<Role | null>(null);
  const [purposeResponse, setPurposeResponse] = useState('');
  const [editingPurpose, setEditingPurpose] = useState(false);
  
  // Dream state
  const [dreamResponse, setDreamResponse] = useState('');
  const [editingDream, setEditingDream] = useState(false);
  const [savingDream, setSavingDream] = useState(false);
  
  // ONE Thing state
  const [oneThingText, setOneThingText] = useState('');
  const [savingOneThing, setSavingOneThing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [oneThingSaveType, setOneThingSaveType] = useState<'task' | 'event'>('task');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedEndTime, setSelectedEndTime] = useState('10:00');
  const [existingOneThingTask, setExistingOneThingTask] = useState<Task | null>(null);
  
  // Capture inputs
  // Capture inputs
  const [ideaText, setIdeaText] = useState('');
  const [savingIdea, setSavingIdea] = useState(false);
  const [roseText, setRoseText] = useState('');
  const [savingRose, setSavingRose] = useState(false);
  const [thornText, setThornText] = useState('');
  const [savingThorn, setSavingThorn] = useState(false);
  const [thoughtText, setThoughtText] = useState('');
  const [savingThought, setSavingThought] = useState(false);
  
  // Consolidated reflection tab
  const [activeReflectionTab, setActiveReflectionTab] = useState<'rose' | 'thorn' | 'reflection'>('rose');
  const [showReflectionsList, setShowReflectionsList] = useState(false);
  const [weekRoses, setWeekRoses] = useState<any[]>([]);
  const [weekThorns, setWeekThorns] = useState<any[]>([]);
  const [weekReflections, setWeekReflections] = useState<any[]>([]);
  
  // Ideas list
  const [showIdeasList, setShowIdeasList] = useState(false);
  const [roleIdeas, setRoleIdeas] = useState<DepositIdea[]>([]);
  
  // Tasks/Events list
  const [showTasksList, setShowTasksList] = useState(false);
  const [roleTasks, setRoleTasks] = useState<Task[]>([]);
  
  // Deeper Introspection state
  const [visionQuestion, setVisionQuestion] = useState<PowerQuestion | null>(null);
  const [missionQuestion, setMissionQuestion] = useState<PowerQuestion | null>(null);
  const [visionAnswer, setVisionAnswer] = useState('');
  const [missionAnswer, setMissionAnswer] = useState('');
  const [savingVisionAnswer, setSavingVisionAnswer] = useState(false);
  const [savingMissionAnswer, setSavingMissionAnswer] = useState(false);
  const [visionIntrospectionOpen, setVisionIntrospectionOpen] = useState(false);
  const [missionIntrospectionOpen, setMissionIntrospectionOpen] = useState(false);
  const [visionResponses, setVisionResponses] = useState<QuestionResponse[]>([]);
  const [missionResponses, setMissionResponses] = useState<QuestionResponse[]>([]);
  const [allVisionAnswered, setAllVisionAnswered] = useState(false);
  const [allMissionAnswered, setAllMissionAnswered] = useState(false);
  
  // Week tracking
  const [weekStartDate, setWeekStartDate] = useState<string>('');
  const [weekStartDay, setWeekStartDay] = useState<'sunday' | 'monday'>('sunday');
  
  // Loading
  const [loadingRoleData, setLoadingRoleData] = useState(false);
  
  // Success feedback
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  
  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for back handler
  const flowStateRef = useRef<FlowState>(flowState);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  // Calculate week start date
  useEffect(() => {
    if (weekStartDay) {
      const weekStart = getWeekStart(new Date(), weekStartDay);
      setWeekStartDate(formatLocalDate(weekStart));
    }
  }, [weekStartDay]);

  // Back handler for parent component
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => {
        const currentFlowState = flowStateRef.current;
        
        if (currentFlowState === 'main' || currentFlowState === 'activate-roles') {
          return false;
        } else if (currentFlowState === 'prioritize') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'review-roles') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'role-reflection') {
          resetReflectionState();
          setFlowState('review-roles');
          return true;
        }
        return false;
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  function resetReflectionState() {
    setPurposeResponse('');
    setEditingPurpose(false);
    setDreamResponse('');
    setEditingDream(false);
    setOneThingText('');
    setExistingOneThingTask(null);
    setIdeaText('');
    setRoseText('');
    setThornText('');
    setThoughtText('');
    setVisionQuestion(null);
    setMissionQuestion(null);
    setVisionAnswer('');
    setMissionAnswer('');
    setVisionIntrospectionOpen(false);
    setMissionIntrospectionOpen(false);
    setVisionResponses([]);
    setMissionResponses([]);
    setAllVisionAnswered(false);
    setAllMissionAnswered(false);
    setSavedItems({});
    setSelectedReflectionRole(null);
    // Reset new consolidated states
    setActiveReflectionTab('rose');
    setShowReflectionsList(false);
    setWeekRoses([]);
    setWeekThorns([]);
    setWeekReflections([]);
    setShowIdeasList(false);
    setRoleIdeas([]);
    setShowTasksList(false);
    setRoleTasks([]);
  }
  }

  async function loadData() {
    try {
      const supabase = getSupabaseClient();

      // Load user's week start preference
      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('week_start_day')
        .eq('id', userId)
        .single();
      
      if (userData?.week_start_day) {
        setWeekStartDay(userData.week_start_day as 'sunday' | 'monday');
      }

      // Load all active roles (including dream field)
      const { data: rolesData, error: rolesError } = await supabase
        .from('0008-ap-roles')
        .select('id, label, category, icon, color, purpose, dream, is_active, priority_order, preset_role_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority_order', { ascending: true, nullsFirst: false })
        .order('label', { ascending: true });

      if (rolesError) throw rolesError;

      const activeRoles = rolesData || [];
      setRoles(activeRoles);

      const prioritized = activeRoles
        .filter(r => r.priority_order !== null && r.priority_order !== undefined)
        .sort((a, b) => (a.priority_order || 0) - (b.priority_order || 0));
      
      setPrioritizedRoles(prioritized);
      setSelectedRoleIds(prioritized.map(r => r.id));

      if (activeRoles.length === 0) {
        setFlowState('activate-roles');
      } else {
        setFlowState('main');
      }

    } catch (error) {
      console.error('Error loading roles data:', error);
      setFlowState('activate-roles');
    } finally {
      setLoading(false);
    }
  }

  // Load all data for role-reflection view
  async function loadRoleReflectionData(role: Role) {
    if (!weekStartDate) return;
    
    setLoadingRoleData(true);
    try {
      const supabase = getSupabaseClient();

      // 1. Load existing ONE Thing task/event for this role & week
      const { data: taskJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'task')
        .eq('role_id', role.id);

      const taskIds = taskJoins?.map(tj => tj.parent_id) || [];

      if (taskIds.length > 0) {
        const { data: oneThingTask } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, due_date, start_date, start_time, end_time, is_anytime, one_thing')
          .eq('user_id', userId)
          .in('id', taskIds)
          .eq('one_thing', true)
          .is('deleted_at', null)
          .not('status', 'in', '(completed,cancelled)')
          .or(`due_date.gte.${weekStartDate},start_date.gte.${weekStartDate}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (oneThingTask) {
          setExistingOneThingTask(oneThingTask);
          setOneThingText(oneThingTask.title || '');
        }
      }

      // 2. Load introspection questions for VISION (dream section)
      await loadIntrospectionData(role, 'vision');
      
      // 3. Load introspection questions for MISSION (purpose section)
      await loadIntrospectionData(role, 'mission');
      
      // 4. Load role items (roses, thorns, reflections, ideas, tasks)
      await loadRoleItemsData(role);

    } catch (error) {
      console.error('Error loading role reflection data:', error);
    } finally {
      setLoadingRoleData(false);
    }
  }

  async function loadIntrospectionData(role: Role, strategyType: 'vision' | 'mission') {
    try {
      const supabase = getSupabaseClient();

      // Get power questions for this strategy_type that match this role
      // Primary match: role_id matches the role's preset_role_id (for preset roles)
      // Fallback match: role_name matches role label (for custom roles without preset)
      const matchConditions: string[] = [];
      if (role.preset_role_id) {
        matchConditions.push(`role_id.eq.${role.preset_role_id}`);
      }
      matchConditions.push(`role_name.eq.${role.label}`);

      const { data: questions } = await supabase
        .from('0008-ap-power-questions')
        .select('id, question_text, question_context, ob_priority, strategy_type')
        .eq('strategy_type', strategyType)
        .eq('is_active', true)
        .or(matchConditions.join(','))
        .order('ob_priority', { ascending: true, nullsFirst: false });

      const allQuestions = questions || [];

      // Get user's existing responses
      const questionIds = allQuestions.map(q => q.id);
      let answeredIds: Set<string> = new Set();
      let responses: QuestionResponse[] = [];

      if (questionIds.length > 0) {
        const { data: existingResponses } = await supabase
          .from('0008-ap-question-responses')
          .select('id, question_id, response_text, created_at')
          .eq('user_id', userId)
          .in('question_id', questionIds)
          .order('created_at', { ascending: false });

        if (existingResponses) {
          answeredIds = new Set(existingResponses.map(r => r.question_id));
          responses = existingResponses;
        }
      }

      // Find first unanswered question (highest priority)
      const unanswered = allQuestions.find(q => !answeredIds.has(q.id));

      if (strategyType === 'vision') {
        setVisionQuestion(unanswered || null);
        setVisionResponses(responses);
        setAllVisionAnswered(!unanswered && allQuestions.length > 0);
      } else {
        setMissionQuestion(unanswered || null);
        setMissionResponses(responses);
        setAllMissionAnswered(!unanswered && allQuestions.length > 0);
      }
    } catch (error) {
      console.error(`Error loading ${strategyType} introspection:`, error);
    }
  }

async function loadRoleItemsData(role: Role) {
    if (!weekStartDate) return;
    
    try {
      const supabase = getSupabaseClient();
      
      // Calculate week end date
      const weekEnd = new Date(weekStartDate + 'T12:00:00');
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = formatLocalDate(weekEnd);

      // 1. Get all reflection IDs linked to this role
      const { data: reflectionJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'reflection')
        .eq('role_id', role.id);

      const reflectionIds = reflectionJoins?.map(rj => rj.parent_id) || [];

      if (reflectionIds.length > 0) {
        // Fetch roses for this week
        const { data: roses } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at')
          .in('id', reflectionIds)
          .eq('reflection_type', 'rose')
          .gte('created_at', weekStartDate)
          .lt('created_at', weekEndStr)
          .order('created_at', { ascending: false });
        setWeekRoses(roses || []);

        // Fetch thorns for this week
        const { data: thorns } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at')
          .in('id', reflectionIds)
          .eq('reflection_type', 'thorn')
          .gte('created_at', weekStartDate)
          .lt('created_at', weekEndStr)
          .order('created_at', { ascending: false });
        setWeekThorns(thorns || []);

        // Fetch reflections for this week
        const { data: reflections } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at')
          .in('id', reflectionIds)
          .eq('reflection_type', 'reflection')
          .gte('created_at', weekStartDate)
          .lt('created_at', weekEndStr)
          .order('created_at', { ascending: false });
        setWeekReflections(reflections || []);
      }

      // 2. Get deposit ideas for this role (all pending, not just this week)
      const { data: ideaJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'depositIdea')
        .eq('role_id', role.id);

      const ideaIds = ideaJoins?.map(ij => ij.parent_id) || [];

      if (ideaIds.length > 0) {
        const { data: ideas } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, one_thing')
          .in('id', ideaIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        setRoleIdeas(ideas || []);
      }

      // 3. Get tasks/events for this role (pending only)
      const { data: taskJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'task')
        .eq('role_id', role.id);

      const taskIds = taskJoins?.map(tj => tj.parent_id) || [];

      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, due_date, start_date, start_time, end_time, is_anytime, one_thing')
          .in('id', taskIds)
          .is('deleted_at', null)
          .not('status', 'in', '(completed,cancelled)')
          .order('created_at', { ascending: false });
        setRoleTasks(tasks || []);
      }

    } catch (error) {
      console.error('Error loading role items data:', error);
    }
  }

  // Slide transition helper
  function slideToState(newState: FlowState) {
    setShowTooltip(false);
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

  function handleManageRoles() {
    router.push('/(tabs)/roles');
  }

  function toggleRoleSelection(roleId: string) {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  }

  async function savePriorities() {
    if (selectedRoleIds.length < 3) {
      if (Platform.OS === 'web') {
        window.alert('Please prioritize at least 3 roles to continue.');
      } else {
        Alert.alert('Prioritize Roles', 'Please prioritize at least 3 roles to continue.');
      }
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      const { error: clearError } = await supabase
        .from('0008-ap-roles')
        .update({ priority_order: null })
        .eq('user_id', userId);

      if (clearError) throw clearError;

      for (let i = 0; i < selectedRoleIds.length; i++) {
        const { error: updateError } = await supabase
          .from('0008-ap-roles')
          .update({ priority_order: i + 1 })
          .eq('id', selectedRoleIds[i]);

        if (updateError) throw updateError;
      }

      await loadData();
      slideToState('main');
    } catch (error) {
      console.error('Error saving priorities:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save priorities. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save priorities. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ===== SAVE FUNCTIONS =====

  async function saveRolePurpose() {
    if (!selectedReflectionRole || !purposeResponse.trim()) return;

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await supabase
        .from('0008-ap-roles')
        .update({ purpose: purposeResponse.trim() })
        .eq('id', selectedReflectionRole.id);

      if (updateError) throw updateError;

      const updatedRole = { ...selectedReflectionRole, purpose: purposeResponse.trim() };
      setSelectedReflectionRole(updatedRole);
      setRoles(prev => prev.map(r => r.id === selectedReflectionRole.id ? updatedRole : r));
      setPrioritizedRoles(prev => prev.map(r => r.id === selectedReflectionRole.id ? updatedRole : r));
      setEditingPurpose(false);
      showSavedFeedback('purpose');
    } catch (error) {
      console.error('Error saving role purpose:', error);
      showErrorAlert('Failed to save purpose.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRoleDream() {
    if (!selectedReflectionRole || !dreamResponse.trim()) return;

    setSavingDream(true);
    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await supabase
        .from('0008-ap-roles')
        .update({ dream: dreamResponse.trim() })
        .eq('id', selectedReflectionRole.id);

      if (updateError) throw updateError;

      const updatedRole = { ...selectedReflectionRole, dream: dreamResponse.trim() };
      setSelectedReflectionRole(updatedRole);
      setRoles(prev => prev.map(r => r.id === selectedReflectionRole.id ? updatedRole : r));
      setPrioritizedRoles(prev => prev.map(r => r.id === selectedReflectionRole.id ? updatedRole : r));
      setEditingDream(false);
      showSavedFeedback('dream');
    } catch (error) {
      console.error('Error saving role dream:', error);
      showErrorAlert('Failed to save dream.');
    } finally {
      setSavingDream(false);
    }
  }

  function handleOneThingSaveAs(type: 'task' | 'event') {
    if (!oneThingText.trim()) {
      showErrorAlert('Please enter your ONE Thing first.');
      return;
    }
    setOneThingSaveType(type);
    // Default to today's date
    const today = formatLocalDate(new Date());
    setSelectedDate(today);
    // Smart default times: next 15-min interval + 15 min buffer, then +1hr end
    const now = new Date();
    const minutes = now.getMinutes();
    const nextQuarter = Math.ceil((minutes + 15) / 15) * 15;
    const startDate = new Date(now);
    startDate.setMinutes(nextQuarter, 0, 0);
    if (nextQuarter >= 60) {
      startDate.setHours(startDate.getHours() + Math.floor(nextQuarter / 60));
      startDate.setMinutes(nextQuarter % 60);
    }
    const startH = String(startDate.getHours()).padStart(2, '0');
    const startM = String(startDate.getMinutes()).padStart(2, '0');
    setSelectedTime(`${startH}:${startM}`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endH = String(endDate.getHours()).padStart(2, '0');
    const endM = String(endDate.getMinutes()).padStart(2, '0');
    setSelectedEndTime(`${endH}:${endM}`);
    setShowDatePicker(true);
  }

  async function confirmSaveOneThing() {
    if (!selectedReflectionRole || !oneThingText.trim() || !selectedDate) return;

    setSavingOneThing(true);
    setShowDatePicker(false);
    try {
      const supabase = getSupabaseClient();

      // Build insert data using proper columns
      const insertData: Record<string, any> = {
        user_id: userId,
        title: oneThingText.trim(),
        type: oneThingSaveType,
        status: 'pending',
        one_thing: true,
      };

      if (oneThingSaveType === 'task') {
        insertData.due_date = selectedDate;
        insertData.is_anytime = true;
      } else {
        // Event: use start_date + start_time + end_time
        insertData.start_date = selectedDate;
        insertData.start_time = `${selectedTime}:00`;
        insertData.end_time = `${selectedEndTime}:00`;
        insertData.is_anytime = false;
      }

      // Insert into tasks
      const { data: newTask, error: insertError } = await supabase
        .from('0008-ap-tasks')
        .insert(insertData)
        .select('id, title, type, status, due_date, start_date, start_time, end_time, is_anytime, one_thing')
        .single();

      if (insertError) throw insertError;

      // Link to role via join table
      const { error: joinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert({
          parent_type: 'task',
          parent_id: newTask.id,
          role_id: selectedReflectionRole.id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setExistingOneThingTask(newTask);
      showSavedFeedback('oneThing');

    } catch (error) {
      console.error('Error saving ONE Thing:', error);
      showErrorAlert('Failed to save ONE Thing.');
    } finally {
      setSavingOneThing(false);
    }
  }

  async function saveDepositIdea() {
    if (!selectedReflectionRole || !ideaText.trim()) return;

    setSavingIdea(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newIdea, error: insertError } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({
          user_id: userId,
          title: ideaText.trim(),
          one_thing: true,
          is_active: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Link to role
      const { error: joinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert({
          parent_type: 'depositIdea',
          parent_id: newIdea.id,
          role_id: selectedReflectionRole.id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setIdeaText('');
      showSavedFeedback('idea');
      // Refresh ideas list
      if (selectedReflectionRole) {
        loadRoleItemsData(selectedReflectionRole);
      }
    } catch (error) {
      console.error('Error saving deposit idea:', error);
      showErrorAlert('Failed to save idea.');
    } finally {
      setSavingIdea(false);
    }
  }

  async function saveRose() {
    if (!selectedReflectionRole || !roseText.trim()) return;

    setSavingRose(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newReflection, error: insertError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: roseText.trim(),
          reflection_type: 'rose',
          daily_rose: true,
          one_thing: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Link to role
      const { error: joinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert({
          parent_type: 'reflection',
          parent_id: newReflection.id,
          role_id: selectedReflectionRole.id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setRoseText('');
      showSavedFeedback('rose');
      // Refresh lists
      if (selectedReflectionRole) {
        loadRoleItemsData(selectedReflectionRole);
      }
    } catch (error) {
      console.error('Error saving rose:', error);
      showErrorAlert('Failed to save rose.');
    } finally {
      setSavingRose(false);
    }
  }

  async function saveThorn() {
    if (!selectedReflectionRole || !thornText.trim()) return;

    setSavingThorn(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newReflection, error: insertError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: thornText.trim(),
          reflection_type: 'thorn',
          daily_thorn: true,
          one_thing: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Link to role
      const { error: joinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert({
          parent_type: 'reflection',
          parent_id: newReflection.id,
          role_id: selectedReflectionRole.id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setThornText('');
      showSavedFeedback('thorn');
      // Refresh lists
      if (selectedReflectionRole) {
        loadRoleItemsData(selectedReflectionRole);
      }
    } catch (error) {
      console.error('Error saving thorn:', error);
      showErrorAlert('Failed to save thorn.');
    } finally {
      setSavingThorn(false);
    }
  }

  async function saveThought() {
    if (!selectedReflectionRole || !thoughtText.trim()) return;

    setSavingThought(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newReflection, error: insertError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: thoughtText.trim(),
          reflection_type: 'reflection',
          one_thing: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Link to role
      const { error: joinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert({
          parent_type: 'reflection',
          parent_id: newReflection.id,
          role_id: selectedReflectionRole.id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setThoughtText('');
      showSavedFeedback('thought');
      // Refresh lists
      if (selectedReflectionRole) {
        loadRoleItemsData(selectedReflectionRole);
      }
    } catch (error) {
      console.error('Error saving thought:', error);
      showErrorAlert('Failed to save thought.');
    } finally {
      setSavingThought(false);
    }
  }

  async function saveIntrospectionAnswer(strategyType: 'vision' | 'mission') {
    const question = strategyType === 'vision' ? visionQuestion : missionQuestion;
    const answer = strategyType === 'vision' ? visionAnswer : missionAnswer;
    if (!question || !answer.trim() || !selectedReflectionRole) return;

    const setSavingFn = strategyType === 'vision' ? setSavingVisionAnswer : setSavingMissionAnswer;
    setSavingFn(true);

    try {
      const supabase = getSupabaseClient();

      const { error: insertError } = await supabase
        .from('0008-ap-question-responses')
        .insert({
          user_id: userId,
          question_id: question.id,
          response_text: answer.trim(),
          context_type: 'weekly_alignment',
          domain: 'roles',
          week_start: weekStartDate,
        });

      if (insertError) throw insertError;

      // Clear answer and reload next question
      if (strategyType === 'vision') {
        setVisionAnswer('');
      } else {
        setMissionAnswer('');
      }
      
      await loadIntrospectionData(selectedReflectionRole, strategyType);
      showSavedFeedback(`${strategyType}Answer`);
    } catch (error) {
      console.error(`Error saving ${strategyType} answer:`, error);
      showErrorAlert('Failed to save response.');
    } finally {
      setSavingFn(false);
    }
  }

  // ===== HELPERS =====

  function showSavedFeedback(key: string) {
    setSavedItems(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSavedItems(prev => ({ ...prev, [key]: false }));
    }, 2000);
  }

  function showErrorAlert(message: string) {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Error', message);
    }
  }

  function handleContinueToWellnessZones() {
    onDataCapture({
      rolesReviewed: selectedRoleIds,
      roleHealthFlags: {},
    });
    onNext();
  }

  function getCategoryColor(category: string): string {
    switch (category?.toLowerCase()) {
      case 'personal': return '#9370DB';
      case 'professional': return '#3B82F6';
      case 'community': return '#10B981';
      case 'family': return '#F59E0B';
      case 'home & stewardship': return '#8B5CF6';
      case 'recreation': return '#EC4899';
      case 'caregiving': return '#EF4444';
      default: return '#6B7280';
    }
  }

  function getSelectionNumber(roleId: string): number | null {
    const index = selectedRoleIds.indexOf(roleId);
    return index >= 0 ? index + 1 : null;
  }

  function getAllRolesSorted(): Role[] {
    const prioritizedIds = new Set(prioritizedRoles.map(r => r.id));
    const nonPrioritized = roles
      .filter(r => !prioritizedIds.has(r.id))
      .sort((a, b) => a.label.localeCompare(b.label));
    
    return [...prioritizedRoles, ...nonPrioritized];
  }

  // ===== RENDER HELPER: Saved badge =====
  function renderSavedBadge(key: string) {
    if (!savedItems[key]) return null;
    return (
      <View style={[styles.savedBadge, { backgroundColor: '#10b981' }]}>
        <Check size={12} color="#FFFFFF" />
        <Text style={styles.savedBadgeText}>Saved</Text>
      </View>
    );
  }

  // ===== RENDER HELPER: Inline save button =====
  function renderSaveButton(
    onPress: () => void,
    isSaving: boolean,
    isDisabled: boolean,
    color: string,
    label: string = 'Save',
  ) {
    return (
      <TouchableOpacity
        style={[
          styles.inlineSaveButton,
          {
            backgroundColor: !isDisabled ? color : colors.border,
            opacity: isSaving ? 0.7 : 1,
          },
        ]}
        onPress={onPress}
        disabled={isSaving || isDisabled}
        activeOpacity={0.8}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.inlineSaveButtonText}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  }

  // ===== RENDER: LOADING STATE =====
  if (flowState === 'loading' || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ROLES_COLOR} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your roles...
        </Text>
      </View>
    );
  }

  // ===== RENDER: ACTIVATE ROLES STATE =====
  if (flowState === 'activate-roles') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={[styles.compassContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
              <Image source={CompassRolesIcon} style={styles.compassIcon} resizeMode="contain" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Wing Check: Roles</Text>
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
                Your life roles represent the different hats you wear—father, professional, friend, etc.
                Before continuing, you'll need to activate some roles first.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.identityCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
          <View style={styles.identityHeader}>
            <View style={[styles.identityIconContainer, { backgroundColor: ROLES_COLOR }]}>
              <RolesIcon size={14} color="#FFFFFF" />
            </View>
            <Text style={[styles.identityLabel, { color: ROLES_COLOR }]}>ACTIVATE MY ROLES</Text>
          </View>
          
          <Text style={[styles.identityText, { color: colors.text }]}>No roles activated yet</Text>
          
          <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
            Roles are the different hats you wear in life—like Father, Business Owner, Friend, etc.
            You'll need to activate at least 3 roles before you can prioritize them.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: ROLES_COLOR }]}
          onPress={handleManageRoles}
          activeOpacity={0.8}
        >
          <Settings size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Manage Roles</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={onNext} activeOpacity={0.7}>
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ===== RENDER: PRIORITIZE STATE =====
  if (flowState === 'prioritize') {
    const rolesByCategory = roles.reduce<Record<string, Role[]>>((acc, role) => {
      const category = role.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(role);
      return acc;
    }, {});
    const categories = Object.keys(rolesByCategory);

    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
                <Image source={CompassRolesIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Prioritize Roles</Text>
              </View>
            </View>
          </View>

          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {selectedRoleIds.length} of {roles.length} roles prioritized
              {selectedRoleIds.length < 3 && ` (minimum 3 required)`}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: selectedRoleIds.length >= 3 ? ROLES_COLOR : '#F59E0B',
                    width: `${Math.min((selectedRoleIds.length / Math.max(roles.length, 3)) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {categories.map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>{category}</Text>
              <View style={styles.rolesGrid}>
                {rolesByCategory[category].map(role => {
                  const isSelected = selectedRoleIds.includes(role.id);
                  const selectionNumber = getSelectionNumber(role.id);
                  const categoryColor = getCategoryColor(role.category);

                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleCard,
                        {
                          backgroundColor: isSelected ? `${categoryColor}15` : colors.surface,
                          borderColor: isSelected ? categoryColor : colors.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => toggleRoleSelection(role.id)}
                      activeOpacity={0.7}
                    >
                      {isSelected && selectionNumber && (
                        <View style={[styles.selectionBadge, { backgroundColor: categoryColor }]}>
                          <Text style={styles.selectionBadgeText}>{selectionNumber}</Text>
                        </View>
                      )}
                      <View style={[styles.roleIconContainer, { backgroundColor: `${categoryColor}20` }]}>
                        <RoleIcon name={role.icon || role.label} color={categoryColor} size={28} />
                      </View>
                      <Text style={[styles.roleLabel, { color: isSelected ? categoryColor : colors.text }]} numberOfLines={2}>
                        {role.label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkContainer, { backgroundColor: categoryColor }]}>
                          <Check size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: selectedRoleIds.length >= 3 ? ROLES_COLOR : colors.border, opacity: saving ? 0.7 : 1 }]}
            onPress={savePriorities}
            disabled={saving || selectedRoleIds.length < 3}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Save Priorities</Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: REVIEW ROLES STATE (Design Your Legacy) =====
  if (flowState === 'review-roles') {
    const allRolesSorted = getAllRolesSorted();
    
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
                <Image source={CompassRolesIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Design Your Legacy</Text>
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
                  This is where you shape each role in your life. Tap any role to open its Living Vision Board — set your ONE Thing for the week, capture ideas, record roses and thorns, and define your dream and purpose. Roles with a green checkmark already have a purpose or dream defined.
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.identityCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: ROLES_COLOR }]}>
                <RolesIcon size={14} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: ROLES_COLOR }]}>DESIGN YOUR LEGACY</Text>
            </View>
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              Tap a role to open your Living Vision Board
            </Text>
          </View>

          {/* All Roles List - NO R1/R2/R3 badges, priority sort maintained */}
          {allRolesSorted.map((role) => {
            const categoryColor = getCategoryColor(role.category);
            const hasPurpose = !!role.purpose;
            const hasDream = !!role.dream;
            
            return (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.reviewRoleCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: (hasPurpose || hasDream) ? '#10b981' : colors.border,
                    borderLeftColor: categoryColor,
                    borderLeftWidth: 4,
                  }
                ]}
                onPress={() => {
                  setSelectedReflectionRole(role);
                  setPurposeResponse(role.purpose || '');
                  setDreamResponse(role.dream || '');
                  loadRoleReflectionData(role);
                  slideToState('role-reflection');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.reviewRoleLeft}>
                  <View style={[styles.reviewRoleIconWrap, { backgroundColor: `${categoryColor}20` }]}>
                    <RoleIcon name={role.icon || role.label} color={categoryColor} size={24} />
                  </View>
                  <View style={styles.reviewRoleInfo}>
                    <Text style={[styles.reviewRoleLabel, { color: colors.text }]}>{role.label}</Text>
                    {role.purpose ? (
                      <Text style={[styles.reviewRolePurpose, { color: colors.textSecondary }]} numberOfLines={1}>
                        {role.purpose}
                      </Text>
                    ) : (
                      <Text style={[styles.reviewRolePurpose, { color: '#F59E0B' }]}>
                        Tap to define purpose & dream
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.reviewRoleRight}>
                  {(hasPurpose || hasDream) && (
                    <View style={[styles.checkCircle, { backgroundColor: '#10b981' }]}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  )}
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: ROLES_COLOR }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: ROLES_COLOR }]}>Done Reviewing</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: ROLE REFLECTION STATE ("My Living Vision Board") =====
  if (flowState === 'role-reflection' && selectedReflectionRole) {
    const categoryColor = getCategoryColor(selectedReflectionRole.category);
    const weekDates = weekStartDate ? getWeekDates(weekStartDate) : [];
    
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ===== HEADER: My Living Vision Board ===== */}
            <View style={styles.headerSection}>
              <View style={styles.headerRow}>
                <View style={[styles.compassContainer, { backgroundColor: `${categoryColor}15` }]}>
                  <RoleIcon 
                    name={selectedReflectionRole.icon || selectedReflectionRole.label} 
                    color={categoryColor} 
                    size={40} 
                  />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.stepLabel, { color: categoryColor }]}>My Living Vision Board</Text>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {selectedReflectionRole.label}
                  </Text>
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
                    This is your Living Vision Board for your {selectedReflectionRole.label} role. Use it to stay intentional each week:{'\n\n'}
                    • ONE Thing — pick the single most important action for this role this week and save it as a task or event.{'\n'}
                    • Capture an Idea — save ideas you can't act on yet for later.{'\n'}
                    • Roses & Thorns — note what's going well and what's challenging.{'\n'}
                    • Capture a Thought — record any insight or reflection.{'\n'}
                    • Dream & Purpose — define the bigger picture for this role, and use Deeper Introspection to explore it further.{'\n'}
                    • Key Relationships — track the people who matter most in this role.{'\n'}
                    • Journal — a dedicated space for ongoing notes about this role.
                  </Text>
                </View>
              )}
            </View>

            {loadingRoleData && (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={categoryColor} />
                <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 4 }]}>Loading...</Text>
              </View>
            )}

            {/* ===== SECTION 1: ONE Thing This Week ===== */}
            <View style={[styles.card, { backgroundColor: `${categoryColor}08`, borderColor: `${categoryColor}30` }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <RolesIcon size={16} color={categoryColor} />
                  <Text style={[styles.cardLabel, { color: categoryColor, marginLeft: 6 }]}>ONE THING THIS WEEK</Text>
                </View>
                {renderSavedBadge('oneThing')}
              </View>
              
              <Text style={[styles.questionText, { color: colors.text }]}>
                What is the ONE thing I want to do as a {selectedReflectionRole.label} this week?
              </Text>

              {existingOneThingTask ? (
                <View style={[styles.existingItemCard, { backgroundColor: colors.surface, borderColor: `${categoryColor}30` }]}>
                  <View style={[styles.existingItemRow, { justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                      {existingOneThingTask.type === 'event' ? (
                        <Image source={CalendarIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                      ) : (
                        <Image source={TaskListIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                      )}
                      <Text style={[styles.existingItemText, { color: colors.text }]} numberOfLines={2}>
                        {existingOneThingTask.title}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setExistingOneThingTask(null);
                        setOneThingText(existingOneThingTask.title || '');
                      }}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      style={{ marginLeft: 8 }}
                    >
                      <Pencil size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {(existingOneThingTask.due_date || existingOneThingTask.start_date) && (
                    <Text style={[styles.existingItemMeta, { color: colors.textSecondary }]}>
                      {formatShortDate((existingOneThingTask.due_date || existingOneThingTask.start_date || '').split('T')[0])}
                      {existingOneThingTask.type === 'event' && existingOneThingTask.start_time
                        ? ` • ${existingOneThingTask.start_time.slice(0, 5)}–${(existingOneThingTask.end_time || '').slice(0, 5)}`
                        : ''}
                      {` • ${existingOneThingTask.type}`}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="My ONE thing this week is..."
                      placeholderTextColor={colors.textSecondary}
                      value={oneThingText}
                      onChangeText={setOneThingText}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>

                  <Text style={[styles.saveAsLabel, { color: colors.textSecondary }]}>Save as:</Text>
                  <View style={styles.saveAsRow}>
                    <TouchableOpacity
                      style={[styles.saveAsButton, { backgroundColor: '#3B82F615', borderColor: '#3B82F640' }]}
                      onPress={() => handleOneThingSaveAs('task')}
                      disabled={savingOneThing || !oneThingText.trim()}
                      activeOpacity={0.7}
                    >
                      <Image source={TaskListIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
                      <Text style={[styles.saveAsButtonText, { color: '#3B82F6' }]}>Task</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.saveAsButton, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF640' }]}
                      onPress={() => handleOneThingSaveAs('event')}
                      disabled={savingOneThing || !oneThingText.trim()}
                      activeOpacity={0.7}
                    >
                      <Image source={CalendarIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
                      <Text style={[styles.saveAsButtonText, { color: '#8B5CF6' }]}>Event</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {savingOneThing && (
                    <ActivityIndicator size="small" color={categoryColor} style={{ marginTop: 8 }} />
                  )}
                </>
              )}
            </View>

            {/* ===== SECTION 2: Capture an Idea ===== */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Image source={DepositIdeaIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={[styles.cardLabel, { color: '#F59E0B', marginLeft: 6 }]}>CAPTURE AN IDEA</Text>
                </View>
                {renderSavedBadge('idea')}
              </View>
              
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                Is there an idea that perhaps you are unable to act on this week, but would like to capture as a future action?
              </Text>
              
              <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textInputSmall, { color: colors.text }]}
                  placeholder="Capture your idea..."
                  placeholderTextColor={colors.textSecondary}
                  value={ideaText}
                  onChangeText={setIdeaText}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>
              
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: 8,
                  backgroundColor: '#FFFFFF',
                  borderColor: '#F59E0B',
                  borderWidth: 1.5,
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  opacity: savingIdea ? 0.7 : (!ideaText.trim() ? 0.5 : 1),
                }}
                onPress={saveDepositIdea}
                disabled={savingIdea || !ideaText.trim()}
                activeOpacity={0.7}
              >
                {savingIdea ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <>
                    <Image source={DepositIdeaIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
                    <Text style={{ color: '#F59E0B', fontSize: 15, fontWeight: '600' }}>Save Idea</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ===== SECTION 3: Roses / Thorns / Reflections (Tabbed) ===== */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Tab Header */}
              <View style={{ flexDirection: 'row', marginBottom: 16, borderRadius: 8, backgroundColor: colors.background, padding: 4 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 6,
                    backgroundColor: activeReflectionTab === 'rose' ? '#FFFFFF' : 'transparent',
                  }}
                  onPress={() => setActiveReflectionTab('rose')}
                  activeOpacity={0.7}
                >
                  <Image source={RoseIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={{ color: ROSE_COLOR, fontSize: 13, fontWeight: activeReflectionTab === 'rose' ? '700' : '500' }}>Rose</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 6,
                    backgroundColor: activeReflectionTab === 'thorn' ? '#FFFFFF' : 'transparent',
                  }}
                  onPress={() => setActiveReflectionTab('thorn')}
                  activeOpacity={0.7}
                >
                  <Image source={ThornIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={{ color: THORN_COLOR, fontSize: 13, fontWeight: activeReflectionTab === 'thorn' ? '700' : '500' }}>Thorn</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 6,
                    backgroundColor: activeReflectionTab === 'reflection' ? '#FFFFFF' : 'transparent',
                  }}
                  onPress={() => setActiveReflectionTab('reflection')}
                  activeOpacity={0.7}
                >
                  <Image source={ReflectionsIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={{ color: '#10B981', fontSize: 13, fontWeight: activeReflectionTab === 'reflection' ? '700' : '500' }}>Reflect</Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content */}
              {activeReflectionTab === 'rose' && (
                <View>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardLabel, { color: ROSE_COLOR }]}>CAPTURE A ROSE</Text>
                    {renderSavedBadge('rose')}
                  </View>
                  <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                    What's going well in your {selectedReflectionRole?.label} role?
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textInputSmall, { color: colors.text }]}
                      placeholder="What's going well..."
                      placeholderTextColor={colors.textSecondary}
                      value={roseText}
                      onChangeText={setRoseText}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      gap: 8,
                      backgroundColor: '#FFFFFF',
                      borderColor: ROSE_COLOR,
                      borderWidth: 1.5,
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      opacity: savingRose ? 0.7 : (!roseText.trim() ? 0.5 : 1),
                    }}
                    onPress={saveRose}
                    disabled={savingRose || !roseText.trim()}
                    activeOpacity={0.7}
                  >
                    {savingRose ? (
                      <ActivityIndicator size="small" color={ROSE_COLOR} />
                    ) : (
                      <>
                        <Image source={RoseIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
                        <Text style={{ color: ROSE_COLOR, fontSize: 15, fontWeight: '600' }}>Save Rose</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {activeReflectionTab === 'thorn' && (
                <View>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardLabel, { color: THORN_COLOR }]}>CAPTURE A THORN</Text>
                    {renderSavedBadge('thorn')}
                  </View>
                  <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                    What's been challenging in your {selectedReflectionRole?.label} role?
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textInputSmall, { color: colors.text }]}
                      placeholder="What's been challenging..."
                      placeholderTextColor={colors.textSecondary}
                      value={thornText}
                      onChangeText={setThornText}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      gap: 8,
                      backgroundColor: '#FFFFFF',
                      borderColor: THORN_COLOR,
                      borderWidth: 1.5,
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      opacity: savingThorn ? 0.7 : (!thornText.trim() ? 0.5 : 1),
                    }}
                    onPress={saveThorn}
                    disabled={savingThorn || !thornText.trim()}
                    activeOpacity={0.7}
                  >
                    {savingThorn ? (
                      <ActivityIndicator size="small" color={THORN_COLOR} />
                    ) : (
                      <>
                        <Image source={ThornIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
                        <Text style={{ color: THORN_COLOR, fontSize: 15, fontWeight: '600' }}>Save Thorn</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {activeReflectionTab === 'reflection' && (
                <View>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardLabel, { color: '#10B981' }]}>CAPTURE A THOUGHT</Text>
                    {renderSavedBadge('thought')}
                  </View>
                  <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                    Any other insights about your {selectedReflectionRole?.label} role?
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textInputSmall, { color: colors.text }]}
                      placeholder="Your thoughts..."
                      placeholderTextColor={colors.textSecondary}
                      value={thoughtText}
                      onChangeText={setThoughtText}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      gap: 8,
                      backgroundColor: '#FFFFFF',
                      borderColor: '#10B981',
                      borderWidth: 1.5,
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      opacity: savingThought ? 0.7 : (!thoughtText.trim() ? 0.5 : 1),
                    }}
                    onPress={saveThought}
                    disabled={savingThought || !thoughtText.trim()}
                    activeOpacity={0.7}
                  >
                    {savingThought ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Image source={ReflectionsIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
                        <Text style={{ color: '#10B981', fontSize: 15, fontWeight: '600' }}>Save Thought</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Collapsible List for This Week */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  marginTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
                onPress={() => setShowReflectionsList(!showReflectionsList)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                  This Week's {activeReflectionTab === 'rose' ? 'Roses' : activeReflectionTab === 'thorn' ? 'Thorns' : 'Reflections'} ({activeReflectionTab === 'rose' ? weekRoses.length : activeReflectionTab === 'thorn' ? weekThorns.length : weekReflections.length})
                </Text>
                {showReflectionsList ? (
                  <ChevronUp size={18} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {showReflectionsList && (
                <View style={{ marginTop: 8 }}>
                  {(activeReflectionTab === 'rose' ? weekRoses : activeReflectionTab === 'thorn' ? weekThorns : weekReflections).length === 0 ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontStyle: 'italic', paddingVertical: 8 }}>
                      No {activeReflectionTab === 'rose' ? 'roses' : activeReflectionTab === 'thorn' ? 'thorns' : 'reflections'} captured this week yet.
                    </Text>
                  ) : (
                    (activeReflectionTab === 'rose' ? weekRoses : activeReflectionTab === 'thorn' ? weekThorns : weekReflections).map((item) => (
                      <View key={item.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                          {new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>

            {/* ===== SECTION 6: My Dream for this Role ===== */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: categoryColor }]}>MY DREAM FOR THIS ROLE</Text>
                {selectedReflectionRole.dream && !editingDream && (
                  <TouchableOpacity onPress={() => setEditingDream(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pencil size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                {renderSavedBadge('dream')}
              </View>
              
              <Text style={[styles.questionText, { color: colors.text, marginBottom: 12 }]}>
                What is your dream as a {selectedReflectionRole.label}?
              </Text>

              {selectedReflectionRole.dream && !editingDream ? (
                <Text style={[styles.statementText, { color: colors.text }]}>
                  "{selectedReflectionRole.dream}"
                </Text>
              ) : (
                <>
                  <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="My dream as this role is..."
                      placeholderTextColor={colors.textSecondary}
                      value={dreamResponse}
                      onChangeText={setDreamResponse}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                  {renderSaveButton(saveRoleDream, savingDream, !dreamResponse.trim(), categoryColor, 'Save Dream')}
                </>
              )}

              {/* Deeper Introspection (Vision) */}
              <TouchableOpacity
                style={[styles.introspectionToggle, { borderColor: colors.border }]}
                onPress={() => setVisionIntrospectionOpen(!visionIntrospectionOpen)}
                activeOpacity={0.7}
              >
                <Text style={[styles.introspectionToggleText, { color: categoryColor }]}>
                  Deeper Introspection
                </Text>
                {visionIntrospectionOpen ? (
                  <ChevronUp size={18} color={categoryColor} />
                ) : (
                  <ChevronDown size={18} color={categoryColor} />
                )}
              </TouchableOpacity>

              {visionIntrospectionOpen && (
                <View style={styles.introspectionContent}>
                  {allVisionAnswered ? (
                    <Text style={[styles.allAnsweredText, { color: colors.textSecondary }]}>
                      You have answered all introspection questions for this role's vision — review your responses regularly to stay aligned.
                    </Text>
                  ) : visionQuestion ? (
                    <>
                      <Text style={[styles.introspectionQuestion, { color: colors.text }]}>
                        {visionQuestion.question_text}
                      </Text>
                      {visionQuestion.question_context && (
                        <Text style={[styles.introspectionContext, { color: colors.textSecondary }]}>
                          {visionQuestion.question_context}
                        </Text>
                      )}
                      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.textInputSmall, { color: colors.text }]}
                          placeholder="Your reflection..."
                          placeholderTextColor={colors.textSecondary}
                          value={visionAnswer}
                          onChangeText={setVisionAnswer}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                      {renderSaveButton(
                        () => saveIntrospectionAnswer('vision'),
                        savingVisionAnswer,
                        !visionAnswer.trim(),
                        categoryColor,
                        'Save Response'
                      )}
                      {renderSavedBadge('visionAnswer')}
                    </>
                  ) : (
                    <Text style={[styles.allAnsweredText, { color: colors.textSecondary }]}>
                      No introspection questions available for this role yet.
                    </Text>
                  )}

                  {/* Introspection Journal for Vision */}
                  {visionResponses.length > 0 && (
                    <View style={styles.introspectionJournal}>
                      <Text style={[styles.journalSubheader, { color: categoryColor }]}>
                        {selectedReflectionRole.label} Vision Reflections
                      </Text>
                      {visionResponses.slice(0, 5).map((resp) => (
                        <View key={resp.id} style={[styles.journalEntry, { borderColor: colors.border }]}>
                          <Text style={[styles.journalEntryText, { color: colors.text }]} numberOfLines={3}>
                            {resp.response_text}
                          </Text>
                          <Text style={[styles.journalEntryDate, { color: colors.textSecondary }]}>
                            {new Date(resp.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ===== SECTION 7: My Purpose in this Role ===== */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: categoryColor }]}>MY PURPOSE IN THIS ROLE</Text>
                {selectedReflectionRole.purpose && !editingPurpose && (
                  <TouchableOpacity onPress={() => setEditingPurpose(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pencil size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                {renderSavedBadge('purpose')}
              </View>

              {selectedReflectionRole.purpose && !editingPurpose ? (
                <Text style={[styles.statementText, { color: colors.text }]}>
                  "{selectedReflectionRole.purpose}"
                </Text>
              ) : (
                <>
                  <Text style={[styles.hintText, { color: colors.textSecondary, marginBottom: 12 }]}>
                    Describe what success looks like in this role.
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="My purpose in this role is to..."
                      placeholderTextColor={colors.textSecondary}
                      value={purposeResponse}
                      onChangeText={setPurposeResponse}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                  {renderSaveButton(saveRolePurpose, saving, !purposeResponse.trim(), categoryColor, 'Save Purpose')}
                </>
              )}

              {/* Deeper Introspection (Mission) */}
              <TouchableOpacity
                style={[styles.introspectionToggle, { borderColor: colors.border }]}
                onPress={() => setMissionIntrospectionOpen(!missionIntrospectionOpen)}
                activeOpacity={0.7}
              >
                <Text style={[styles.introspectionToggleText, { color: categoryColor }]}>
                  Deeper Introspection
                </Text>
                {missionIntrospectionOpen ? (
                  <ChevronUp size={18} color={categoryColor} />
                ) : (
                  <ChevronDown size={18} color={categoryColor} />
                )}
              </TouchableOpacity>

              {missionIntrospectionOpen && (
                <View style={styles.introspectionContent}>
                  {allMissionAnswered ? (
                    <Text style={[styles.allAnsweredText, { color: colors.textSecondary }]}>
                      You have answered all introspection questions for this role's mission — review your responses regularly to stay aligned.
                    </Text>
                  ) : missionQuestion ? (
                    <>
                      <Text style={[styles.introspectionQuestion, { color: colors.text }]}>
                        {missionQuestion.question_text}
                      </Text>
                      {missionQuestion.question_context && (
                        <Text style={[styles.introspectionContext, { color: colors.textSecondary }]}>
                          {missionQuestion.question_context}
                        </Text>
                      )}
                      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.textInputSmall, { color: colors.text }]}
                          placeholder="Your reflection..."
                          placeholderTextColor={colors.textSecondary}
                          value={missionAnswer}
                          onChangeText={setMissionAnswer}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                      {renderSaveButton(
                        () => saveIntrospectionAnswer('mission'),
                        savingMissionAnswer,
                        !missionAnswer.trim(),
                        categoryColor,
                        'Save Response'
                      )}
                      {renderSavedBadge('missionAnswer')}
                    </>
                  ) : (
                    <Text style={[styles.allAnsweredText, { color: colors.textSecondary }]}>
                      No introspection questions available for this role yet.
                    </Text>
                  )}

                  {/* Introspection Journal for Mission */}
                  {missionResponses.length > 0 && (
                    <View style={styles.introspectionJournal}>
                      <Text style={[styles.journalSubheader, { color: categoryColor }]}>
                        {selectedReflectionRole.label} Purpose Reflections
                      </Text>
                      {missionResponses.slice(0, 5).map((resp) => (
                        <View key={resp.id} style={[styles.journalEntry, { borderColor: colors.border }]}>
                          <Text style={[styles.journalEntryText, { color: colors.text }]} numberOfLines={3}>
                            {resp.response_text}
                          </Text>
                          <Text style={[styles.journalEntryDate, { color: colors.textSecondary }]}>
                            {new Date(resp.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ===== SECTION 8: Key Relationships (Placeholder) ===== */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <RolesIcon size={16} color={categoryColor} />
                  <Text style={[styles.cardLabel, { color: categoryColor, marginLeft: 6 }]}>KEY RELATIONSHIPS</Text>
                </View>
              </View>
              
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                What Key Relationships (people) are important to your success in this role?
              </Text>
              
              <TouchableOpacity
                style={[styles.placeholderButton, { borderColor: categoryColor }]}
                onPress={() => {
                  // TODO: Trigger standard Key Relationship creation flow
                  router.push('/(tabs)/roles');
                }}
                activeOpacity={0.7}
              >
                <Plus size={16} color={categoryColor} />
                <Text style={[styles.placeholderButtonText, { color: categoryColor }]}>
                  Add Key Relationship
                </Text>
              </TouchableOpacity>
            </View>

            {/* ===== SECTION 9: [Role] Journal ===== */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <MessageCircle size={16} color={categoryColor} />
                  <Text style={[styles.cardLabel, { color: categoryColor, marginLeft: 6 }]}>
                    {selectedReflectionRole.label.toUpperCase()} JOURNAL
                  </Text>
                </View>
              </View>
              
              <JournalView
                userId={userId}
                colors={colors}
                scope={{ type: 'role', id: selectedReflectionRole.id, name: selectedReflectionRole.label }}
              />
            </View>

            {/* Back to Roles Button */}
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: categoryColor }]}
              onPress={() => {
                resetReflectionState();
                slideToState('review-roles');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: categoryColor }]}>Back to Roles</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ===== DATE PICKER MODAL (for ONE Thing Task/Event) ===== */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {oneThingSaveType === 'event' ? 'Pick Day & Time' : 'Pick a Day'}
              </Text>
              
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                "{oneThingText}"
              </Text>

              {/* Day selection */}
              <View style={styles.dayGrid}>
                {weekDates.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    style={[
                      styles.dayButton,
                      {
                        backgroundColor: selectedDate === d.value ? categoryColor : colors.surface,
                        borderColor: selectedDate === d.value ? categoryColor : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedDate(d.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      { color: selectedDate === d.value ? '#FFFFFF' : colors.text },
                    ]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time selection (events only) */}
              {oneThingSaveType === 'event' && (
                <View style={styles.timeRow}>
                  <View style={styles.timePickerRow}>
                    <Text style={[styles.timePickerLabel, { color: colors.textSecondary }]}>Start</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.timeScroller}
                      contentContainerStyle={styles.timeScrollerContent}
                    >
                      {Array.from({ length: 48 }, (_, i) => {
                        const h = String(Math.floor(i / 2)).padStart(2, '0');
                        const m = i % 2 === 0 ? '00' : '30';
                        const val = `${h}:${m}`;
                        const isSelected = selectedTime === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[
                              styles.timeChip,
                              {
                                backgroundColor: isSelected ? categoryColor : colors.surface,
                                borderColor: isSelected ? categoryColor : colors.border,
                              },
                            ]}
                            onPress={() => {
                              setSelectedTime(val);
                              // Auto-advance end time to +1hr
                              const endH = String((Math.floor(i / 2) + 1) % 24).padStart(2, '0');
                              setSelectedEndTime(`${endH}:${m}`);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.timeChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                              {val}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                  <View style={styles.timePickerRow}>
                    <Text style={[styles.timePickerLabel, { color: colors.textSecondary }]}>End</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.timeScroller}
                      contentContainerStyle={styles.timeScrollerContent}
                    >
                      {Array.from({ length: 48 }, (_, i) => {
                        const h = String(Math.floor(i / 2)).padStart(2, '0');
                        const m = i % 2 === 0 ? '00' : '30';
                        const val = `${h}:${m}`;
                        const isSelected = selectedEndTime === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[
                              styles.timeChip,
                              {
                                backgroundColor: isSelected ? categoryColor : colors.surface,
                                borderColor: isSelected ? categoryColor : colors.border,
                              },
                            ]}
                            onPress={() => setSelectedEndTime(val)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.timeChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                              {val}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalCancel, { borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalConfirm, { backgroundColor: categoryColor }]}
                  onPress={confirmSaveOneThing}
                  disabled={!selectedDate}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalConfirmText}>
                    Save {oneThingSaveType === 'event' ? 'Event' : 'Task'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    );
  }

  // ===== RENDER: MAIN STATE (Hub View) =====
  const top3Roles = prioritizedRoles.slice(0, 3);
  const hasMinimumPriorities = prioritizedRoles.length >= 3;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.compassContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
            <Image source={CompassRolesIcon} style={styles.compassIcon} resizeMode="contain" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Wing Check: Roles</Text>
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
              Your life roles represent the different hats you wear—father, professional, friend, etc.
              Prioritize the roles that matter most to you right now.
            </Text>
          </View>
        )}
      </View>

      {/* This Week's Top Focus Card */}
      <View style={[styles.identityCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: ROLES_COLOR }]}>
            <RolesIcon size={14} color="#FFFFFF" />
          </View>
          <Text style={[styles.identityLabel, { color: ROLES_COLOR }]}>THIS WEEK'S TOP FOCUS</Text>
          <TouchableOpacity onPress={() => slideToState('prioritize')}>
            <Text style={[styles.editLink, { color: ROLES_COLOR }]}>Update</Text>
          </TouchableOpacity>
        </View>
        
        {top3Roles.length > 0 ? (
          <View style={styles.top3List}>
            {top3Roles.map((role, index) => {
              const categoryColor = getCategoryColor(role.category);
              return (
                <View key={role.id} style={styles.top3Item}>
                  <View style={[styles.top3RoleIcon, { backgroundColor: `${categoryColor}20` }]}>
                    <RoleIcon name={role.icon || role.label} color={categoryColor} size={20} />
                  </View>
                  <Text style={[styles.top3RoleLabel, { color: colors.text }]}>{role.label}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
            No roles prioritized yet. Tap "Update" to set your priorities.
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsSection}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { 
              backgroundColor: colors.surface, 
              borderColor: hasMinimumPriorities ? ROLES_COLOR : colors.border,
              borderWidth: hasMinimumPriorities ? 2 : 1,
              opacity: hasMinimumPriorities ? 1 : 0.5,
            }
          ]}
          onPress={() => hasMinimumPriorities && slideToState('review-roles')}
          disabled={!hasMinimumPriorities}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionButtonIcon, { backgroundColor: ROLES_COLOR }]}>
              <RolesIcon size={16} color="#FFFFFF" />
            </View>
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: hasMinimumPriorities ? ROLES_COLOR : colors.text }]}>
                Design Your Legacy
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                Set purpose, dream & ONE Thing for each role
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={hasMinimumPriorities ? ROLES_COLOR : colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleManageRoles}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <Settings size={20} color={colors.textSecondary} />
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Manage Roles</Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                Activate or remove existing roles
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: hasMinimumPriorities ? ROLES_COLOR : colors.border }]}
          onPress={handleContinueToWellnessZones}
          disabled={!hasMinimumPriorities}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue to Wellness Zones</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {!hasMinimumPriorities && (
        <Text style={[styles.warningText, { color: '#F59E0B' }]}>
          Please prioritize at least 3 roles to continue
        </Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
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
  inlineLoading: {
    alignItems: 'center',
    paddingVertical: 12,
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
    lineHeight: 20,
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
  identityText: {
    fontSize: 20,
    fontWeight: '700',
  },
  identitySubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Top 3
  top3List: {
    gap: 10,
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  top3RoleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top3RoleLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
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
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 14,
  },

  // Progress
  progressCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Cards
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  statementText: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Input
  inputContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  textInput: {
    padding: 12,
    fontSize: 16,
    minHeight: 80,
  },
  textInputSmall: {
    padding: 12,
    fontSize: 15,
    minHeight: 60,
  },

  // Save buttons
  inlineSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
  },
  inlineSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // ONE Thing save-as
  saveAsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  saveAsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveAsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveAsButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Existing item display
  existingItemCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  existingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  existingItemText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  existingItemMeta: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 26,
  },

  // Introspection
  introspectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  introspectionToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  introspectionContent: {
    marginTop: 8,
  },
  introspectionQuestion: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 8,
  },
  introspectionContext: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  allAnsweredText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  introspectionJournal: {
    marginTop: 16,
  },
  journalSubheader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  journalEntry: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  journalEntryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  journalEntryDate: {
    fontSize: 11,
    marginTop: 4,
  },

  // Placeholder button
  placeholderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  placeholderButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Roles Grid (Prioritize)
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roleCard: {
    width: '30%',
    minWidth: 90,
    aspectRatio: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  checkContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Review Role Cards (Design Your Legacy list)
  reviewRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  reviewRoleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  reviewRoleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewRoleInfo: {
    flex: 1,
  },
  reviewRoleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewRolePurpose: {
    fontSize: 13,
    marginTop: 2,
  },
  reviewRoleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal (Date Picker)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  dayGrid: {
    gap: 8,
    marginBottom: 16,
  },
  dayButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 36,
  },
  timeScroller: {
    flex: 1,
    maxHeight: 36,
  },
  timeScrollerContent: {
    gap: 6,
    paddingRight: 8,
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
  },
  timeHint: {
    fontSize: 12,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default WingCheckRolesStep;