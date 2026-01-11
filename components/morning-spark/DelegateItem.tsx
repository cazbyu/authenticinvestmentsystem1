import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  X,
  Bell,
  User,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';

export interface DelegationItemData {
  delegation_id: string;
  user_id: string;
  delegate_name: string;
  delegate_email?: string;
  task_id: string;
  task_title: string;
  due_date: string;
  completed: boolean;
  status: string;
  notes?: string;
  created_at: string;
  task_status?: string;
}

interface DelegateItemProps {
  item: DelegationItemData;
  onCheckStatus: (item: DelegationItemData) => void;
  onSendReminder: (item: DelegationItemData) => void;
  onReschedule: (item: DelegationItemData) => void;
  onCancel: (item: DelegationItemData) => void;
  disabled?: boolean;
}

export function DelegateItem({
  item,
  onCheckStatus,
  onSendReminder,
  onReschedule,
  onCancel,
  disabled = false,
}: DelegateItemProps) {
  const { colors } = useTheme();
  const [showActions, setShowActions] = useState(false);

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(date);
    itemDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Tomorrow';
    if (diffDays > 0) {
      if (diffDays === 1) return '1 day overdue';
      return `${diffDays} days overdue`;
    }
    if (diffDays < 0) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isOverdue(): boolean {
    const date = new Date(item.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  function handlePress() {
    if (disabled) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setShowActions(!showActions);
  }

  function handleAction(action: 'checkStatus' | 'sendReminder' | 'reschedule' | 'cancel') {
    if (disabled) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    switch (action) {
      case 'checkStatus':
        onCheckStatus(item);
        break;
      case 'sendReminder':
        onSendReminder(item);
        break;
      case 'reschedule':
        onReschedule(item);
        break;
      case 'cancel':
        onCancel(item);
        break;
    }

    setShowActions(false);
  }

  const overdue = isOverdue();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: overdue ? '#EF4444' : colors.border,
          borderWidth: overdue ? 2 : 1,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <User size={20} color={colors.primary} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.delegateName, { color: colors.text }]} numberOfLines={1}>
            {item.delegate_name}
          </Text>

          <Text style={[styles.taskTitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.task_title}
          </Text>

          <View style={styles.metaRow}>
            <Calendar size={14} color={overdue ? '#EF4444' : colors.textSecondary} />
            <Text
              style={[
                styles.dueDate,
                {
                  color: overdue ? '#EF4444' : colors.textSecondary,
                  fontWeight: overdue ? '700' : '500',
                },
              ]}
            >
              Due: {formatDate(item.due_date)}
            </Text>
          </View>
        </View>

        <View style={styles.expandIndicator}>
          <Text style={[styles.tapText, { color: colors.textSecondary }]}>
            {showActions ? '−' : '+'}
          </Text>
        </View>
      </TouchableOpacity>

      {showActions && (
        <View style={[styles.actions, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('checkStatus')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <CheckCircle2 size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Check Status (Mark Complete)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('sendReminder')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Bell size={18} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Send Reminder
            </Text>
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
                Soon
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('reschedule')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Clock size={18} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Reschedule
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('cancel')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <X size={18} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>
              Cancel Delegation
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  delegateName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dueDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  expandIndicator: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapText: {
    fontSize: 24,
    fontWeight: '300',
  },
  actions: {
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
