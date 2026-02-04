// ============================================================================
// OneThingRoleStep.tsx - ONE Thing Focus for a Single Role
// ============================================================================
// Used within WingCheckRolesStep during Weekly Alignment
// 
// Layout:
// 1. Purpose Card - Shows role purpose with edit icon
// 2. ONE Thing Card - Question + text input for this week's focus
// 3. Activity Icons - Task, Event, Deposit Idea, Reflection (no Rose/Thorn)
// 4. Actions/Ideas Tabs - Scheduled actions and deposit ideas for this role
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { 
  ChevronRight, 
  Pencil, 
  CheckSquare, 
  Calendar, 
  Lightbulb, 
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { RoleIcon } from '@/components/icons/RoleIcon';
import { getWeekStartDate } from '@/lib/dateUtils';

interface Role {
  id: string;
  label: string;
  category?: string;
  icon?: string;
  color?: string;
  purpose?: string;
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

interface OneThingRoleStepProps {
  userId: string;
  role: Role;
  priorityIndex: number; // 0-based index for R1, R2, R3...
  colors: any;
  weekStartDate: string; // ISO date string for Monday of the week
  onBack: () => void;
  onEditPurpose: (role: Role) => void;
  onCreateItem: (type: 'task' | 'event' | 'depositIdea' | 'reflection', roleId: string, oneThing?: boolean) => void;
  onTaskPress: (task: Task) => void;
  onDepositIdeaPress: (depositIdea: DepositIdea) => void;
}

// Activity type configuration
const ACTIVITY_TYPES = [
  { key: 'task', label: 'Task', icon: CheckSquare, color: '#3B82F6' },
  { key: 'event', label: 'Event', icon: Calendar, color: '#8B5CF6' },
  { key: 'depositIdea', label: 'Idea', icon: Lightbulb, color: '#F59E0B' },
  { key: 'reflection', label: 'Reflect', icon: BookOpen, color: '#10B981' },
] as const;

function getCategoryColor(category?: string): string {
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

export function OneThingRoleStep({
  userId,
  role,
  priorityIndex,
  colors,
  weekStartDate,
  onBack,
  onEditPurpose,
  onCreateItem,
  onTaskPress,
  onDepositIdeaPress,
}: OneThingRoleStepProps) {
  // State
  const [oneThingAnswer, setOneThingAnswer] = useState('');
  const [existingOneThingId, setExistingOneThingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<DepositIdea[]>([]);
  const [activeTab, setActiveTab] = useState<'actions' | 'ideas'>('actions');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(true);

  const roleColor = getCategoryColor(role.category);
  const roleLabel = `R${priorityIndex + 1}`;

  // Load existing ONE Thing answer and related items
  useEffect(() => {
    loadData();
  }, [role.id, weekStartDate]);

  async function loadData() {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      // 1. Load existing ONE Thing answer for this role and week
      const { data: oneThingData, error: oneThingError } = await supabase
        .from('0008-ap-reflections')
        .select(`
          id,
          content,
          "0008-ap-universal-roles-join"!inner(role_id)
        `)
        .eq('user_id', userId)
        .eq('one_thing', true)
        .eq('week_start_date', weekStartDate)
        .eq('0008-ap-universal-roles-join.role_id', role.id)
        .eq('0008-ap-universal-roles-join.parent_type', 'reflection')
        .maybeSingle();

      if (oneThingError && oneThingError.code !== 'PGRST116') {
        console.error('Error loading ONE Thing:', oneThingError);
      }

      if (oneThingData) {
        setOneThingAnswer(oneThingData.content || '');
        setExistingOneThingId(oneThingData.id);
      } else {
        setOneThingAnswer('');
        setExistingOneThingId(null);
      }

      // 2. Load tasks for this role (scheduled this week, not completed)
      const { data: taskJoins, error: taskJoinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'task')
        .eq('role_id', role.id);

      if (taskJoinError) throw taskJoinError;

      const taskIds = taskJoins?.map(tj => tj.parent_id) || [];

      if (taskIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, scheduled_date, one_thing')
          .eq('user_id', userId)
          .in('id', taskIds)
          .is('deleted_at', null)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event'])
          .order('scheduled_date', { ascending: true, nullsFirst: false });

        if (tasksError) throw tasksError;
        setTasks(tasksData || []);
      } else {
        setTasks([]);
      }

      // 3. Load deposit ideas for this role
      const { data: ideaJoins, error: ideaJoinError } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .eq('parent_type', 'depositIdea')
        .eq('role_id', role.id);

      if (ideaJoinError) throw ideaJoinError;

      const ideaIds = ideaJoins?.map(ij => ij.parent_id) || [];

      if (ideaIds.length > 0) {
        const { data: ideasData, error: ideasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, one_thing')
          .eq('user_id', userId)
          .in('id', ideaIds)
          .eq('archived', false)
          .eq('is_active', true)
          .is('activated_task_id', null)
          .order('created_at', { ascending: false });

        if (ideasError) throw ideasError;
        setDepositIdeas(ideasData || []);
      } else {
        setDepositIdeas([]);
      }

    } catch (error) {
      console.error('Error loading ONE Thing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveOneThing() {
    if (!oneThingAnswer.trim()) return;

    setSaving(true);
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
            role_id: role.id,
          });

        if (joinError) throw joinError;

        setExistingOneThingId(newReflection.id);
      }

      // Show subtle success feedback
      if (Platform.OS !== 'web') {
        Alert.alert('Saved', 'Your ONE Thing has been saved.');
      }
    } catch (error) {
      console.error('Error saving ONE Thing:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCreateWithOneThing(type: 'task' | 'event' | 'depositIdea' | 'reflection') {
    // Pass true to indicate this item is being created from ONE Thing flow
    onCreateItem(type, role.id, true);
  }

  // ===== RENDER =====
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={roleColor} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
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
        {/* Header with Role Info */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={[styles.roleIconContainer, { backgroundColor: `${roleColor}15` }]}>
              <RoleIcon 
                name={role.icon || role.label} 
                color={roleColor} 
                size={40} 
              />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.roleLabel, { color: roleColor }]}>{roleLabel}</Text>
              <Text style={[styles.roleTitle, { color: colors.text }]}>{role.label}</Text>
            </View>
          </View>
        </View>

        {/* Card 1: Purpose Statement */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: roleColor }]}>MY PRIMARY PURPOSE</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => onEditPurpose(role)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Pencil size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {role.purpose ? (
            <Text style={[styles.purposeText, { color: colors.text }]}>
              "{role.purpose}"
            </Text>
          ) : (
            <TouchableOpacity onPress={() => onEditPurpose(role)}>
              <Text style={[styles.purposePlaceholder, { color: '#F59E0B' }]}>
                Tap to define your purpose as a {role.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card 2: ONE Thing Question */}
        <View style={[styles.card, { backgroundColor: `${roleColor}08`, borderColor: `${roleColor}30` }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: roleColor }]}>ONE THING THIS WEEK</Text>
            {existingOneThingId && (
              <View style={[styles.savedBadge, { backgroundColor: '#10b981' }]}>
                <Check size={12} color="#FFFFFF" />
                <Text style={styles.savedBadgeText}>Saved</Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.questionText, { color: colors.text }]}>
            What is the ONE thing I can do as a {role.label} this week that will make everything else easier or unnecessary?
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
                backgroundColor: oneThingAnswer.trim() ? roleColor : colors.border,
                opacity: saving ? 0.7 : 1,
              },
            ]}
            onPress={saveOneThing}
            disabled={saving || !oneThingAnswer.trim()}
            activeOpacity={0.8}
          >
            {saving ? (
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
                onPress={() => handleCreateWithOneThing(key as any)}
                activeOpacity={0.7}
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
                    activeTab === 'actions' && { backgroundColor: roleColor },
                  ]}
                  onPress={() => setActiveTab('actions')}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === 'actions' && styles.tabTextActive,
                  ]}>
                    Actions ({tasks.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'ideas' && { backgroundColor: roleColor },
                  ]}
                  onPress={() => setActiveTab('ideas')}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === 'ideas' && styles.tabTextActive,
                  ]}>
                    Ideas ({depositIdeas.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content */}
              <View style={styles.tabContent}>
                {activeTab === 'actions' ? (
                  tasks.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No actions scheduled for this role
                    </Text>
                  ) : (
                    tasks.slice(0, 5).map(task => (
                      <TouchableOpacity
                        key={task.id}
                        style={[styles.listItem, { borderColor: colors.border }]}
                        onPress={() => onTaskPress(task)}
                        activeOpacity={0.7}
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
                          <View style={[styles.oneThingBadge, { backgroundColor: roleColor }]}>
                            <Text style={styles.oneThingBadgeText}>1</Text>
                          </View>
                        )}
                        <ChevronRight size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ))
                  )
                ) : (
                  depositIdeas.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No deposit ideas for this role
                    </Text>
                  ) : (
                    depositIdeas.slice(0, 5).map(idea => (
                      <TouchableOpacity
                        key={idea.id}
                        style={[styles.listItem, { borderColor: colors.border }]}
                        onPress={() => onDepositIdeaPress(idea)}
                        activeOpacity={0.7}
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
                          <View style={[styles.oneThingBadge, { backgroundColor: roleColor }]}>
                            <Text style={styles.oneThingBadgeText}>1</Text>
                          </View>
                        )}
                        <ChevronRight size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ))
                  )
                )}
              </View>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  roleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: '700',
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
  purposePlaceholder: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // ONE Thing Card
  questionText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
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

export default OneThingRoleStep;