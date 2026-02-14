import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Users, User, Calendar, CircleDot } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { DelegationItem } from '@/lib/morningSparkV2Service';

interface DelegationStepProps {
  delegations: DelegationItem[];
  loading: boolean;
}

function getStatusColor(status: string, colors: ReturnType<typeof useTheme>['colors']): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'done':
      return colors.success;
    case 'overdue':
    case 'late':
      return colors.error;
    case 'in_progress':
    case 'in progress':
      return colors.warning;
    case 'pending':
    default:
      return colors.textSecondary;
  }
}

function formatDueDate(dateString: string | null): string {
  if (!dateString) return 'No due date';

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays === -1) return 'Due tomorrow';
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} overdue`;

  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function isDueDateOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function DelegationStep({ delegations, loading }: DelegationStepProps) {
  const { colors, isDarkMode } = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (delegations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '15' }]}>
          <Users size={36} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Nothing delegated today
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          You could delegate tasks to free up focus.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        {delegations.length} delegation{delegations.length !== 1 ? 's' : ''} to review
      </Text>

      {delegations.map((item) => {
        const overdue = isDueDateOverdue(item.due_date);
        const statusColor = getStatusColor(item.status, colors);

        return (
          <View
            key={item.delegation_id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: overdue ? colors.error : colors.border,
                borderWidth: overdue ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>
              {item.task_title}
            </Text>

            <View style={styles.metaRow}>
              <User size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.delegate_name}
              </Text>
            </View>

            {item.due_date && (
              <View style={styles.metaRow}>
                <Calendar
                  size={14}
                  color={overdue ? colors.error : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: overdue ? colors.error : colors.textSecondary,
                      fontWeight: overdue ? '700' : '500',
                    },
                  ]}
                >
                  {formatDueDate(item.due_date)}
                </Text>
              </View>
            )}

            <View style={styles.statusRow}>
              <CircleDot size={12} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
  },
  container: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
