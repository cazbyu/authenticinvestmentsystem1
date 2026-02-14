import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { AlertTriangle, Archive, Calendar, Trash2 } from 'lucide-react-native';

interface OverdueWarningBadgeProps {
  dueDate: string;
  taskId: string;
  onArchive: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onReschedule: (taskId: string) => void;
}

/**
 * Calculates the number of days a task is overdue.
 * Returns 0 if the task is not overdue.
 */
export function getDaysOverdue(dueDate: string | undefined | null): number {
  if (!dueDate) return 0;
  try {
    const [year, month, day] = dueDate.split('T')[0].split('-').map(Number);
    const due = new Date(year, month - 1, day);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

/**
 * Inline warning badge for tasks that are 3+ days overdue.
 * Shows the number of days overdue and quick action buttons
 * for Archive, Reschedule, or Delete.
 */
export function OverdueWarningBadge({
  dueDate,
  taskId,
  onArchive,
  onDelete,
  onReschedule,
}: OverdueWarningBadgeProps) {
  const [showActions, setShowActions] = useState(false);
  const daysOverdue = getDaysOverdue(dueDate);

  if (daysOverdue < 3) return null;

  const isVeryOverdue = daysOverdue >= 7;
  const badgeColor = isVeryOverdue ? '#dc2626' : '#d97706';
  const badgeBg = isVeryOverdue ? '#fef2f2' : '#fffbeb';

  return (
    <View style={[styles.container, { backgroundColor: badgeBg, borderColor: badgeColor }]}>
      <TouchableOpacity
        style={styles.badgeRow}
        onPress={() => setShowActions(!showActions)}
        activeOpacity={0.7}
      >
        <AlertTriangle size={14} color={badgeColor} />
        <Text style={[styles.badgeText, { color: badgeColor }]}>
          {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
        </Text>
        <Text style={[styles.tapHint, { color: badgeColor }]}>
          {showActions ? 'Hide' : 'Actions'}
        </Text>
      </TouchableOpacity>

      {showActions && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rescheduleButton]}
            onPress={() => onReschedule(taskId)}
            activeOpacity={0.7}
          >
            <Calendar size={12} color="#2563eb" />
            <Text style={[styles.actionText, { color: '#2563eb' }]}>Reschedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.archiveButton]}
            onPress={() => onArchive(taskId)}
            activeOpacity={0.7}
          >
            <Archive size={12} color="#7c3aed" />
            <Text style={[styles.actionText, { color: '#7c3aed' }]}>Archive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => onDelete(taskId)}
            activeOpacity={0.7}
          >
            <Trash2 size={12} color="#dc2626" />
            <Text style={[styles.actionText, { color: '#dc2626' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.7,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  rescheduleButton: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  archiveButton: {
    borderColor: '#ddd6fe',
    backgroundColor: '#f5f3ff',
  },
  deleteButton: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
