// components/goals/MilestoneSessionRow.tsx
import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { DayDot } from './DayDot';
import { getMilestoneCompletionsForWeek, MilestoneSummary } from '@/services/milestoneService';

interface MilestoneSessionRowProps {
  milestone: MilestoneSummary;
  weekDays: Array<{ date: string; dayName: string; dayOfWeek: number }>;
  weekStart: string;
  weekEnd: string;
  onDayPress: (date: string, dayLabel: string) => void;
  targetDays: number;
}

export const MilestoneSessionRow = memo(function MilestoneSessionRow({
  milestone,
  weekDays,
  weekStart,
  weekEnd,
  onDayPress,
  targetDays,
}: MilestoneSessionRowProps) {
  const [completedDates, setCompletedDates] = useState<string[]>([]);

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

  const getProgressColor = useCallback((actual: number, target: number) => {
    const pct = target > 0 ? (actual / target) * 100 : 0;
    if (pct >= 85) return '#16a34a';
    if (pct >= 60) return '#eab308';
    return '#dc2626';
  }, []);

  const progressPct = useMemo(() => {
    return targetDays > 0 ? Math.min(100, (completedCount / targetDays) * 100) : 0;
  }, [completedCount, targetDays]);

  const progressColor = useMemo(
    () => getProgressColor(completedCount, targetDays),
    [completedCount, targetDays, getProgressColor]
  );

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
          <Text style={styles.exerciseCount}>
            {milestone.exercise_count} {milestone.exercise_count === 1 ? 'exercise' : 'exercises'}
          </Text>
          <Text style={styles.count}>
            {completedCount}/{targetDays}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressPct}%`, backgroundColor: progressColor },
          ]}
        />
      </View>

      {/* Day dots */}
      <View style={styles.dayDotsRow}>
        {weekDays.map(day => {
          const hasLog = completedDates.includes(day.date);
          const dayLabel = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayOfWeek];

          return (
            /* onToggle opens the exercise panel, not a direct completion toggle.
               Milestone circles are driven by exercise logging — DayDot is reused
               for visual consistency only. The parent handles completion state. */
            <DayDot
              key={day.date}
              date={day.date}
              dayName={day.dayName}
              hasLog={hasLog}
              onToggle={(date: string) => {
                onDayPress(date, dayLabel);
              }}
              disabled={false}
            />
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
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
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseCount: {
    fontSize: 11,
    color: '#9ca3af',
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#f3f4f6',
    borderRadius: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  dayDotsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
});
