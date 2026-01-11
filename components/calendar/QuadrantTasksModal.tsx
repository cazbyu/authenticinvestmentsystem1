import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Task } from '../tasks/TaskCard';
import { formatTimeForDisplay } from '@/lib/dateUtils';
import { X } from 'lucide-react-native';

interface QuadrantTasksModalProps {
  visible: boolean;
  quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  tasks: Task[];
  onClose: () => void;
}

const QUADRANT_INFO = {
  Q1: {
    title: 'Urgent & Important',
    color: '#ef4444',
    description: 'Do First'
  },
  Q2: {
    title: 'Not Urgent & Important',
    color: '#22c55e',
    description: 'Schedule'
  },
  Q3: {
    title: 'Urgent & Not Important',
    color: '#f59e0b',
    description: 'Delegate'
  },
  Q4: {
    title: 'Not Urgent & Not Important',
    color: '#9ca3af',
    description: 'Eliminate'
  }
};

export function QuadrantTasksModal({ visible, quadrant, tasks, onClose }: QuadrantTasksModalProps) {
  const info = QUADRANT_INFO[quadrant];

  // Filter to only show pending tasks (exclude completed)
  const pendingTasks = tasks.filter(task => task.status !== 'completed');

  const sortedTasks = [...pendingTasks].sort((a, b) => {
    const aCompleted = a.status === 'completed' ? 1 : 0;
    const bCompleted = b.status === 'completed' ? 1 : 0;
    if (aCompleted !== bCompleted) {
      return aCompleted - bCompleted;
    }
    if (a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return 0;
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContent}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.quadrantIndicator, { backgroundColor: info.color }]} />
              <View>
                <Text style={styles.modalTitle}>{info.title}</Text>
                <Text style={styles.modalSubtitle}>{info.description} • {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalTasksList}>
            {sortedTasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No tasks in this quadrant</Text>
              </View>
            ) : (
              sortedTasks.map((task, index) => (
                <View key={`${task.id}-${index}`} style={[styles.modalTaskItem, task.status === 'completed' && styles.completedTaskItem]}>
                  <View style={[styles.taskColorBar, { backgroundColor: info.color }]} />
                  <View style={styles.taskContent}>
                    {task.start_time && (
                      <Text style={[styles.taskTime, task.status === 'completed' && styles.completedText]}>
                        {formatTimeForDisplay(task.start_time)}
                        {task.end_time && ` - ${formatTimeForDisplay(task.end_time)}`}
                      </Text>
                    )}
                    <Text style={[styles.taskTitle, task.status === 'completed' && styles.completedText]}>{task.title}</Text>
                    <View style={styles.taskMetadata}>
                      {task.status === 'completed' ? (
                        <Text style={styles.taskCompleted}>✓ Completed</Text>
                      ) : (
                        <Text style={styles.taskPending}>Pending</Text>
                      )}
                      {task.is_anytime && (
                        <Text style={styles.taskAnytime}> • Anytime</Text>
                      )}
                      {task.is_all_day && (
                        <Text style={styles.taskAllDay}> • All Day</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  quadrantIndicator: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  modalTasksList: {
    maxHeight: 400,
  },
  modalTaskItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  completedTaskItem: {
    backgroundColor: '#f9fafb',
  },
  taskColorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0078d4',
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  completedText: {
    opacity: 0.6,
  },
  taskMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  taskCompleted: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  taskPending: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  taskAnytime: {
    fontSize: 12,
    color: '#f59e0b',
  },
  taskAllDay: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
