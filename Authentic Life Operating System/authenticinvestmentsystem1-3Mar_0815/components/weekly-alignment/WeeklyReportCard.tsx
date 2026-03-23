// ============================================================================
// WeeklyReportCard.tsx - Weekly Report opening card for Weekly Alignment
// ============================================================================
// Shows a summary of the past week's activity before the alignment begins.
// Displays avg day score, ritual counts, most active role, and goal progress.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ChevronRight, Sun, Moon, Award, Target, TrendingUp } from 'lucide-react-native';
import { CompassDirectionHeader } from '@/components/compass/CompassDirectionHeader';
import {
  getWeeklyReport,
  WeeklyReportData,
} from '@/lib/weeklyAlignmentCompassService';

interface WeeklyReportCardProps {
  userId: string;
  colors: any;
  onContinue: () => void;
  onReportLoaded: (data: WeeklyReportData) => void;
}

export function WeeklyReportCard({
  userId,
  colors,
  onContinue,
  onReportLoaded,
}: WeeklyReportCardProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError(null);
        const data = await getWeeklyReport(userId);
        if (!cancelled) {
          setReport(data);
          onReportLoaded(data);
        }
      } catch (err: any) {
        console.error('Error loading weekly report:', err);
        if (!cancelled) {
          setError('Could not load weekly report.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors?.primary || '#ed1c24'} />
        <Text style={[styles.loadingText, { color: colors?.textSecondary || '#666' }]}>
          Gathering your weekly data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.errorText, { color: colors?.error || '#ef4444' }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onContinue}>
          <Text style={styles.retryButtonText}>Continue anyway</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <CompassDirectionHeader
        direction="north"
        label="Weekly Report"
        powerQuestion={'"Who am I? Why am I here?"'}
      />

      <View style={styles.cardsWrapper}>
        {/* Day Score */}
        <View style={[styles.statCard, { borderColor: colors?.border || '#e5e7eb' }]}>
          <View style={styles.statRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#F59E0B18' }]}>
              <TrendingUp size={20} color="#F59E0B" />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={[styles.statLabel, { color: colors?.textSecondary || '#666' }]}>
                Avg Day Score
              </Text>
              <Text style={[styles.statValue, { color: colors?.text || '#1a1a1a' }]}>
                {report?.avg_day_score !== null ? `${report!.avg_day_score}%` : 'No data yet'}
              </Text>
            </View>
          </View>
        </View>

        {/* Rituals Row */}
        <View style={styles.ritualRow}>
          <View style={[styles.statCardHalf, { borderColor: colors?.border || '#e5e7eb' }]}>
            <View style={[styles.iconCircleSmall, { backgroundColor: '#F5920018' }]}>
              <Sun size={16} color="#F59200" />
            </View>
            <Text style={[styles.ritualCount, { color: colors?.text || '#1a1a1a' }]}>
              {report?.morning_sparks_count ?? 0}
            </Text>
            <Text style={[styles.ritualLabel, { color: colors?.textSecondary || '#666' }]}>
              Morning Sparks
            </Text>
          </View>

          <View style={[styles.statCardHalf, { borderColor: colors?.border || '#e5e7eb' }]}>
            <View style={[styles.iconCircleSmall, { backgroundColor: '#6366F118' }]}>
              <Moon size={16} color="#6366F1" />
            </View>
            <Text style={[styles.ritualCount, { color: colors?.text || '#1a1a1a' }]}>
              {report?.evening_reviews_count ?? 0}
            </Text>
            <Text style={[styles.ritualLabel, { color: colors?.textSecondary || '#666' }]}>
              Evening Reviews
            </Text>
          </View>
        </View>

        {/* Most Active Role */}
        {report?.most_active_role && (
          <View style={[styles.statCard, { borderColor: colors?.border || '#e5e7eb' }]}>
            <View style={styles.statRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#9370DB18' }]}>
                <Award size={20} color="#9370DB" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={[styles.statLabel, { color: colors?.textSecondary || '#666' }]}>
                  Most Active Role
                </Text>
                <Text style={[styles.statValue, { color: colors?.text || '#1a1a1a' }]}>
                  {report.most_active_role.role_name}
                </Text>
                <Text style={[styles.statSubtext, { color: colors?.textSecondary || '#999' }]}>
                  {report.most_active_role.count} activities this week
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Goal Progress */}
        {report?.active_goal_title && (
          <View style={[styles.statCard, { borderColor: colors?.border || '#e5e7eb' }]}>
            <View style={styles.statRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#4169E118' }]}>
                <Target size={20} color="#4169E1" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={[styles.statLabel, { color: colors?.textSecondary || '#666' }]}>
                  Goal Execution
                </Text>
                <Text style={[styles.statValue, { color: colors?.text || '#1a1a1a' }]}>
                  {report.goal_execution_rate !== null ? `${report.goal_execution_rate}%` : '--'}
                </Text>
                <Text
                  style={[styles.statSubtext, { color: colors?.textSecondary || '#999' }]}
                  numberOfLines={1}
                >
                  {report.active_goal_title}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* No goal state */}
        {!report?.active_goal_title && (
          <View style={[styles.statCard, { borderColor: colors?.border || '#e5e7eb' }]}>
            <View style={styles.statRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#6B728018' }]}>
                <Target size={20} color="#6B7280" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={[styles.statLabel, { color: colors?.textSecondary || '#666' }]}>
                  Goal Execution
                </Text>
                <Text style={[styles.statValue, { color: colors?.textSecondary || '#999' }]}>
                  No active goal
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: colors?.primary || '#ed1c24' }]}
        onPress={onContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>Let's go</Text>
        <ChevronRight size={20} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  cardsWrapper: {
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTextContainer: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  statSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  ritualRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCardHalf: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  ritualCount: {
    fontSize: 28,
    fontWeight: '700',
  },
  ritualLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
