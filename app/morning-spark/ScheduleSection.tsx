import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Calendar, Check, ChevronRight } from 'lucide-react-native';

interface Event {
  id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  points?: number;
}

interface ScheduleSectionProps {
  events: Event[];
  colors: any;
  formatTimeDisplay: (time: string) => string;
  getScheduleMessage: () => string;
  itemCommitmentStates: Record<string, 'uncommitted' | 'committed' | 'rescheduled'>;
  handleCommitItem: (id: string) => void;
  openRescheduleModal: (item: any) => void;
}

export function ScheduleSection({
  events,
  colors,
  formatTimeDisplay,
  getScheduleMessage,
  itemCommitmentStates,
  handleCommitItem,
  openRescheduleModal,
}: ScheduleSectionProps) {
  const [showSchedule, setShowSchedule] = useState(false);

  const renderEventRow = (event: Event) => {
    const isCommitted = itemCommitmentStates[event.id] === 'committed';
    const isRescheduled = itemCommitmentStates[event.id] === 'rescheduled';
    
    if (isRescheduled) return null;

    return Platform.OS === 'web' ? (
      <View
        key={event.id}
        style={[
          styles.eventRow,
          { borderBottomColor: colors.border },
          isCommitted && { 
            backgroundColor: '#10B98120',
            borderLeftWidth: 4,
            borderLeftColor: '#10B981'
          }
        ]}
      >
        <TouchableOpacity
          style={styles.webTaskClickArea}
          onPress={() => handleCommitItem(event.id)}
        >
          <View style={styles.iconContainer}>
            {isCommitted ? (
              <Check size={20} color="#10B981" strokeWidth={3} />
            ) : (
              <Calendar size={16} color={colors.primary} />
            )}
          </View>

          <View style={styles.eventContent}>
            <Text style={[
              styles.eventTitle, 
              { color: colors.text },
              isCommitted && { fontWeight: '600' }
            ]} numberOfLines={1}>
              {isCommitted && '✓ '}{event.title}
            </Text>
            {event.start_time && (
              <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                {formatTimeDisplay(event.start_time)}
                {event.end_time && ` - ${formatTimeDisplay(event.end_time)}`}
              </Text>
            )}
          </View>

          <Text style={[styles.points, { color: '#10B981' }]}>
            +{Math.round(event.points || 3)}
          </Text>
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
          isCommitted && { 
            backgroundColor: '#10B98120',
            borderLeftWidth: 4,
            borderLeftColor: '#10B981'
          }
        ]}
        onPress={() => handleCommitItem(event.id)}
        onLongPress={() => openRescheduleModal(event)}
      >
        <View style={styles.iconContainer}>
          {isCommitted ? (
            <Check size={20} color="#10B981" strokeWidth={3} />
          ) : (
            <Calendar size={16} color={colors.primary} />
          )}
        </View>

        <View style={styles.eventContent}>
          <Text style={[
            styles.eventTitle, 
            { color: colors.text },
            isCommitted && { fontWeight: '600' }
          ]} numberOfLines={1}>
            {isCommitted && '✓ '}{event.title}
          </Text>
          {event.start_time && (
            <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
              {formatTimeDisplay(event.start_time)}
              {event.end_time && ` - ${formatTimeDisplay(event.end_time)}`}
            </Text>
          )}
        </View>

        <Text style={[styles.points, { color: '#10B981' }]}>
          +{Math.round(event.points || 3)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowSchedule(!showSchedule)}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            📅 Your Schedule Today
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            ({events.length})
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

          {events.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your schedule is clear!
              </Text>
            </View>
          ) : (
            <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
              {events.map((event) => renderEventRow(event))}
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