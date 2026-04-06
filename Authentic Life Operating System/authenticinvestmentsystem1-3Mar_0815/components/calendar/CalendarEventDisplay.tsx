import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, X, Users, Flag, Heart, Target, FileText, UserPlus } from 'lucide-react-native';
import CommitmentEnrichmentModal from './CommitmentEnrichmentModal';
import { Task } from '@/components/tasks/TaskCard';
import { formatTimeForDisplay } from '@/lib/dateUtils';

interface CalendarEventDisplayProps {
  task: Task;
  onPress: (task: Task) => void;
  onCommitmentComplete?: (id: string) => void;
  onCommitmentDismiss?: (id: string) => void;
  onCommitmentEnrich?: (commitmentId: string, tab: 'roles' | 'wellness' | 'goals' | 'priority' | 'notes' | 'delegate') => void;
  currentUserId?: string;
  style?: any;
}

export function CalendarEventDisplay({
  task,
  onPress,
  onCommitmentComplete,
  onCommitmentDismiss,
  onCommitmentEnrich,
  currentUserId,
  style,
}: CalendarEventDisplayProps) {
  const [enrichTab, setEnrichTab] = useState<'roles' | 'wellness' | 'goals' | 'priority' | 'notes' | 'delegate'>('roles');
  const [enrichModalVisible, setEnrichModalVisible] = useState(false);
  const formatTime = (timeString: string) => {
    return formatTimeForDisplay(timeString);
  };

  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

  const isNoTimeTask = (task as any).isNoTimeTask;
  const isTask = task.type === 'task';
  const isEvent = task.type === 'event';
  const isCompleted = task.status === 'completed';

  // For tasks, prefer due_time over start_time (post-migration).
  // For events, always use start_time.
  const displayStartTime = isTask ? (task.due_time || task.start_time) : task.start_time;

  const calendarBg = (task as any).calendarColor as string | undefined;
  const calendarFg = (task as any).calendarTextColor as string | undefined;
  const isCommitment = !!(task as any).isCommitment;
  const eventState = (task as any).eventState as
    | 'upcoming' | 'in_progress' | 'needs_review' | 'completed' | 'dismissed' | undefined;

  // Determine background + text color based on lifecycle state (commitments only)
  let cardBg: string | undefined;
  let titleColor: string | undefined;
  let timeColor: string | undefined;
  let accentLeftBorder: string | undefined;

  if (isCommitment) {
    if (eventState === 'upcoming') {
      cardBg = calendarBg;
      titleColor = calendarFg;
      timeColor = calendarFg;
    } else if (eventState === 'in_progress') {
      cardBg = '#F0F0F0';
      titleColor = '#111111';
      timeColor = '#374151';
      accentLeftBorder = calendarBg; // subtle "happening now" cue
    } else if (eventState === 'needs_review' || eventState === 'completed') {
      cardBg = '#F0F0F0';
      titleColor = '#111111';
      timeColor = '#374151';
    }
  } else if (calendarBg) {
    // Fallback: non-commitment but has calendarColor (shouldn't really happen)
    cardBg = calendarBg;
    titleColor = calendarFg;
    timeColor = calendarFg;
  }

  const showReviewButtons =
    isCommitment && eventState === 'needs_review' && !!onCommitmentComplete && !!onCommitmentDismiss;
  const showCompletedBadge = isCommitment && eventState === 'completed';

  // Enrichment bar: only for commitments that aren't dismissed
  const showEnrichmentBar = isCommitment && eventState !== 'dismissed';

  // Build icon-button background: calendarBg @ 20% opacity, fallback to #e5e7eb
  const hexToRgba = (hex: string | undefined, alpha: number): string | undefined => {
    if (!hex || hex.length < 7) return undefined;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return undefined;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const iconBtnBg = hexToRgba(calendarBg, 0.2) ?? '#e5e7eb';
  const iconColor = titleColor ?? '#111111';

  // Enrichment flags — show a green dot if the task already has data
  const hasRoles     = Array.isArray((task as any).roles)   && (task as any).roles.length > 0;
  const hasGoals     = Array.isArray((task as any).goals)   && (task as any).goals.length > 0;
  const hasWellness  = Array.isArray((task as any).domains) && (task as any).domains.length > 0;
  const hasNotes     = (task as any).has_notes === true;
  const hasDelegates = (task as any).has_delegates === true;

  // Priority icon uses quadrant color
  const urg = task.is_urgent ?? false;
  const imp = task.is_important ?? false;
  const priorityIconColor = (urg && imp) ? '#ef4444' : (!urg && imp) ? '#10b981' : (urg && !imp) ? '#f59e0b' : (iconColor ?? '#6b7280');

  return (
    <TouchableOpacity
      style={[
        styles.eventContainer,
        { borderLeftColor: getBorderColor(), borderColor: getBorderColor() },
        isNoTimeTask && styles.noTimeTaskContainer,
        isTask && styles.taskContainer,
        isCompleted && styles.completedContainer,
        style,
        cardBg ? { backgroundColor: cardBg } : null,
        accentLeftBorder ? { borderLeftColor: accentLeftBorder, borderLeftWidth: 4 } : null,
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.8}
    >
      {showCompletedBadge && (
        <View style={styles.completedBadge}>
          <Check size={12} color="#ffffff" strokeWidth={3} />
        </View>
      )}

      <View style={styles.eventContent}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.eventTitle,
              isNoTimeTask && styles.noTimeTaskTitle,
              isCompleted && styles.completedTitle,
              titleColor ? { color: titleColor } : null,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
        </View>
        {!isNoTimeTask && displayStartTime && task.end_time && (
          <Text style={[styles.eventTime, timeColor ? { color: timeColor, opacity: 0.85 } : null]}>
            {formatTime(displayStartTime)} – {formatTime(task.end_time)}
          </Text>
        )}
        {!isNoTimeTask && displayStartTime && !task.end_time && (
          <Text style={[styles.eventTime, timeColor ? { color: timeColor, opacity: 0.85 } : null]}>
            {formatTime(displayStartTime)}
          </Text>
        )}
        {isNoTimeTask && (
          <Text style={styles.noTimeLabel}>
            No time set
          </Text>
        )}

        {showEnrichmentBar && (
          <View style={styles.enrichmentRow}>
            <TouchableOpacity
              style={[styles.enrichBtn, { backgroundColor: iconBtnBg }]}
              onPress={(e) => { e.stopPropagation?.(); setEnrichTab('roles'); setEnrichModalVisible(true); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Users size={14} color={iconColor} />
              {hasRoles && <View style={styles.enrichDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.enrichBtn, { backgroundColor: iconBtnBg }]}
              onPress={(e) => { e.stopPropagation?.(); setEnrichTab('priority'); setEnrichModalVisible(true); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Flag size={14} color={priorityIconColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.enrichBtn, { backgroundColor: iconBtnBg }]}
              onPress={(e) => { e.stopPropagation?.(); setEnrichTab('wellness'); setEnrichModalVisible(true); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Heart size={14} color={iconColor} />
              {hasWellness && <View style={styles.enrichDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.enrichBtn, { backgroundColor: iconBtnBg }]}
              onPress={(e) => { e.stopPropagation?.(); setEnrichTab('goals'); setEnrichModalVisible(true); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Target size={14} color={iconColor} />
              {hasGoals && <View style={styles.enrichDot} />}
            </TouchableOpacity>

            <View style={styles.enrichSpacer} />

            <TouchableOpacity
              style={[styles.enrichBtn, { backgroundColor: iconBtnBg }]}
              onPress={(e) => { e.stopPropagation?.(); setEnrichTab('notes'); setEnrichModalVisible(true); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <FileText size={14} color={iconColor} />
              {hasNotes && <View style={styles.enrichDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.enrichBtn, { backgroundColor: iconBtnBg }]}
              onPress={(e) => { e.stopPropagation?.(); setEnrichTab('delegate'); setEnrichModalVisible(true); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <UserPlus size={14} color={iconColor} />
              {hasDelegates && <View style={styles.enrichDot} />}
            </TouchableOpacity>
          </View>
        )}

        {showReviewButtons && (
          <View style={styles.reviewRow}>
            <TouchableOpacity
              style={[styles.reviewBtn, styles.reviewBtnComplete]}
              onPress={(e) => {
                e.stopPropagation?.();
                onCommitmentComplete?.(task.id);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Check size={14} color="#ffffff" strokeWidth={3} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reviewBtn, styles.reviewBtnDismiss]}
              onPress={(e) => {
                e.stopPropagation?.();
                onCommitmentDismiss?.(task.id);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <X size={14} color="#ffffff" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isCommitment && enrichModalVisible && (task as any).user_id && (
        <CommitmentEnrichmentModal
          visible={enrichModalVisible}
          commitment={{
            id: task.id,
            title: task.title,
            user_id: (task as any).user_id,
            is_urgent: task.is_urgent ?? false,
            is_important: task.is_important ?? false,
            external_recurrence_id: (task as any).external_recurrence_id ?? null,
          }}
          initialTab={enrichTab}
          onClose={() => setEnrichModalVisible(false)}
          onEnrichmentChange={() => {
            setEnrichModalVisible(false);
            onCommitmentComplete?.(task.id);
          }}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  eventContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderLeftWidth: 4,
    borderWidth: 2,
    padding: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  taskContainer: {
    borderLeftWidth: 3,
    borderStyle: 'solid',
  },
  completedContainer: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  eventContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 16,
    marginBottom: 2,
    flex: 1,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  eventTime: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  noTimeTaskContainer: {
    backgroundColor: '#f3f4f6',
    opacity: 0.9,
  },
  noTimeTaskTitle: {
    fontSize: 11,
    color: '#4b5563',
  },
  noTimeLabel: {
    fontSize: 9,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  completedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  reviewBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnComplete: {
    backgroundColor: '#16a34a',
  },
  reviewBtnDismiss: {
    backgroundColor: '#dc2626',
  },
  enrichmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  enrichBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  enrichSpacer: {
    flex: 1,
  },
  enrichDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
});
