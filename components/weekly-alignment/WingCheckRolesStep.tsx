// ============================================================================
// WingCheckRolesStep.tsx - Step 2 of Weekly Alignment
// ============================================================================
// Design Pattern: Matches TouchYourStarStep (Step 1) layout
// - 72x72 container with 56x56 compass icon
// - "My Top 3 Active Roles" card (styled like "My Core Identity" in Step 1)
// - NO back arrows in subheaders - parent handles back navigation
// - RolesIcon from CustomIcons used for card headers (like NorthStarIcon in Step 1)
// - RoleIcon from RoleIcon.tsx used for individual role display
//
// ONE Thing Integration (role-reflection state):
// - Card 1: Purpose (existing)
// - Card 2: ONE Thing question + input
// - Card 3: Activity icons (Task, Event, Deposit Idea, Reflection)
// - Card 4: Actions/Ideas tabs
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
} from 'react-native';
import { 
  ChevronRight, 
  Check, 
  HelpCircle, 
  Settings,
  CheckSquare,
  Calendar,
  Lightbulb,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { RoleIcon } from '@/components/icons/RoleIcon';
import { RoleIcon as RolesIcon } from '@/components/icons/CustomIcons';
import { getWeekStart, formatLocalDate } from '@/lib/dateUtils';

// Helper function to get Monday of current week
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Compass Roles icon for Step 2 header (matches Step 1 sizing: 56x56 in 72x72 container)
const CompassRolesIcon = require('@/assets/images/compass-roles.png');

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
  is_active: boolean;
  priority_order?: number | null;
}

interface Task {
  id: string;
  title: string;
  type: 'task' | 'event';
  status: string;
  scheduled_date?: string;
  one_thing?: boolean;
}

interface DepositIdea {
  id: string;
  title: string;
  one_thing?: boolean;
}

// Flow states for the step
type FlowState = 
  | 'loading'           // Initial data fetch
  | 'activate-roles'    // No active roles - needs to set up first
  | 'main'              // Main hub view
  | 'prioritize'        // Prioritization selection view
  | 'review-roles'      // List of prioritized roles for review
  | 'role-reflection';  // Purpose + ONE Thing for selected role

// Brand color for Roles (purple)
const ROLES_COLOR = '#9370DB';
const ROLES_COLOR_LIGHT = '#9370DB15';
const ROLES_COLOR_BORDER = '#9370DB40';

// Activity type configuration (no Rose/Thorn for ONE Thing flow)
const ACTIVITY_TYPES = [
  { key: 'task', label: 'Task', icon: CheckSquare, color: '#3B82F6' },
  { key: 'event', label: 'Event', icon: Calendar, color: '#8B5CF6' },
  { key: 'depositIdea', label: 'Idea', icon: Lightbulb, color: '#F59E0B' },
  { key: 'reflection', label: 'Reflect', icon: BookOpen, color: '#10B981' },
] as const;

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
  
  // ONE Thing state
  const [oneThingAnswer, setOneThingAnswer] = useState('');
  const [existingOneThingId, setExistingOneThingId] = useState<string | null>(null);
  const [savingOneThing, setSavingOneThing] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState<string>('');
  const [weekStartDay, setWeekStartDay] = useState<'sunday' | 'monday'>('sunday');
  
  // Actions/Ideas state
  const [roleTasks, setRoleTasks] = useState<Task[]>([]);
  const [roleDepositIdeas, setRoleDepositIdeas] = useState<DepositIdea[]>([]);
  const [activeTab, setActiveTab] = useState<'actions' | 'ideas'>('actions');
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [loadingRoleData, setLoadingRoleData] = useState(false);
  
  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for back handler (prevents stale closures)
  const flowStateRef = useRef<FlowState>(flowState);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  // Calculate week start date on mount
  useEffect(() => {
    const weekStart = getWeekStartDate(new Date());
    setWeekStartDate(weekStart.toISOString().split('T')[0]);
  }, []);

  // Back handler for parent component
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => {
        const currentFlowState = flowStateRef.current;
        
        if (currentFlowState === 'main' || currentFlowState === 'activate-roles') {
          // At root - let parent handle exit
          return false;
        } else if (currentFlowState === 'prioritize') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'review-roles') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'role-reflection') {
          // Reset role reflection state
          setPurposeResponse('');
          setOneThingAnswer('');
          setExistingOneThingId(null);
          setRoleTasks([]);
          setRoleDepositIdeas([]);
          setSelectedReflectionRole(null);
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

  async function loadData() {
    try {
      const supabase = getSupabaseClient();

      // Load all active roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('0008-ap-roles')
        .select('id, label, category, icon, color, purpose, is_active, priority_order')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority_order', { ascending: true, nullsFirst: false })
        .order('label', { ascending: true });

      if (rolesError) throw rolesError;

      const activeRoles = rolesData || [];
      setRoles(activeRoles);

      // Get prioritized roles (those with priority_order set)
      const prioritized = activeRoles
        .filter(r => r.priority_order !== null && r.priority_order !== undefined)
        .sort((a, b) => (a.priority_order || 0) - (b.priority_order || 0));
      
      setPrioritizedRoles(prioritized);
      setSelectedRoleIds(prioritized.map(r => r.id));

      // Determine initial state
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

  // Load ONE Thing and role data when entering role-reflection
  async function loadRoleReflectionData(role: Role) {
    if (!weekStartDate) return;
    
    setLoadingRoleData(true);
    try {
      const supabase = getSupabaseClient();

      // 1. Load existing ONE Thing answer for this role and week
      const { data: oneThingData, error: oneThingError } = await supabase
        .from('0008-ap-reflections')
        .select('id, content')
        .eq('user_id', userId)
        .eq('one_thing', true)
        .eq('week_start_date', weekStartDate)
        .eq('archived', false)
        .maybeSingle();

      // Check if this ONE Thing is linked to this role
      if (oneThingData) {
        const { data: roleJoin } = await supabase
          .from('0008-ap-universal-roles-join')
          .select('id')
          .eq('parent_type', 'reflection')
          .eq('parent_id', oneThingData.id)
          .eq('role_id', role.id)
          .maybeSingle();

        if (roleJoin) {
          setOneThingAnswer(oneThingData.content || '');
          setExistingOneThingId(oneThingData.id);
        } else {
          setOneThingAnswer('');
          setExistingOneThingId(null);
        }
      } else {
        setOneThingAnswer('');
        setExistingOneThingId(null);
      }

      // 2. Load tasks for this role
      const { data: taskJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'task')
        .eq('role_id', role.id);

      const taskIds = taskJoins?.map(tj => tj.parent_id) || [];

      if (taskIds.length > 0) {
        const { data: tasksData } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, scheduled_date, one_thing')
          .eq('user_id', userId)
          .in('id', taskIds)
          .is('deleted_at', null)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event'])
          .order('scheduled_date', { ascending: true, nullsFirst: false })
          .limit(10);

        setRoleTasks(tasksData || []);
      } else {
        setRoleTasks([]);
      }

      // 3. Load deposit ideas for this role
      const { data: ideaJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'depositIdea')
        .eq('role_id', role.id);

      const ideaIds = ideaJoins?.map(ij => ij.parent_id) || [];

      if (ideaIds.length > 0) {
        const { data: ideasData } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, one_thing')
          .eq('user_id', userId)
          .in('id', ideaIds)
          .eq('archived', false)
          .eq('is_active', true)
          .is('activated_task_id', null)
          .order('created_at', { ascending: false })
          .limit(10);

        setRoleDepositIdeas(ideasData || []);
      } else {
        setRoleDepositIdeas([]);
      }

    } catch (error) {
      console.error('Error loading role reflection data:', error);
    } finally {
      setLoadingRoleData(false);
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

      // Clear all existing priority_order values
      const { error: clearError } = await supabase
        .from('0008-ap-roles')
        .update({ priority_order: null })
        .eq('user_id', userId);

      if (clearError) throw clearError;

      // Set priority_order for selected roles
      for (let i = 0; i < selectedRoleIds.length; i++) {
        const { error: updateError } = await supabase
          .from('0008-ap-roles')
          .update({ priority_order: i + 1 })
          .eq('id', selectedRoleIds[i]);

        if (updateError) throw updateError;
      }

      // Reload data to get updated priorities
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

  async function saveRolePurpose() {
    if (!selectedReflectionRole || !purposeResponse.trim()) return;

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      // Update the role's purpose field directly
      const { error: updateError } = await supabase
        .from('0008-ap-roles')
        .update({ purpose: purposeResponse.trim() })
        .eq('id', selectedReflectionRole.id);

      if (updateError) throw updateError;

      // Update local state
      const updatedRole = { ...selectedReflectionRole, purpose: purposeResponse.trim() };
      setSelectedReflectionRole(updatedRole);
      setRoles(prev => prev.map(r => 
        r.id === selectedReflectionRole.id ? updatedRole : r
      ));
      setPrioritizedRoles(prev => prev.map(r => 
        r.id === selectedReflectionRole.id ? updatedRole : r
      ));

    } catch (error) {
      console.error('Error saving role purpose:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveOneThing() {
    if (!selectedReflectionRole || !oneThingAnswer.trim() || !weekStartDate) return;

    setSavingOneThing(true);
    try {
      const supabase = getSupabaseClient();

      if (existingOneThingId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('0008-ap-reflections')
          .update({
            content: oneThingAnswer.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOneThingId);

        if (updateError) throw updateError;
      } else {
        // Create new reflection
        const { data: newReflection, error: insertError } = await supabase
          .from('0008-ap-reflections')
          .insert({
            user_id: userId,
            content: oneThingAnswer.trim(),
            reflection_type: 'reflection',
            one_thing: true,
            week_start_date: weekStartDate,
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
          });

        if (joinError) throw joinError;

        setExistingOneThingId(newReflection.id);
      }

    } catch (error) {
      console.error('Error saving ONE Thing:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save. Please try again.');
      }
    } finally {
      setSavingOneThing(false);
    }
  }

  function handleCreateItem(type: 'task' | 'event' | 'depositIdea' | 'reflection') {
    if (!selectedReflectionRole || !onOpenTaskForm) return;

    onOpenTaskForm({
      type: type,
      selectedRoleIds: [selectedReflectionRole.id],
      one_thing: true, // Mark as created from ONE Thing flow
    });
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

  // Get all active roles sorted: prioritized first, then alphabetical
  function getAllRolesSorted(): Role[] {
    const prioritizedIds = new Set(prioritizedRoles.map(r => r.id));
    const nonPrioritized = roles
      .filter(r => !prioritizedIds.has(r.id))
      .sort((a, b) => a.label.localeCompare(b.label));
    
    return [...prioritizedRoles, ...nonPrioritized];
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
        {/* Header - Matching Step 1 style exactly */}
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

        {/* Activate My Roles Card - styled like My Core Identity */}
        <View style={[styles.identityCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
          <View style={styles.identityHeader}>
            <View style={[styles.identityIconContainer, { backgroundColor: ROLES_COLOR }]}>
              <RolesIcon size={14} color="#FFFFFF" />
            </View>
            <Text style={[styles.identityLabel, { color: ROLES_COLOR }]}>ACTIVATE MY ROLES</Text>
          </View>
          
          <Text style={[styles.identityText, { color: colors.text }]}>
            No roles activated yet
          </Text>
          
          <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
            Roles are the different hats you wear in life—like Father, Business Owner, Friend, etc.
            You'll need to activate at least 3 roles before you can prioritize them.
          </Text>
        </View>

        {/* Manage Roles Button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: ROLES_COLOR }]}
          onPress={handleManageRoles}
          activeOpacity={0.8}
        >
          <Settings size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Manage Roles</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Skip Option */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onNext}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
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
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Standard format, NO back arrow */}
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

          {/* Progress */}
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

          {/* Roles by Category */}
          {categories.map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>
                {category}
              </Text>

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
                        <RoleIcon
                          name={role.icon || role.label}
                          color={categoryColor}
                          size={28}
                        />
                      </View>

                      <Text
                        style={[
                          styles.roleLabel,
                          { color: isSelected ? categoryColor : colors.text },
                        ]}
                        numberOfLines={2}
                      >
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

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: selectedRoleIds.length >= 3 ? ROLES_COLOR : colors.border,
                opacity: saving ? 0.7 : 1,
              },
            ]}
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

  // ===== RENDER: REVIEW ROLES STATE =====
  if (flowState === 'review-roles') {
    const allRolesSorted = getAllRolesSorted();
    
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Standard format, NO back arrow */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
                <Image source={CompassRolesIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Review Your Roles</Text>
              </View>
            </View>
          </View>

          {/* Review Roles Card - Styled like My Core Identity */}
          <View style={[styles.identityCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: ROLES_COLOR }]}>
                <RolesIcon size={14} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: ROLES_COLOR }]}>REVIEW YOUR ROLES</Text>
            </View>
            
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              Tap a role to define purpose and set your ONE Thing
            </Text>
          </View>

          {/* All Roles List - Prioritized first, then alphabetical */}
          {allRolesSorted.map((role) => {
            const categoryColor = getCategoryColor(role.category);
            const hasPurpose = !!role.purpose;
            const priorityIndex = prioritizedRoles.findIndex(r => r.id === role.id);
            const isPrioritized = priorityIndex >= 0;
            
            return (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.reviewRoleCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: hasPurpose ? '#10b981' : colors.border,
                    borderLeftColor: categoryColor,
                    borderLeftWidth: 4,
                  }
                ]}
                onPress={() => {
                  setSelectedReflectionRole(role);
                  setPurposeResponse(role.purpose || '');
                  loadRoleReflectionData(role);
                  slideToState('role-reflection');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.reviewRoleLeft}>
                  {isPrioritized && (
                    <View style={[styles.reviewRoleBadge, { backgroundColor: categoryColor }]}>
                      <Text style={styles.reviewRoleBadgeText}>R{priorityIndex + 1}</Text>
                    </View>
                  )}
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
                        Tap to define purpose
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.reviewRoleRight}>
                  {hasPurpose && (
                    <View style={[styles.checkCircle, { backgroundColor: '#10b981' }]}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  )}
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Done Reviewing Button */}
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

  // ===== RENDER: ROLE REFLECTION STATE (with ONE Thing) =====
  if (flowState === 'role-reflection' && selectedReflectionRole) {
    const categoryColor = getCategoryColor(selectedReflectionRole.category);
    const priorityIndex = prioritizedRoles.findIndex(r => r.id === selectedReflectionRole.id);
    const isPrioritized = priorityIndex >= 0;
    
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
            {/* Header */}
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
                  <Text style={[styles.stepLabel, { color: categoryColor }]}>
                    {isPrioritized ? `R${priorityIndex + 1}` : 'Role'}
                  </Text>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {selectedReflectionRole.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 1: Purpose */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: categoryColor }]}>MY PURPOSE IN THIS ROLE</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => {}}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Pencil size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              {selectedReflectionRole.purpose ? (
                <Text style={[styles.purposeText, { color: colors.text }]}>
                  "{selectedReflectionRole.purpose}"
                </Text>
              ) : (
                <>
                  <Text style={[styles.questionHint, { color: colors.textSecondary, marginBottom: 12 }]}>
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
                  <TouchableOpacity
                    style={[
                      styles.savePurposeButton,
                      {
                        backgroundColor: purposeResponse.trim() ? ROLES_COLOR : colors.border,
                        opacity: saving ? 0.7 : 1,
                      },
                    ]}
                    onPress={saveRolePurpose}
                    disabled={saving || !purposeResponse.trim()}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.savePurposeButtonText}>Save Purpose</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Card 2: ONE Thing Question */}
            <View style={[styles.card, { backgroundColor: `${categoryColor}08`, borderColor: `${categoryColor}30` }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: categoryColor }]}>ONE THING THIS WEEK</Text>
                {existingOneThingId && (
                  <View style={[styles.savedBadge, { backgroundColor: '#10b981' }]}>
                    <Check size={12} color="#FFFFFF" />
                    <Text style={styles.savedBadgeText}>Saved</Text>
                  </View>
                )}
              </View>
              
              <Text style={[styles.questionText, { color: colors.text }]}>
                What is the ONE thing I can do as a {selectedReflectionRole.label} this week that will make everything else easier or unnecessary?
              </Text>
              
              <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="My ONE thing this week is..."
                  placeholderTextColor={colors.textSecondary}
                  value={oneThingAnswer}
                  onChangeText={setOneThingAnswer}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: oneThingAnswer.trim() ? categoryColor : colors.border,
                    opacity: savingOneThing ? 0.7 : 1,
                  },
                ]}
                onPress={saveOneThing}
                disabled={savingOneThing || !oneThingAnswer.trim()}
                activeOpacity={0.8}
              >
                {savingOneThing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {existingOneThingId ? 'Update ONE Thing' : 'Save ONE Thing'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Card 3: Activity Icons */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
                TAKE ACTION
              </Text>
              
              <View style={styles.activityIconsRow}>
                {ACTIVITY_TYPES.map(({ key, label, icon: Icon, color }) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.activityButton}
                    onPress={() => handleCreateItem(key as any)}
                    activeOpacity={0.7}
                    disabled={!onOpenTaskForm}
                  >
                    <View style={[styles.activityIconCircle, { backgroundColor: `${color}15` }]}>
                      <Icon size={20} color={color} />
                    </View>
                    <Text style={[styles.activityLabel, { color: colors.text }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Card 4: Actions & Ideas Tabs */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={styles.expandHeader}
                onPress={() => setActionsExpanded(!actionsExpanded)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                  SCHEDULED & IDEAS
                </Text>
                {actionsExpanded ? (
                  <ChevronUp size={20} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {actionsExpanded && (
                <>
                  {/* Tab Selector */}
                  <View style={[styles.tabRow, { backgroundColor: colors.border }]}>
                    <TouchableOpacity
                      style={[
                        styles.tab,
                        activeTab === 'actions' && { backgroundColor: categoryColor },
                      ]}
                      onPress={() => setActiveTab('actions')}
                    >
                      <Text style={[
                        styles.tabText,
                        activeTab === 'actions' && styles.tabTextActive,
                      ]}>
                        Actions ({roleTasks.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.tab,
                        activeTab === 'ideas' && { backgroundColor: categoryColor },
                      ]}
                      onPress={() => setActiveTab('ideas')}
                    >
                      <Text style={[
                        styles.tabText,
                        activeTab === 'ideas' && styles.tabTextActive,
                      ]}>
                        Ideas ({roleDepositIdeas.length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tab Content */}
                  <View style={styles.tabContent}>
                    {loadingRoleData ? (
                      <View style={styles.tabLoadingContainer}>
                        <ActivityIndicator size="small" color={categoryColor} />
                      </View>
                    ) : activeTab === 'actions' ? (
                      roleTasks.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          No actions scheduled for this role
                        </Text>
                      ) : (
                        roleTasks.slice(0, 5).map(task => (
                          <View
                            key={task.id}
                            style={[styles.listItem, { borderColor: colors.border }]}
                          >
                            <View style={[
                              styles.itemIcon,
                              { backgroundColor: task.type === 'event' ? '#8B5CF615' : '#3B82F615' }
                            ]}>
                              {task.type === 'event' ? (
                                <Calendar size={14} color="#8B5CF6" />
                              ) : (
                                <CheckSquare size={14} color="#3B82F6" />
                              )}
                            </View>
                            <View style={styles.itemContent}>
                              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                                {task.title}
                              </Text>
                              {task.scheduled_date && (
                                <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                                  {new Date(task.scheduled_date).toLocaleDateString()}
                                </Text>
                              )}
                            </View>
                            {task.one_thing && (
                              <View style={[styles.oneThingBadge, { backgroundColor: categoryColor }]}>
                                <Text style={styles.oneThingBadgeText}>1</Text>
                              </View>
                            )}
                          </View>
                        ))
                      )
                    ) : (
                      roleDepositIdeas.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          No deposit ideas for this role
                        </Text>
                      ) : (
                        roleDepositIdeas.slice(0, 5).map(idea => (
                          <View
                            key={idea.id}
                            style={[styles.listItem, { borderColor: colors.border }]}
                          >
                            <View style={[styles.itemIcon, { backgroundColor: '#F59E0B15' }]}>
                              <Lightbulb size={14} color="#F59E0B" />
                            </View>
                            <View style={styles.itemContent}>
                              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                                {idea.title}
                              </Text>
                            </View>
                            {idea.one_thing && (
                              <View style={[styles.oneThingBadge, { backgroundColor: categoryColor }]}>
                                <Text style={styles.oneThingBadgeText}>1</Text>
                              </View>
                            )}
                          </View>
                        ))
                      )
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Back to Review Button */}
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: categoryColor }]}
              onPress={() => {
                setPurposeResponse('');
                setOneThingAnswer('');
                setExistingOneThingId(null);
                setRoleTasks([]);
                setRoleDepositIdeas([]);
                setSelectedReflectionRole(null);
                slideToState('review-roles');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: categoryColor }]}>Back to Roles</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
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
      {/* Header - Matching Step 1 style exactly */}
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

      {/* My Top 3 Active Roles Card - Styled like My Core Identity */}
      <View style={[styles.identityCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: ROLES_COLOR }]}>
            <RolesIcon size={14} color="#FFFFFF" />
          </View>
          <Text style={[styles.identityLabel, { color: ROLES_COLOR }]}>MY TOP 3 ACTIVE ROLES</Text>
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
                  <View style={[styles.top3Badge, { backgroundColor: categoryColor }]}>
                    <Text style={styles.top3BadgeText}>R{index + 1}</Text>
                  </View>
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
        {/* Manage Roles Button */}
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

        {/* Review Your Roles Button */}
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
                Review Your Roles
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                Set purpose & ONE Thing for each role
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={hasMinimumPriorities ? ROLES_COLOR : colors.textSecondary} />
        </TouchableOpacity>

        {/* Continue to Wellness Zones Button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: hasMinimumPriorities ? ROLES_COLOR : colors.border,
            },
          ]}
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
  
  // Header - Matching Step 1 exactly (72x72 container, 56x56 icon)
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

  // Identity Card - Styled like My Core Identity in Step 1
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

  // Top 3 Roles List
  top3List: {
    gap: 10,
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  top3Badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top3BadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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

  // Action Buttons Section
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

  // Cards (for role-reflection)
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
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  editButton: {
    padding: 4,
  },
  purposeText: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Question Card
  questionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  questionHint: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Roles Grid (for Prioritize screen)
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

  // Review Role Cards
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
  reviewRoleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewRoleBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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

  // Input container
  inputContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  textInput: {
    padding: 12,
    fontSize: 16,
    minHeight: 80,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  savePurposeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
  },
  savePurposeButtonText: {
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

  // Activity Icons
  activityIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activityButton: {
    alignItems: 'center',
    gap: 6,
  },
  activityIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Expand Header
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginTop: 12,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    minHeight: 60,
  },
  tabLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },

  // List Items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  oneThingBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  oneThingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default WingCheckRolesStep;