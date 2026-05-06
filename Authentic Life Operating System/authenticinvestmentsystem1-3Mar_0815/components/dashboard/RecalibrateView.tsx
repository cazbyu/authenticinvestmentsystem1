// RecalibrateView.tsx
// Dashboard D1 component — Recalibrate (overdue tasks) view
// Amber treatment, Reschedule / Complete / Release actions

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Circle } from 'lucide-react-native';

export type OverdueTask = {
  id: string;
  title: string;
  due_date: string; // YYYY-MM-DD
};

interface RecalibrateViewProps {
  tasks: OverdueTask[];
  onReschedule: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRelease: (taskId: string) => void;
}

function daysAgo(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecalibrateView({
  tasks,
  onReschedule,
  onComplete,
  onRelease,
}: RecalibrateViewProps) {
  const count = tasks.length;
  const itemWord = count === 1 ? 'item' : 'items';

  return (
    <View>
      <View style={styles.alertBar}>
        <Text style={styles.alertTitle}>
          Time to recalibrate — {count} {itemWord} waiting
        </Text>
        <Text style={styles.alertBody}>
          These didn't happen as planned. Reschedule, complete, or release them.
        </Text>
      </View>

      {count === 0 ? (
        <Text style={styles.emptyText}>All clear — nothing to recalibrate.</Text>
      ) : (
        tasks.map((task) => {
          const ago = daysAgo(task.due_date);
          const agoLabel =
            ago <= 0 ? 'today' :
            ago === 1 ? '1 day ago' :
            `${ago} days ago`;
          return (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskRow}>
                <Circle size={18} color="#fcd34d" strokeWidth={2.5} />
                <View style={styles.taskTextBlock}>
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                  <Text style={styles.taskDate}>
                    {formatShortDate(task.due_date)} — {agoLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionAmber]}
                  onPress={() => onReschedule(task.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionBtnText, styles.actionAmberText]}>
                    Reschedule
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionAmber]}
                  onPress={() => onComplete(task.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionBtnText, styles.actionAmberText]}>
                    Complete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionNeutral]}
                  onPress={() => onRelease(task.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionBtnText, styles.actionNeutralText]}>
                    Release
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alertBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350f',
  },
  alertBody: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    paddingVertical: 24,
  },
  taskCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskTextBlock: { flex: 1 },
  taskTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 18,
  },
  taskDate: {
    fontSize: 10,
    color: '#b45309',
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionAmber: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  actionAmberText: { color: '#78350f' },
  actionNeutral: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  actionNeutralText: { color: '#6b7280' },
});
