import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { 
  CheckCircle2, 
  Calendar, 
  CheckSquare, 
  Clock, 
  Edit3, 
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Target,
  HelpCircle,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

// Compass icon for Step 5 header
const CompassDeployIcon = require('@/assets/images/compass-deploy.png');

interface TacticalDeploymentStepProps {
  userId: string;
  colors: any;
  onComplete: (contractData: WeeklyContractData) => void;
  onBack: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  capturedData: {
    missionReflection?: string;
    roleHealthFlags?: Record<string, string>;
    flaggedWellnessZones?: string[];
    laggingGoals?: string[];
    keyFocusGoal?: string;
    // NEW: Collected ONE thing responses
    wellnessZoneFocus?: Array<{
      zoneId: string;
      zoneName: string;
      focusText: string;
    }>;
    roleFocus?: Array<{
      roleId: string;
      roleLabel: string;
      focusText: string;
    }>;
  };
}

interface WeeklyContractData {
  keystone_focus: string;
  committed_tasks: string[];
  committed_events: string[];
  delegation_reminders: string[];
  personal_commitment: string;
  signed_at: string;
}

interface ScheduledItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  due_date?: string;
  start_date?: string;
  start_time?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  points?: number;
}

// Brand color for Deployment (gold/yellow)
const DEPLOY_COLOR = '#FFD700';
const DEPLOY_COLOR_LIGHT = '#FFD70015';
const DEPLOY_COLOR_BORDER = '#FFD70040';

export function TacticalDeploymentStep({
  userId,
  colors,
  onComplete,
  onBack,
  onRegisterBackHandler,
  capturedData,
}: TacticalDeploymentStepProps) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ScheduledItem[]>([]);
  const [events, setEvents] = useState<ScheduledItem[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  
  const [keystoneFocus, setKeystoneFocus] = useState('');
  const [committedTaskIds, setCommittedTaskIds] = useState<Set<string>>(new Set());
  const [committedEventIds, setCommittedEventIds] = useState<Set<string>>(new Set());
  const [personalCommitment, setPersonalCommitment] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  
  // Collapsible sections
  const [showFocusAreas, setShowFocusAreas] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showDelegations, setShowDelegations] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    loadWeekData();
  }, []);

  // Register back handler
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => {
        // Step 5 has no sub-states, just go back
        return false;
      });
    }
  }, []);

  async function loadWeekData() {
    try {
      const supabase = getSupabaseClient();
      
      // Get this week's date range
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startStr = toLocalISOString(startOfWeek).split('T')[0];
      const endStr = toLocalISOString(endOfWeek).split('T')[0];

      // Load tasks due this week
      const { data: taskData } = await supabase
        .from('0008-ap-tasks')
        .select('id, title, type, due_date, start_time, is_urgent, is_important')
        .eq('user_id', userId)
        .eq('type', 'task')
        .is('completed_at', null)
        .is('deleted_at', null)
        .gte('due_date', startStr)
        .lte('due_date', endStr)
        .order('is_urgent', { ascending: false })
        .order('is_important', { ascending: false })
        .order('due_date', { ascending: true });

      // Load events this week
      const { data: eventData } = await supabase
        .from('0008-ap-tasks')
        .select('id, title, type, start_date, start_time')
        .eq('user_id', userId)
        .eq('type', 'event')
        .is('completed_at', null)
        .is('deleted_at', null)
        .gte('start_date', startStr)
        .lte('start_date', endStr)
        .order('start_date', { ascending: true })
        .order('start_time', { ascending: true });

      // Load pending delegations
      const { data: delegationData } = await supabase
        .from('v_morning_spark_delegations')
        .select('*')
        .eq('user_id', userId);

      setTasks((taskData || []).map(t => ({ ...t, type: 'task' as const })));
      setEvents((eventData || []).map(e => ({ ...e, type: 'event' as const })));
      setDelegations(delegationData || []);

      // Pre-select urgent/important tasks
      const urgentImportantIds = new Set(
        (taskData || [])
          .filter(t => t.is_urgent && t.is_important)
          .map(t => t.id)
      );
      setCommittedTaskIds(urgentImportantIds);

      // Pre-select all events
      const allEventIds = new Set((eventData || []).map(e => e.id));
      setCommittedEventIds(allEventIds);

    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleTask(taskId: string) {
    setCommittedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function toggleEvent(eventId: string) {
    setCommittedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function getPriorityColor(item: ScheduledItem): string {
    if (item.is_urgent && item.is_important) return '#EF4444';
    if (!item.is_urgent && item.is_important) return '#10B981';
    if (item.is_urgent && !item.is_important) return '#F59E0B';
    return '#6B7280';
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatTime(timeStr?: string): string {
    if (!timeStr) return '';
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  async function handleSignContract() {
    if (!keystoneFocus.trim()) {
      Alert.alert('Keystone Required', 'Please enter your keystone focus for the week.');
      return;
    }

    if (committedTaskIds.size === 0 && committedEventIds.size === 0) {
      Alert.alert('Commitment Required', 'Please commit to at least one task or event for the week.');
      return;
    }

    setIsSigning(true);

    try {
      const contractData: WeeklyContractData = {
        keystone_focus: keystoneFocus.trim(),
        committed_tasks: Array.from(committedTaskIds),
        committed_events: Array.from(committedEventIds),
        delegation_reminders: delegations.map(d => d.delegation_id),
        personal_commitment: personalCommitment.trim(),
        signed_at: new Date().toISOString(),
      };

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      onComplete(contractData);
    } catch (error) {
      console.error('Error signing contract:', error);
      Alert.alert('Error', 'Failed to save your weekly contract. Please try again.');
    } finally {
      setIsSigning(false);
    }
  }

  // Get combined focus areas from capturedData
  const wellnessZoneFocuses = capturedData.wellnessZoneFocus || [];
  const roleFocuses = capturedData.roleFocus || [];
  const hasFocusAreas = wellnessZoneFocuses.length > 0 || roleFocuses.length > 0;

  const totalCommitments = committedTaskIds.size + committedEventIds.size;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DEPLOY_COLOR} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Preparing your tactical deployment...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header - Matching other steps */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.compassContainer, { backgroundColor: DEPLOY_COLOR_LIGHT }]}>
            <Image source={CompassDeployIcon} style={styles.compassIcon} resizeMode="contain" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.stepLabel, { color: DEPLOY_COLOR }]}>Step 5</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Tactical Deployment</Text>
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
              Your weekly contract transforms intentions into commitments.
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>Keystone Focus</Text> — The ONE thing that makes everything else easier.
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>Commitments</Text> — Tasks and events you're promising to complete.
              {'\n\n'}
              💡 Focus on fewer, higher-impact items for better results.
            </Text>
          </View>
        )}
      </View>

      {/* Weekly Focus Areas - From Previous Steps */}
      {hasFocusAreas && (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: DEPLOY_COLOR_BORDER }]}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowFocusAreas(!showFocusAreas)}
          >
            <Target size={20} color={DEPLOY_COLOR} />
            <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
              Your Weekly Focus Areas
            </Text>
            <View style={[styles.countBadge, { backgroundColor: DEPLOY_COLOR }]}>
              <Text style={styles.countBadgeText}>
                {wellnessZoneFocuses.length + roleFocuses.length}
              </Text>
            </View>
            {showFocusAreas ? (
              <ChevronUp size={20} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {showFocusAreas && (
            <View style={styles.focusAreasList}>
              {/* Wellness Zone Focuses */}
              {wellnessZoneFocuses.map((wz, index) => (
                <View 
                  key={`wz-${wz.zoneId}`} 
                  style={[styles.focusAreaItem, { backgroundColor: '#39b54a10', borderColor: '#39b54a40' }]}
                >
                  <View style={styles.focusAreaHeader}>
                    <View style={[styles.focusAreaBadge, { backgroundColor: '#39b54a' }]}>
                      <Text style={styles.focusAreaBadgeText}>WZ</Text>
                    </View>
                    <Text style={[styles.focusAreaLabel, { color: colors.text }]}>
                      {wz.zoneName}
                    </Text>
                  </View>
                  <Text style={[styles.focusAreaText, { color: colors.textSecondary }]}>
                    "{wz.focusText}"
                  </Text>
                </View>
              ))}

              {/* Role Focuses */}
              {roleFocuses.map((role, index) => (
                <View 
                  key={`role-${role.roleId}`} 
                  style={[styles.focusAreaItem, { backgroundColor: '#9370DB10', borderColor: '#9370DB40' }]}
                >
                  <View style={styles.focusAreaHeader}>
                    <View style={[styles.focusAreaBadge, { backgroundColor: '#9370DB' }]}>
                      <Text style={styles.focusAreaBadgeText}>R</Text>
                    </View>
                    <Text style={[styles.focusAreaLabel, { color: colors.text }]}>
                      {role.roleLabel}
                    </Text>
                  </View>
                  <Text style={[styles.focusAreaText, { color: colors.textSecondary }]}>
                    "{role.focusText}"
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Keystone Focus */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: DEPLOY_COLOR }]}>
        <View style={styles.sectionHeader}>
          <Award size={20} color={DEPLOY_COLOR} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Keystone Focus *
          </Text>
        </View>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          What is the ONE thing that, if accomplished this week, would make everything else easier or unnecessary?
        </Text>
        <TextInput
          style={[
            styles.keystoneInput,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: keystoneFocus ? DEPLOY_COLOR : colors.border,
            },
          ]}
          placeholder="Enter your keystone focus..."
          placeholderTextColor={colors.textSecondary}
          value={keystoneFocus}
          onChangeText={setKeystoneFocus}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Tasks Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setShowTasks(!showTasks)}
        >
          <CheckSquare size={20} color="#3B82F6" />
          <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
            Tasks This Week ({tasks.length})
          </Text>
          <Text style={[styles.commitCount, { color: '#10B981' }]}>
            {committedTaskIds.size} committed
          </Text>
          {showTasks ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {showTasks && (
          <View style={styles.itemsList}>
            {tasks.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No tasks scheduled for this week
              </Text>
            ) : (
              tasks.map(task => {
                const isCommitted = committedTaskIds.has(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[
                      styles.itemRow,
                      { 
                        backgroundColor: isCommitted ? '#10B98110' : colors.background,
                        borderColor: isCommitted ? '#10B981' : colors.border,
                      },
                    ]}
                    onPress={() => toggleTask(task.id)}
                  >
                    <View style={[styles.checkbox, { borderColor: isCommitted ? '#10B981' : colors.border }]}>
                      {isCommitted && <CheckCircle2 size={18} color="#10B981" />}
                    </View>
                    <View style={styles.itemContent}>
                      <Text 
                        style={[
                          styles.itemTitle, 
                          { color: colors.text },
                          isCommitted && styles.itemTitleCommitted,
                        ]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                      <View style={styles.itemMeta}>
                        <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task) }]} />
                        <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
                          {formatDate(task.due_date)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Events Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setShowEvents(!showEvents)}
        >
          <Calendar size={20} color="#9370DB" />
          <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
            Events This Week ({events.length})
          </Text>
          <Text style={[styles.commitCount, { color: '#10B981' }]}>
            {committedEventIds.size} committed
          </Text>
          {showEvents ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {showEvents && (
          <View style={styles.itemsList}>
            {events.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No events scheduled for this week
              </Text>
            ) : (
              events.map(event => {
                const isCommitted = committedEventIds.has(event.id);
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.itemRow,
                      { 
                        backgroundColor: isCommitted ? '#10B98110' : colors.background,
                        borderColor: isCommitted ? '#10B981' : colors.border,
                      },
                    ]}
                    onPress={() => toggleEvent(event.id)}
                  >
                    <View style={[styles.checkbox, { borderColor: isCommitted ? '#10B981' : colors.border }]}>
                      {isCommitted && <CheckCircle2 size={18} color="#10B981" />}
                    </View>
                    <View style={styles.itemContent}>
                      <Text 
                        style={[
                          styles.itemTitle, 
                          { color: colors.text },
                          isCommitted && styles.itemTitleCommitted,
                        ]}
                        numberOfLines={1}
                      >
                        {event.title}
                      </Text>
                      <View style={styles.itemMeta}>
                        <Clock size={12} color={colors.textSecondary} />
                        <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
                          {formatDate(event.start_date)} {event.start_time && `at ${formatTime(event.start_time)}`}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Delegations Reminder */}
      {delegations.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowDelegations(!showDelegations)}
          >
            <Edit3 size={20} color="#F59E0B" />
            <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
              Pending Delegations ({delegations.length})
            </Text>
            {showDelegations ? (
              <ChevronUp size={20} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {showDelegations && (
            <View style={styles.itemsList}>
              {delegations.map(delegation => (
                <View
                  key={delegation.delegation_id}
                  style={[styles.delegationRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.delegationTitle, { color: colors.text }]}>
                    {delegation.task_title}
                  </Text>
                  <Text style={[styles.delegationMeta, { color: colors.textSecondary }]}>
                    → {delegation.delegate_name}
                    {delegation.due_date && ` • Due ${formatDate(delegation.due_date)}`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Personal Commitment (Optional) */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Sparkles size={20} color="#10B981" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Personal Commitment (Optional)
          </Text>
        </View>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Any personal promise you want to make to yourself this week?
        </Text>
        <TextInput
          style={[
            styles.commitmentInput,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="e.g., I will prioritize sleep over screens..."
          placeholderTextColor={colors.textSecondary}
          value={personalCommitment}
          onChangeText={setPersonalCommitment}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Contract Summary */}
      <View style={[styles.contractSummary, { backgroundColor: DEPLOY_COLOR_LIGHT, borderColor: DEPLOY_COLOR_BORDER }]}>
        <Text style={[styles.contractSummaryTitle, { color: colors.text }]}>
          📜 Weekly Contract Summary
        </Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Keystone:</Text>
          <Text style={[styles.summaryValue, { color: keystoneFocus ? colors.text : colors.textSecondary }]} numberOfLines={1}>
            {keystoneFocus || 'Not set'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Commitments:</Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            {totalCommitments} items
          </Text>
        </View>
        {hasFocusAreas && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Focus Areas:</Text>
            <Text style={[styles.summaryValue, { color: DEPLOY_COLOR }]}>
              {wellnessZoneFocuses.length + roleFocuses.length} defined ✓
            </Text>
          </View>
        )}
        {capturedData.keyFocusGoal && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Key Focus Goal:</Text>
            <Text style={[styles.summaryValue, { color: '#4169E1' }]}>Selected ✓</Text>
          </View>
        )}
      </View>

      {/* Sign Contract Button */}
      <TouchableOpacity
        style={[
          styles.signButton,
          { backgroundColor: DEPLOY_COLOR },
          isSigning && styles.signButtonDisabled,
        ]}
        onPress={handleSignContract}
        disabled={isSigning}
        activeOpacity={0.8}
      >
        {isSigning ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <>
            <Text style={styles.signButtonText}>✍️ Sign Weekly Contract</Text>
            <ChevronRight size={24} color="#000000" />
          </>
        )}
      </TouchableOpacity>

      <Text style={[styles.legalText, { color: colors.textSecondary }]}>
        By signing, you commit to honoring this contract with yourself.
      </Text>

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
  
  // Header - Matching other steps
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

  // Section Card
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  commitCount: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  countBadgeText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },

  // Focus Areas
  focusAreasList: {
    marginTop: 12,
    gap: 10,
  },
  focusAreaItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  focusAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  focusAreaBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusAreaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  focusAreaLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  focusAreaText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Inputs
  keystoneInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  commitmentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Items List
  itemsList: {
    marginTop: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemTitleCommitted: {
    fontWeight: '600',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemDate: {
    fontSize: 12,
  },

  // Delegations
  delegationRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  delegationTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  delegationMeta: {
    fontSize: 13,
  },

  // Contract Summary
  contractSummary: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  contractSummaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // Sign Button
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  signButtonDisabled: {
    opacity: 0.6,
  },
  signButtonText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default TacticalDeploymentStep;