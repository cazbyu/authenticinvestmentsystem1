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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { 
  Compass, 
  CheckCircle2, 
  Calendar, 
  CheckSquare, 
  Clock, 
  Edit3, 
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

interface TacticalDeploymentStepProps {
  userId: string;
  colors: any;
  onComplete: (contractData: WeeklyContractData) => void;
  onBack: () => void;
  capturedData: {
    missionReflection?: string;
    roleHealthFlags?: Record<string, string>;
    flaggedWellnessZones?: string[];
    laggingGoals?: string[];
    keyFocusGoal?: string;
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

export function TacticalDeploymentStep({
  userId,
  colors,
  onComplete,
  onBack,
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
  const [showContract, setShowContract] = useState(false);
  
  // Collapsible sections
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showDelegations, setShowDelegations] = useState(false);

  useEffect(() => {
    loadWeekData();
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Preparing your tactical deployment...
        </Text>
      </View>
    );
  }

  const totalCommitments = committedTaskIds.size + committedEventIds.size;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={[styles.iconCircle, { backgroundColor: '#FFD70020' }]}>
          <Compass size={40} color="#FFD700" />
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Tactical Deployment
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Build and sign your weekly contract
        </Text>
      </View>

      {/* Keystone Focus */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: '#FFD700' }]}>
        <View style={styles.sectionHeader}>
          <Award size={20} color="#FFD700" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Keystone Focus
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
              borderColor: keystoneFocus ? '#FFD700' : colors.border,
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
      <View style={[styles.contractSummary, { backgroundColor: '#FFD70010', borderColor: '#FFD70040' }]}>
        <Text style={[styles.contractSummaryTitle, { color: colors.text }]}>
          📜 Weekly Contract Summary
        </Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Keystone:</Text>
          <Text style={[styles.summaryValue, { color: keystoneFocus ? colors.text : colors.textSecondary }]}>
            {keystoneFocus || 'Not set'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Commitments:</Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            {totalCommitments} items
          </Text>
        </View>
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
          { backgroundColor: '#FFD700' },
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
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
  commitCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
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