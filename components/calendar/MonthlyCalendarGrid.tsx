import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { PriorityQuadrant } from './PriorityQuadrant';
import { Task } from '../tasks/TaskCard';
import { formatTimeForDisplay, formatLocalDate } from '@/lib/dateUtils';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';

interface MonthlyCalendarGridProps {
  currentDate: Date;
  tasks: Task[];
  onDayPress: (date: Date) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  holidays?: Array<{ date: string; name: string; color?: string }>;
}

interface DayTasksModalProps {
  visible: boolean;
  date: Date;
  tasks: Task[];
  onClose: () => void;
}

const DayTasksModal = ({ visible, date, tasks, onClose }: DayTasksModalProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 600;

  const sortedTasks = [...tasks].sort((a, b) => {
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
            <View>
              <Text style={styles.modalTitle}>{dateLabel}</Text>
              <Text style={styles.modalSubtitle}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={[styles.modalBody, isMobile && styles.modalBodyMobile]}>
            <ScrollView style={[styles.modalTasksList, isMobile && styles.modalTasksListMobile]}>
              {sortedTasks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No tasks for this day</Text>
                </View>
              ) : (
                sortedTasks.map((task, index) => {
                const priorityColor = task.is_urgent && task.is_important ? '#ef4444' :
                                     !task.is_urgent && task.is_important ? '#22c55e' :
                                     task.is_urgent && !task.is_important ? '#f59e0b' : '#9ca3af';
                return (
                  <View key={`${task.id}-${index}`} style={[styles.modalTaskItem, task.status === 'completed' && styles.completedTaskItem]}>
                    <View style={[styles.taskColorBar, { backgroundColor: priorityColor }]} />
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
                      </View>
                    </View>
                  </View>
                );
              }))}
            </ScrollView>

            <View style={[styles.quadrantSection, isMobile && styles.quadrantSectionMobile]}>
              <Text style={styles.quadrantSectionTitle}>Priority Matrix</Text>
              <View style={styles.quadrantContainer}>
                <PriorityQuadrant
                  tasks={tasks}
                  size="large"
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export function MonthlyCalendarGrid({ currentDate, tasks, onDayPress, onNavigate, holidays = [] }: MonthlyCalendarGridProps) {
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
    setSelectedDay(date);
    setSelectedDayTasks(dayTasks);
    setModalVisible(true);
    onDayPress(date);
  };

  const renderDay = (dayNumber: number | null, rowIndex: number, colIndex: number) => {
    if (dayNumber === null) {
      return <View key={`empty-${rowIndex}-${colIndex}`} style={styles.dayCell} />;
    }

    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
    // Use formatLocalDate to avoid UTC timezone conversion that shifts dates
    const dateString = formatLocalDate(date);
    const dayTasks = tasksByDate[dateString] || [];
    const dayHoliday = holidays.find(h => h.date === dateString);

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
          {dayHoliday && (
            <View style={[styles.holidayBar, { backgroundColor: dayHoliday.color || '#ef4444' }]} />
          )}
          <View style={[styles.dayNumberContainer, isToday && styles.todayCircle]}>
            <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>
              {dayNumber}
            </Text>
          </View>
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

  // Calculate completed tasks for the current month for the quadrant
  // Filter to only tasks completed within the current month (00:00:01 on day 1 to 23:59:59 on last day)
  // Note: completed_at is stored in UTC but we need to compare in local timezone
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

  const allMonthTasks = Object.values(tasksByDate).flat();
  const completedThisMonth = allMonthTasks.filter(task => {
    if (task.status !== 'completed' || !task.completed_at) return false;
    // Parse the UTC timestamp and convert to local timezone
    const completedDate = new Date(task.completed_at);
    return completedDate >= monthStart && completedDate <= monthEnd;
  });

  return (
    <>
      {/* Monthly Subheader with Navigation and Quadrant */}
      <View style={styles.monthlySubheader}>
        <View style={styles.navigationSection}>
          {onNavigate && (
            <>
              <TouchableOpacity onPress={() => onNavigate('prev')} style={styles.navButton}>
                <ChevronLeft size={20} color="#0078d4" />
              </TouchableOpacity>
              <Text style={styles.monthYearText}>
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => onNavigate('next')} style={styles.navButton}>
                <ChevronRight size={20} color="#0078d4" />
              </TouchableOpacity>
            </>
          )}
        </View>
        <View style={styles.spacer} />
        <PriorityQuadrant
          tasks={completedThisMonth}
          size="medium"
          style={styles.monthlyQuadrant}
        />
      </View>

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
  monthlySubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  navigationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spacer: {
    flex: 1,
  },
  monthlyQuadrant: {
    marginLeft: 'auto',
  },
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
  navButton: {
    padding: 6,
    marginHorizontal: 4,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginHorizontal: 8,
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
    height: 90,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  dayCellContent: {
    flex: 1,
    padding: 4,
    position: 'relative',
  },
  holidayBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  dayNumberContainer: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  todayCircle: {
    backgroundColor: '#0078d4',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  todayNumber: {
    color: '#ffffff',
    fontWeight: '700',
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
    maxWidth: 700,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalBody: {
    flexDirection: 'row',
    flex: 1,
    minHeight: 400,
  },
  modalBodyMobile: {
    flexDirection: 'column',
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
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  modalTasksListMobile: {
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  quadrantSection: {
    padding: 20,
    backgroundColor: '#f9fafb',
    minWidth: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quadrantSectionMobile: {
    minWidth: 'auto',
    width: '100%',
  },
  quadrantSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  quadrantContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
