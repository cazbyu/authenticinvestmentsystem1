import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {
  CheckCircle2,
  Archive,
  Clock,
  X,
  ListTodo,
  Lightbulb,
  FileText,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';

export interface FollowUpItemData {
  follow_up_id: string;
  user_id: string;
  parent_type: 'task' | 'event' | 'depositIdea' | 'reflection';
  parent_id: string;
  title: string;
  follow_up_date: string;
  status: string;
  reason_type?: string;
  reason?: string;
  created_at: string;
  completed_at?: string;
  archived: boolean;
}

interface FollowUpItemProps {
  item: FollowUpItemData;
  onTakeAction: (item: FollowUpItemData) => void;
  onFileAway: (item: FollowUpItemData) => void;
  onDelay: (item: FollowUpItemData) => void;
  onDismiss: (item: FollowUpItemData) => void;
  disabled?: boolean;
}

export function FollowUpItem({
  item,
  onTakeAction,
  onFileAway,
  onDelay,
  onDismiss,
  disabled = false,
}: FollowUpItemProps) {
  const { colors } = useTheme();
  const [showActions, setShowActions] = useState(false);

  function getTypeIcon() {
    switch (item.parent_type) {
      case 'task':
        return <ListTodo size={20} color={colors.primary} />;
      case 'event':
        return <Calendar size={20} color={colors.primary} />;
      case 'depositIdea':
        return <Lightbulb size={20} color="#F59E0B" />;
      case 'reflection':
        return <FileText size={20} color="#8B5CF6" />;
      default:
        return <ListTodo size={20} color={colors.primary} />;
    }
  }

  function getTypeLabel() {
    switch (item.parent_type) {
      case 'task':
        return 'Task';
      case 'event':
        return 'Event';
      case 'depositIdea':
        return 'Idea';
      case 'reflection':
        return 'Note';
      default:
        return 'Item';
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function handlePress() {
    if (disabled) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setShowActions(!showActions);
  }

  function handleAction(action: 'takeAction' | 'fileAway' | 'delay' | 'dismiss') {
    if (disabled) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    switch (action) {
      case 'takeAction':
        onTakeAction(item);
        break;
      case 'fileAway':
        onFileAway(item);
        break;
      case 'delay':
        onDelay(item);
        break;
      case 'dismiss':
        onDismiss(item);
        break;
    }

    setShowActions(false);
  }

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
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
        <View style={styles.iconContainer}>{getTypeIcon()}</View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {item.title || 'Untitled'}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
              {getTypeLabel()}
            </Text>
            <Text style={[styles.separator, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              Follow-up: {formatDate(item.follow_up_date)}
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
            onPress={() => handleAction('takeAction')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <CheckCircle2 size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Take Action
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('fileAway')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Archive size={18} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              File Away
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('delay')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Clock size={18} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Delay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => handleAction('dismiss')}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <X size={18} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>
              Dismiss
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
    borderWidth: 1,
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
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    fontSize: 13,
  },
  date: {
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
  },
});
