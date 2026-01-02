import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSquare, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  checkTodaysSpark,
  getScheduledActions,
  getFuelLevelMessage,
  formatTimeDisplay,
  ScheduledAction,
  ScheduledActionsData,
} from '@/lib/sparkUtils';

export default function ScheduledActionsScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [actionsData, setActionsData] = useState<ScheduledActionsData | null>(null);

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

      const [spark, actions] = await Promise.all([
        checkTodaysSpark(user.id),
        getScheduledActions(user.id),
      ]);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      setFuelLevel(spark.fuel_level);
      setActionsData(actions);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load scheduled actions. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push('/morning-spark/brain-dump');
  }

  function handleAdjust() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      'Coming Soon',
      "The Adjust feature is coming soon! We'll build this after testing the main flow.",
      [{ text: 'OK', style: 'default' }]
    );
  }

  function renderActionCard(action: ScheduledAction, isOverdue: boolean) {
    const isTask = action.type === 'task';
    const isDueToday = action.due_date === new Date().toISOString().split('T')[0];

    let statusBadge = null;
    if (isOverdue) {
      statusBadge = (
        <View style={[styles.badge, styles.badgeOverdue]}>
          <Text style={styles.badgeText}>Overdue</Text>
        </View>
      );
    } else if (isDueToday && action.due_date) {
      statusBadge = (
        <View style={[styles.badge, styles.badgeDueToday]}>
          <Text style={styles.badgeText}>Due Today</Text>
        </View>
      );
    } else if (action.start_date) {
      statusBadge = (
        <View style={[styles.badge, { backgroundColor: isDarkMode ? '#4B5563' : '#E5E7EB' }]}>
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>Scheduled</Text>
        </View>
      );
    }

    const timeDisplay = action.start_time
      ? formatTimeDisplay(action.start_time)
      : action.due_date
      ? 'Due: ' + new Date(action.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    const iconColor = isOverdue ? '#EF4444' : isDueToday ? '#F59E0B' : colors.textSecondary;

    return (
      <View key={action.id} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.actionHeader}>
          <View style={styles.actionIconContainer}>
            {isTask ? (
              <CheckSquare size={20} color={iconColor} />
            ) : (
              <Calendar size={20} color={iconColor} />
            )}
          </View>
          {statusBadge}
        </View>

        <Text style={[styles.actionTitle, { color: colors.text }]} numberOfLines={2}>
          {action.title}
        </Text>

        {action.description && (
          <Text style={[styles.actionDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {action.description}
          </Text>
        )}

        <View style={styles.actionFooter}>
          {timeDisplay && (
            <Text style={[styles.actionTime, { color: colors.textSecondary }]}>
              {timeDisplay}
            </Text>
          )}
          {action.is_all_day && (
            <Text style={[styles.allDayBadge, { color: colors.textSecondary }]}>All Day</Text>
          )}
        </View>
      </View>
    );
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

  const hasActions = actionsData && (actionsData.overdue.length > 0 || actionsData.today.length > 0);
  const totalCount = actionsData ? actionsData.totalTasks + actionsData.totalEvents : 0;

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Schedule</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Your Schedule Today</Text>
          {fuelLevel && (
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              {getFuelLevelMessage(fuelLevel)}
            </Text>
          )}
          {hasActions && (
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {actionsData.totalTasks > 0 && `${actionsData.totalTasks} task${actionsData.totalTasks > 1 ? 's' : ''}`}
              {actionsData.totalTasks > 0 && actionsData.totalEvents > 0 && ' and '}
              {actionsData.totalEvents > 0 && `${actionsData.totalEvents} event${actionsData.totalEvents > 1 ? 's' : ''}`}
              {' scheduled'}
            </Text>
          )}
        </View>

        {!hasActions ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your schedule is clear!</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You can add Deposit Ideas in the next step.
            </Text>
          </View>
        ) : (
          <>
            {actionsData.overdue.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionHeaderLine, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
                    Overdue ({actionsData.overdue.length})
                  </Text>
                  <View style={[styles.sectionHeaderLine, { backgroundColor: '#EF4444' }]} />
                </View>
                {actionsData.overdue.map((action) => renderActionCard(action, true))}
              </View>
            )}

            {actionsData.today.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionHeaderLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Today's Schedule ({actionsData.today.length})
                  </Text>
                  <View style={[styles.sectionHeaderLine, { backgroundColor: colors.border }]} />
                </View>
                {actionsData.today.map((action) => renderActionCard(action, false))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleAccept}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>✓ Accept Schedule</Text>
        </TouchableOpacity>

        {hasActions && (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleAdjust}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>✏️ Adjust</Text>
          </TouchableOpacity>
        )}
      </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
  },
  titleSection: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeOverdue: {
    backgroundColor: '#EF4444',
  },
  badgeDueToday: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 22,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  allDayBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
