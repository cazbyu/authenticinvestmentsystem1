import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { PriorityQuadrant } from './PriorityQuadrant';
import { Task } from '../tasks/TaskCard';
import { formatTimeForDisplay } from '@/lib/dateUtils';
import { X } from 'lucide-react-native';

interface MonthlyCalendarGridProps {
  currentDate: Date;
  tasks: Task[];
  onDayPress: (date: Date) => void;
}

interface DayTasksModalProps {
  visible: boolean;
  date: Date;
  tasks: Task[];
  onClose: () => void;
}

const DayTasksModal = ({ visible, date, tasks, onClose }: DayTasksModalProps) => {
  const sortedTasks = [...tasks].sort((a, b) => {
    // Sort by start_time if available
    if (a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return 0;
  });

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{dateLabel}</Text>
              <Text style={styles.modalSubtitle}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalTasksList}>
            {sortedTasks.map((task, index) => (
              <View key={`${task.id}-${index}`} style={styles.modalTaskItem}>
                <View style={[styles.taskColorBar, { backgroundColor: task.roleColor || '#0078d4' }]} />
                <View style={styles.taskContent}>
                  {task.start_time && (
                    <Text style={styles.taskTime}>
                      {formatTimeForDisplay(task.start_time)}
                      {task.end_time && ` - ${formatTimeForDisplay(task.end_time)}`}
                    </Text>
                  )}
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.status === 'completed' && (
                    <Text style={styles.taskCompleted}>✓ Completed</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export function MonthlyCalendarGrid({ currentDate, tasks, onDayPress }: MonthlyCalendarGridProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Get the first day of the month
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Get day of week for first day (0 = Sunday)
  const startingDayOfWeek = firstDay.getDay();

  // Calculate total cells needed (days + padding)
  const daysInMonth = lastDay.getDate();
  const totalCells = startingDayOfWeek + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  // Group tasks by date
  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach(task => {
    const taskDate = task.occurrence_date || task.start_date || task.due_date;
    if (taskDate) {
      if (!tasksByDate[taskDate]) {
        tasksByDate[taskDate] = [];
      }
      tasksByDate[taskDate].push(task);
    }
  });

  const handleDayPress = (date: Date, dayTasks: Task[]) => {
    if (dayTasks.length > 0) {
      setSelectedDay(date);
      setSelectedDayTasks(dayTasks);
      setModalVisible(true);
    }
    onDayPress(date);
  };

  const renderDay = (dayNumber: number | null, rowIndex: number, colIndex: number) => {
    if (dayNumber === null) {
      return <View key={`empty-${rowIndex}-${colIndex}`} style={styles.dayCell} />;
    }

    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    const dayTasks = tasksByDate[dateString] || [];

    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    return (
      <TouchableOpacity
        key={`day-${rowIndex}-${colIndex}`}
        style={styles.dayCell}
        onPress={() => handleDayPress(date, dayTasks)}
        activeOpacity={0.7}
      >
        <View style={styles.dayCellContent}>
          <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>
            {dayNumber}
          </Text>
          {dayTasks.length > 0 && (
            <View style={styles.quadrantContainer}>
              <PriorityQuadrant tasks={dayTasks} size="small" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderWeek = (rowIndex: number) => {
    const days: (number | null)[] = [];

    for (let col = 0; col < 7; col++) {
      const cellIndex = rowIndex * 7 + col;
      const dayNumber = cellIndex - startingDayOfWeek + 1;

      if (cellIndex < startingDayOfWeek || dayNumber > daysInMonth) {
        days.push(null);
      } else {
        days.push(dayNumber);
      }
    }

    return (
      <View key={`week-${rowIndex}`} style={styles.weekRow}>
        {days.map((day, colIndex) => renderDay(day, rowIndex, colIndex))}
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        {/* Day headers */}
        <View style={styles.headerRow}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
            <View key={day} style={styles.headerCell}>
              <Text style={styles.headerText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {Array.from({ length: rows }, (_, i) => renderWeek(i))}
        </View>
      </View>

      <DayTasksModal
        visible={modalVisible}
        date={selectedDay || new Date()}
        tasks={selectedDayTasks}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  headerCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  grid: {
    backgroundColor: '#ffffff',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  dayCellContent: {
    flex: 1,
    padding: 4,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  todayNumber: {
    color: '#0078d4',
    fontWeight: '700',
  },
  quadrantContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styles
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
  },
  taskCompleted: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '500',
  },
});
