import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Calendar, Check, CheckSquare, ChevronRight } from 'lucide-react-native';

interface Event {
  id: string;
  title: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  due_time?: string;
  due_date?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  points?: number;
}

interface ScheduleSectionProps {
  events: Event[];
  overdue?: Event[];
  colors: any;
  formatTimeDisplay: (time: string) => string;
  getScheduleMessage: () => string;
  itemCommitmentStates: Record<string, 'uncommitted' | 'committed' | 'rescheduled'>;
  handleCommitItem: (id: string) => void;
  openRescheduleModal: (item: any) => void;
}

export function ScheduleSection({
  events,
  overdue = [],
  colors,
  formatTimeDisplay,
  getScheduleMessage,
  itemCommitmentStates,
  handleCommitItem,
  openRescheduleModal,
}: ScheduleSectionProps) {
  const [showSchedule, setShowSchedule] = useState(true);

  // Separate events from tasks
  const todayEvents = events.filter(e => e.type === 'event' || !e.type);
  const todayTasks = events.filter(e => e.type === 'task');
  const overdueItems = overdue || [];

  // Get display time for an item: due_time for tasks, start_time for events
  const getDisplayTime = (item: Event) => {
    if (item.type === 'task') return item.due_time || item.start_time;
    return item.start_time;
  };

  // Get priority color for tasks
  const getPriorityColor = (item: Event) => {
    if (item.is_urgent && item.is_important) return '#EF4444'; // red
    if (!item.is_urgent && item.is_important) return '#22c55e'; // green
    if (item.is_urgent && !item.is_important) return '#eab308'; // yellow
    return colors.text;
  };

  const renderEventRow = (event: Event, isOverdueItem = false) => {
    const isCommitted = itemCommitmentStates[event.id] === 'committed';
    const isRescheduled = itemCommitmentStates[event.id] === 'rescheduled';
    const isTask = event.type === 'task';
    const displayTime = getDisplayTime(event);

    if (isRescheduled) return null;

    const icon = isCommitted ? (
      <Check size={20} color="#10B981" strokeWidth={3} />
    ) : isTask ? (
      <CheckSquare size={16} color={event.is_urgent ? '#EF4444' : colors.primary} />
    ) : (
      <Calendar size={16} color={colors.primary} />
    );

    const titleColor = isTask ? getPriorityColor(event) : colors.text;

    const content = (
      <>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.eventContent}>
          <View style={styles.taskTitleRow}>
            <Text style={[
              styles.eventTitle,
              { color: titleColor },
              isCommitted && { fontWeight: '600' }
            ]} numberOfLines={1}>
              {isCommitted && '✓ '}{event.title}
            </Text>
            {isTask && event.is_urgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>URGENT</Text>
              </View>
            )}
          </View>
          {isOverdueItem && event.due_date && (
            <Text style={[styles.eventTime, { color: '#EF4444' }]}>
              Overdue — Due {new Date(event.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          )}
          {!isOverdueItem && displayTime && (
            <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
              {formatTimeDisplay(displayTime)}
              {!isTask && event.end_time && ` - ${formatTimeDisplay(event.end_time)}`}
            </Text>
          )}
        </View>
        <Text style={[styles.points, { color: '#10B981' }]}>
          +{Math.round(event.points || 3)}
        </Text>
      </>
    );

    return Platform.OS === 'web' ? (
      <View
        key={event.id}
        style={[
          styles.eventRow,
          { borderBottomColor: colors.border },
          isCommitted && { backgroundColor: '#10B98120', borderLeftWidth: 4, borderLeftColor: '#10B981' },
          isOverdueItem && !isCommitted && { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
        ]}
      >
        <TouchableOpacity style={styles.webTaskClickArea} onPress={() => handleCommitItem(event.id)}>
          {content}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.webRescheduleButton, { backgroundColor: colors.background }]}
          onPress={() => openRescheduleModal(event)}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        key={event.id}
        style={[
          styles.eventRow,
          { borderBottomColor: colors.border },
          isCommitted && { backgroundColor: '#10B98120', borderLeftWidth: 4, borderLeftColor: '#10B981' },
          isOverdueItem && !isCommitted && { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
        ]}
        onPress={() => handleCommitItem(event.id)}
        onLongPress={() => openRescheduleModal(event)}
      >
        {content}
      </TouchableOpacity>
    );
  };

  const totalCount = todayEvents.length + todayTasks.length + overdueItems.length;

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowSchedule(!showSchedule)}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            📅 Today's Schedule
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            ({totalCount})
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showSchedule ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showSchedule && (
        <>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
            {getScheduleMessage()}
          </Text>

          {totalCount === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your schedule is clear!
              </Text>
            </View>
          ) : (
            <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
              {/* Today's events first */}
              {todayEvents.map((event) => renderEventRow(event))}
              {/* Today's tasks */}
              {todayTasks.map((task) => renderEventRow(task))}
              {/* Overdue items at the bottom */}
              {overdueItems.length > 0 && (
                <View style={[styles.overdueDivider, { borderTopColor: colors.border }]}>
                  <Text style={[styles.overdueDividerText, { color: '#EF4444' }]}>
                    ⚠️ Overdue ({overdueItems.length})
                  </Text>
                </View>
              )}
              {overdueItems.map((item) => renderEventRow(item, true))}
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
    marginTop: 8,
  },
  eventsTable: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 13,
  },
  points: {
    fontSize: 14,
    fontWeight: '600',
  },
  webTaskClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  overdueDivider: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overdueDividerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webRescheduleButton: {
    padding: 8,
    borderRadius: 8,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});