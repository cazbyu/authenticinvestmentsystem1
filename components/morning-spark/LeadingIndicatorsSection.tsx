import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Target, Check, ChevronRight, Plus, X } from 'lucide-react-native';
import type { LeadingIndicator } from '@/lib/leadingIndicatorUtils';

interface LeadingIndicatorsSectionProps {
  indicators: LeadingIndicator[];
  loading: boolean;
  colors: any;
  onCommit: (indicator: LeadingIndicator) => void;
  onSkip?: (taskId: string) => void;
}

export function LeadingIndicatorsSection({
  indicators,
  loading,
  colors,
  onCommit,
  onSkip,
}: LeadingIndicatorsSectionProps) {
  const [showSection, setShowSection] = useState(true);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [committedIds, setCommittedIds] = useState<Set<string>>(new Set());

  const visibleIndicators = indicators.filter(
    (ind) => !skippedIds.has(ind.taskId)
  );

  if (!loading && visibleIndicators.length === 0) return null;

  const handleSkip = (taskId: string) => {
    setSkippedIds((prev) => new Set([...prev, taskId]));
    onSkip?.(taskId);
  };

  const handleCommit = (indicator: LeadingIndicator) => {
    setCommittedIds((prev) => new Set([...prev, indicator.taskId]));
    onCommit(indicator);
  };

  const renderIndicatorCard = (indicator: LeadingIndicator) => {
    const isCommitted = committedIds.has(indicator.taskId);
    const progressPct = indicator.weeklyTarget > 0
      ? Math.round((indicator.weeklyCompleted / indicator.weeklyTarget) * 100)
      : 0;

    return (
      <View
        key={indicator.taskId}
        style={[
          styles.indicatorCard,
          { backgroundColor: colors.surface, borderColor: isCommitted ? '#10B981' : '#86efac' },
          isCommitted && styles.committedCard,
        ]}
      >
        <View style={styles.indicatorHeader}>
          <View style={styles.goalBadge}>
            <Target size={12} color="#16a34a" />
            <Text style={styles.goalBadgeText} numberOfLines={1}>
              {indicator.goalTitle}
            </Text>
          </View>
          {!isCommitted && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => handleSkip(indicator.taskId)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.indicatorTitle, { color: colors.text }]} numberOfLines={2}>
          {indicator.title}
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(progressPct, 100)}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {indicator.weeklyCompleted}/{indicator.weeklyTarget} this week
          </Text>
        </View>

        {isCommitted ? (
          <View style={styles.committedRow}>
            <Check size={16} color="#10B981" strokeWidth={3} />
            <Text style={styles.committedText}>Added to today</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.commitButton}
            onPress={() => handleCommit(indicator)}
            activeOpacity={0.7}
          >
            <Plus size={14} color="#fff" />
            <Text style={styles.commitButtonText}>Add to Today</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowSection(!showSection)}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            🎯 Goal Actions for Today
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            ({visibleIndicators.length})
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showSection ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showSection && (
        <>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
            These recurring actions support your goals and are scheduled for today.
          </Text>

          {loading ? (
            <View style={[styles.loadingState, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.indicatorsList}>
              {visibleIndicators.map((indicator) => renderIndicatorCard(indicator))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsibleCount: {
    fontSize: 14,
    fontWeight: '400',
  },
  collapsibleIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  indicatorsList: {
    marginTop: 12,
    gap: 10,
  },
  indicatorCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  committedCard: {
    backgroundColor: '#f0fdf4',
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
  },
  skipButton: {
    padding: 4,
  },
  indicatorTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 80,
    textAlign: 'right',
  },
  commitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 8,
  },
  commitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  committedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  committedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
});
