// components/goals/MilestoneSessionRow.tsx
import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { formatLocalDate } from '@/lib/dateUtils';
import { getMilestoneCompletionsForWeek, MilestoneSummary } from '@/services/milestoneService';

interface MilestoneSessionRowProps {
  milestone: MilestoneSummary;
  weekDays: Array<{ date: string; dayName: string; dayOfWeek: number }>;
  weekStart: string;
  weekEnd: string;
  onDayPress: (date: string, dayLabel: string) => void;
  targetDays: number;
  onEdit?: () => void;
}

export const MilestoneSessionRow = memo(function MilestoneSessionRow({
  milestone,
  weekDays,
  weekStart,
  weekEnd,
  onDayPress,
  targetDays,
  onEdit,
}: MilestoneSessionRowProps) {
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const today = formatLocalDate(new Date());

  useEffect(() => {
    let cancelled = false;
    getMilestoneCompletionsForWeek(milestone.milestone_id, weekStart, weekEnd)
      .then(dates => {
        if (!cancelled) setCompletedDates(dates);
      })
      .catch(err => {
        console.error('[MilestoneSessionRow] Error fetching completions:', err);
      });
    return () => { cancelled = true; };
  }, [milestone.milestone_id, weekStart, weekEnd]);

  const completedCount = completedDates.length;

  const progressPct = useMemo(() => {
    return targetDays > 0 ? Math.min(100, (completedCount / targetDays) * 100) : 0;
  }, [completedCount, targetDays]);

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.sessionBadge}>
            <Dumbbell size={10} color="#ffffff" />
            <Text style={styles.sessionBadgeText}>Session</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {milestone.milestone_name}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.pctText}>{Math.round(progressPct)}%</Text>
          <Text style={styles.countText}>{completedCount}/{targetDays}</Text>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressPct}%` },
          ]}
        />
      </View>

      {/* Day bubbles — matches liBubble pattern from GoalDetailView */}
      <View style={styles.dayDotsRow}>
        {weekDays.map((day) => {
          const isCompleted = completedDates.includes(day.date);
          const isPast = day.date < today;
          const isMissed = isPast && !isCompleted;

          return (
            <TouchableOpacity
              key={day.date}
              onPress={() => onDayPress(day.date, day.dayName)}
              activeOpacity={0.7}
              style={[
                styles.dayBubble,
                isCompleted && styles.dayBubbleCompleted,
                isMissed && styles.dayBubbleMissed,
              ]}
            >
              <Text style={[
                styles.dayBubbleLabel,
                isCompleted && styles.dayBubbleLabelCompleted,
                isMissed && styles.dayBubbleLabelMissed,
              ]}>
                {day.dayName.slice(0, 1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  sessionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pctText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  countText: {
    fontSize: 13,
    color: '#6b7280',
  },
  editText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  dayDotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 0,
  },
  dayBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleCompleted: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  dayBubbleMissed: {
    backgroundColor: '#f3f4f6',
    borderColor: '#9ca3af',
  },
  dayBubbleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  dayBubbleLabelCompleted: {
    color: '#16a34a',
  },
  dayBubbleLabelMissed: {
    color: '#9ca3af',
  },
});
