import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSquare, Calendar, Check, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import {
  checkTodaysSpark,
  getScheduledActions,
  formatTimeDisplay,
  ScheduledAction,
  ScheduledActionsData,
  getFuelEmoji,
  getFuelColor,
} from '@/lib/sparkUtils';
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';

export default function DailyFlowScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [sparkId, setSparkId] = useState<string | null>(null);
  const [actionsData, setActionsData] = useState<ScheduledActionsData | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [mindsetPoints, setMindsetPoints] = useState(0);
  const [eventsAccepted, setEventsAccepted] = useState(false);
  const [tasksAccepted, setTasksAccepted] = useState(false);
  const [urgentTasks, setUrgentTasks] = useState<ScheduledAction[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'events' | 'tasks'>('events');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      const [spark, actions] = await Promise.all([
        checkTodaysSpark(user.id),
        getScheduledActions(user.id),
      ]);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      setSparkId(spark.id);
      setFuelLevel(spark.fuel_level);
      setActionsData(actions);

      // Load urgent tasks for EL1
      if (spark.fuel_level === 1) {
        await loadUrgentTasks(user.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load Morning Spark. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadUrgentTasks(uid: string) {
    try {
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', uid)
        .eq('type', 'task')
        .eq('is_urgent', true)
        .is('completed_at', null)
        .is('deleted_at', null)
        .or(`due_date.eq.${today},due_date.lt.${today}`)
        .order('due_date', { ascending: true });

      if (error) throw error;

      setUrgentTasks((data || []) as ScheduledAction[]);
    } catch (error) {
      console.error('Error loading urgent tasks:', error);
    }
  }

  function handleAcceptEvents() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEventsAccepted(true);
  }

  function handleAdjustEvents() {
    setAdjustType('events');
    setShowAdjustModal(true);
  }

  function handleAcceptTasks() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTasksAccepted(true);
  }

  function handleAdjustTasks() {
    setAdjustType('tasks');
    setShowAdjustModal(true);
  }

  async function handleCompleteEvent(eventId: string) {
    try {
      const supabase = getSupabaseClient();

      await supabase
        .from('0008-ap-tasks')
        .update({
          status: 'completed',
          completed_at: toLocalISOString(new Date()),
        })
        .eq('id', eventId);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await loadData();
    } catch (error) {
      console.error('Error completing event:', error);
      Alert.alert('Error', 'Failed to complete event');
    }
  }

  async function handleDeleteEvent(eventId: string, eventTitle: string) {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${eventTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              await supabase
                .from('0008-ap-tasks')
                .update({
                  deleted_at: toLocalISOString(new Date()),
                  status: 'cancelled',
                })
                .eq('id', eventId);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              await loadData();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  }

  function handleMindsetPointsAdded(points: number) {
    setMindsetPoints((prev) => prev + points);
  }

  async function handleComplete() {
    if (completing) return;

    try {
      setCompleting(true);

      const supabase = getSupabaseClient();

      // Calculate total committed points
      const eventPoints = (actionsData?.today || []).reduce(
        (sum, event) => sum + (event.points || 3),
        0
      );
      const overduePoints = (actionsData?.overdue || []).reduce(
        (sum, event) => sum + (event.points || 3),
        0
      );
      const sparkCompletionBonus = 10;
      const totalTarget = eventPoints + overduePoints + mindsetPoints + sparkCompletionBonus;

      // Update the spark with completion data
      await supabase
        .from('0008-ap-daily-sparks')
        .update({
          initial_target_score: totalTarget,
          committed_at: toLocalISOString(new Date()),
        })
        .eq('id', sparkId);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Morning Spark Complete!',
        `Your target for today is ${totalTarget} points. Let's make it happen!`,
        [
          {
            text: 'View Dashboard',
            onPress: () => router.replace('/(tabs)/dashboard'),
          },
        ]
      );
    } catch (error) {
      console.error('Error completing Morning Spark:', error);
      Alert.alert('Error', 'Failed to complete Morning Spark. Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  function renderEventRow(event: ScheduledAction, isOverdue: boolean) {
    const iconColor = colors.primary;
    const titleColor = isOverdue ? '#EF4444' : colors.text;

    return (
      <View
        key={event.id}
        style={[styles.eventRow, { borderBottomColor: colors.border }]}
      >
        <View style={styles.quickActions}>
          <TouchableOpacity
            onPress={() => handleCompleteEvent(event.id)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Check size={18} color="#22c55e" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteEvent(event.id, event.title)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.iconContainer}>
          <Calendar size={16} color={iconColor} />
        </View>

        <View style={styles.eventContent}>
          <Text style={[styles.eventTitle, { color: titleColor }]} numberOfLines={1}>
            {event.title}
            {isOverdue && event.start_date && (
              <Text style={styles.overdueText}>
                {' '}(Overdue - {new Date(event.start_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })})
              </Text>
            )}
          </Text>
          {event.start_time && (
            <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
              {formatTimeDisplay(event.start_time)}
              {event.end_time && ` - ${formatTimeDisplay(event.end_time)}`}
            </Text>
          )}
        </View>

        <Text style={[styles.points, { color: '#10B981' }]}>
          +{Math.round(event.points || 3)}
        </Text>
      </View>
    );
  }

  function getCoachMessage(): string {
    if (fuelLevel === 1) {
      return 'Our goal is to reduce overwhelm and prevent spirals.';
    } else if (fuelLevel === 2) {
      return 'Our goal is to maintain steady momentum without burning out.';
    } else {
      return "Our goal is to harness your energy and make today count.";
    }
  }

  function getScheduleMessage(): string {
    const hasEvents = actionsData && (actionsData.overdue.length > 0 || actionsData.today.length > 0);
    
    if (fuelLevel === 1) {
      if (!hasEvents) {
        return "Nothing is currently on your calendar. Let's focus on doing something though.";
      }
      return 'Should we reschedule any of these to protect your energy?';
    } else if (fuelLevel === 2) {
      if (!hasEvents) {
        return "Your calendar is clear. You can add intentions below.";
      }
      return "Here's your schedule. Focus on steady progress.";
    } else {
      if (!hasEvents) {
        return "No scheduled events. Let's create some momentum!";
      }
      return "You're energized! Let's make the most of these opportunities.";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasEvents = actionsData && (actionsData.overdue.length > 0 || actionsData.today.length > 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Morning Spark</Text>
          {fuelLevel && (
            <Text style={styles.fuelEmoji}>{getFuelEmoji(fuelLevel)}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Coach Comments Section */}
        <View style={[styles.coachSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.coachLabel, { color: colors.textSecondary }]}>
            Coach Comments
          </Text>
          <Text style={[styles.coachText, { color: colors.text }]}>
            {getCoachMessage()}
          </Text>
        </View>

        {/* Scheduled Events Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Schedule Today</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {getScheduleMessage()}
          </Text>

          {!hasEvents ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your schedule is clear!
              </Text>
            </View>
          ) : (
            <>
              {actionsData.overdue.length > 0 && (
                <View style={styles.overdueSection}>
                  <View style={styles.overdueBanner}>
                    <View style={styles.redLine} />
                    <Text style={styles.overdueLabel}>
                      Overdue ({actionsData.overdue.length})
                    </Text>
                    <View style={styles.redLine} />
                  </View>
                  <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                    {actionsData.overdue.map((event) => renderEventRow(event, true))}
                  </View>
                </View>
              )}

              {actionsData.today.length > 0 && (
                <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                  {actionsData.today.map((event) => renderEventRow(event, false))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Accept/Adjust Buttons for Events */}
        {hasEvents && !eventsAccepted && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: getFuelColor(fuelLevel || 2) }]}
              onPress={handleAcceptEvents}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>Accept Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjustButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleAdjustEvents}
              activeOpacity={0.8}
            >
              <Text style={[styles.adjustButtonText, { color: colors.text }]}>Adjust</Text>
            </TouchableOpacity>
          </View>
        )}

        {eventsAccepted && hasEvents && (
          <View style={[styles.acceptedBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
            <Check size={20} color="#10B981" />
            <Text style={[styles.acceptedText, { color: '#10B981' }]}>Schedule Accepted</Text>
          </View>
        )}

        {/* Urgent Tasks Section - EL1 Only */}
        {fuelLevel === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Urgent Tasks</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {urgentTasks.length > 0 
                ? "These need attention today. Accept or adjust to protect your energy."
                : "You don't show any Urgent actions listed for today."}
            </Text>

            {urgentTasks.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.emptyEmoji}>✅</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No urgent tasks for today
                </Text>
                <TouchableOpacity
                  style={[styles.viewAllTasksButton, { borderColor: colors.border }]}
                  onPress={() => {
                    Alert.alert(
                      'View All Tasks',
                      'This will show all your tasks (not just urgent ones). Coming soon!',
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <Text style={[styles.viewAllTasksText, { color: colors.text }]}>
                    View All Tasks
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                  {urgentTasks.map((task) => (
                <View
                  key={task.id}
                  style={[styles.eventRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      onPress={() => handleCompleteEvent(task.id)}
                      style={styles.quickActionButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Check size={18} color="#22c55e" strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteEvent(task.id, task.title)}
                      style={styles.quickActionButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={18} color="#ef4444" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.iconContainer}>
                    <CheckSquare size={16} color={colors.primary} />
                  </View>

                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: '#EF4444' }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    {task.due_date && (
                      <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                        Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.points, { color: '#10B981' }]}>
                    +{Math.round(task.points || 3)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Accept/Adjust Buttons for Tasks */}
            {!tasksAccepted && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.acceptButton, { backgroundColor: getFuelColor(fuelLevel) }]}
                  onPress={handleAcceptTasks}
                  activeOpacity={0.8}
                >
                  <Text style={styles.acceptButtonText}>Accept Tasks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adjustButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={handleAdjustTasks}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text }]}>Adjust</Text>
                </TouchableOpacity>
              </View>
            )}

            {tasksAccepted && (
              <View style={[styles.acceptedBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
                <Check size={20} color="#10B981" />
                <Text style={[styles.acceptedText, { color: '#10B981' }]}>Tasks Accepted</Text>
              </View>
            )}
              </>
            )}
          </View>
        )}

        {/* Mindset Capture Section */}
        {fuelLevel && sparkId && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {fuelLevel === 1 && 'Release Something'}
              {fuelLevel === 2 && 'Clear Your Mind'}
              {fuelLevel === 3 && 'Capture the Spark'}
            </Text>
            <MindsetCapture
              fuelLevel={fuelLevel}
              userId={userId}
              sparkId={sparkId}
              onPointsAdded={handleMindsetPointsAdded}
            />
          </View>
        )}

        {/* Review Your Plan Section */}
        {(eventsAccepted || (!hasEvents)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Review Your Plan</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Everything looking good? If you'd like to make any changes to your schedule or tasks, now's the time.
            </Text>
            
            <TouchableOpacity
              style={[styles.reviewButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setShowAdjustModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.reviewButtonText, { color: colors.text }]}>
                Make Changes to Schedule/Tasks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => {
                // Just scroll to bottom / do nothing - they can hit Complete
              }}
            >
              <Text style={[styles.continueButtonText, { color: colors.textSecondary }]}>
                No changes needed, continue →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Your Target Today
          </Text>
          <Text style={[styles.summaryPoints, { color: getFuelColor(fuelLevel || 2) }]}>
            {((actionsData?.today || []).reduce((sum, e) => sum + (e.points || 3), 0) +
              (actionsData?.overdue || []).reduce((sum, e) => sum + (e.points || 3), 0) +
              mindsetPoints +
              10)}{' '}
            points
          </Text>
          <Text style={[styles.summaryBreakdown, { color: colors.textSecondary }]}>
            {actionsData?.today.length || 0} event{(actionsData?.today.length || 0) !== 1 ? 's' : ''} 
            {mindsetPoints > 0 && ` + ${mindsetPoints} mindset`} + 10 completion bonus
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Complete Button - Fixed at bottom */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            { backgroundColor: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
            completing && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={completing}
          activeOpacity={0.8}
        >
          {completing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.completeButtonText}>Complete Morning Spark</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Adjust Modal - Placeholder */}
      <Modal
        visible={showAdjustModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Adjust {adjustType === 'events' ? 'Schedule' : 'Tasks'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAdjustModal(false)}
              style={styles.closeButton}
            >
              <Text style={[styles.closeButtonText, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Adjustment interface coming next.
              {'\n\n'}
              You'll be able to:
              {'\n'}• Reschedule items
              {'\n'}• Cancel items
              {'\n'}• Move items to different dates
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  fuelEmoji: {
    fontSize: 20,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  coachSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  coachLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  coachText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  overdueSection: {
    marginBottom: 16,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  redLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#EF4444',
  },
  overdueLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventsTable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickActionButton: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  overdueText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryPoints: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryBreakdown: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  completeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  adjustButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  adjustButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  acceptedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  viewAllTasksButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewAllTasksText: {
    fontSize: 15,
    fontWeight: '600',
  },
  reviewButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 24,
  },
});