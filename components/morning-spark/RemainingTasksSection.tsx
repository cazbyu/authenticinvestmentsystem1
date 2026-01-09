import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { CheckSquare, Check, ChevronRight } from 'lucide-react-native';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  points?: number;
  priority?: string;
  is_urgent?: boolean;
}

interface RemainingTasksSectionProps {
  fuelLevel: number | null;
  allTasks: Task[];
  colors: any;
  loadingAllTasks: boolean;
  itemCommitmentStates: Record<string, 'uncommitted' | 'committed' | 'rescheduled'>;
  handleCommitItem: (id: string) => void;
  openRescheduleModal: (item: any) => void;
  getVisibleItems: (items: Task[]) => Task[];
  getCommittedItems: (items: Task[]) => Task[];
  getPriorityColor: (task: Task) => string;
  loadAllTasks: () => void;
  toLocalISOString: (date: Date) => string;
}

export function RemainingTasksSection({
  fuelLevel,
  allTasks,
  colors,
  loadingAllTasks,
  itemCommitmentStates,
  handleCommitItem,
  openRescheduleModal,
  getVisibleItems,
  getCommittedItems,
  getPriorityColor,
  loadAllTasks,
  toLocalISOString,
}: RemainingTasksSectionProps) {
  const [showRemainingTasks, setShowRemainingTasks] = useState(false);

  if (fuelLevel !== 1) return null;

  const renderTaskRow = (task: Task) => {
    const isUrgent = task.is_urgent;
    const isOverdue = task.due_date && task.due_date < toLocalISOString(new Date()).split('T')[0];
    const isCommitted = itemCommitmentStates[task.id] === 'committed';

    return Platform.OS === 'web' ? (
      <View
        key={task.id}
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
          onPress={() => handleCommitItem(task.id)}
        >
          <View style={styles.iconContainer}>
            {isCommitted ? (
              <Check size={20} color="#10B981" strokeWidth={3} />
            ) : (
              <CheckSquare size={16} color={isUrgent ? '#EF4444' : colors.primary} />
            )}
          </View>

          <View style={styles.eventContent}>
            <View style={styles.taskTitleRow}>
              <Text
                style={[
                  styles.eventTitle,
                  { color: getPriorityColor(task) },
                  isCommitted && { fontWeight: '600' }
                ]}
                numberOfLines={1}
              >
                {isCommitted && '✓ '}{task.title}
              </Text>
              {isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>URGENT</Text>
                </View>
              )}
            </View>
            {task.due_date && (
              <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
                {isOverdue && ' (Overdue)'}
              </Text>
            )}
          </View>

          <Text style={[styles.points, { color: '#10B981' }]}>
            +{Math.round(task.points || 3)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.webRescheduleButton, { backgroundColor: colors.background }]}
          onPress={() => openRescheduleModal(task)}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        key={task.id}
        style={[
          styles.eventRow,
          { borderBottomColor: colors.border },
          isCommitted && {
            backgroundColor: '#10B98120',
            borderLeftWidth: 4,
            borderLeftColor: '#10B981'
          }
        ]}
        onPress={() => handleCommitItem(task.id)}
        onLongPress={() => openRescheduleModal(task)}
      >
        <View style={styles.iconContainer}>
          {isCommitted ? (
            <Check size={20} color="#10B981" strokeWidth={3} />
          ) : (
            <CheckSquare size={16} color={isUrgent ? '#EF4444' : colors.primary} />
          )}
        </View>

        <View style={styles.eventContent}>
          <View style={styles.taskTitleRow}>
            <Text
              style={[
                styles.eventTitle,
                { color: getPriorityColor(task) },
                isCommitted && { fontWeight: '600' }
              ]}
              numberOfLines={1}
            >
              {isCommitted && '✓ '}{task.title}
            </Text>
            {isUrgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>URGENT</Text>
              </View>
            )}
          </View>
          {task.due_date && (
            <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
              Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
              {isOverdue && ' (Overdue)'}
            </Text>
          )}
        </View>

        <Text style={[styles.points, { color: '#10B981' }]}>
          +{Math.round(task.points || 3)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (!showRemainingTasks) {
            loadAllTasks();
          }
          setShowRemainingTasks(!showRemainingTasks);
        }}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            📋 Remaining Tasks
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            ({allTasks.length})
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showRemainingTasks ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showRemainingTasks && (
        <>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
            {Platform.OS === 'web'
              ? "Click tasks to commit, or use the action buttons to reschedule."
              : "Tap to commit • Hold to reschedule"}
          </Text>

          {loadingAllTasks ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : allTasks.length === 0 ? (
            <View style={[styles.emptyTasksState, { backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyTasksText, { color: colors.textSecondary }]}>
                No remaining tasks for today
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                {getVisibleItems(allTasks).map((task) => renderTaskRow(task))}
              </View>

              {getCommittedItems(allTasks).length > 0 && (
                <Text style={[styles.commitmentSummary, { color: colors.primary }]}>
                  ✓ {getCommittedItems(allTasks).length} of {getVisibleItems(allTasks).length} tasks committed
                </Text>
              )}
            </>
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
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
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
    marginTop: 12,
  },
  emptyTasksState: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTasksText: {
    fontSize: 14,
    textAlign: 'center',
  },
  commitmentSummary: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});