import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, InteractionManager } from 'react-native';
import { Task } from '../tasks/TaskCard';
import { CalendarEventDisplay } from './CalendarEventDisplay';
import { formatLocalDate, parseTimeString } from '@/lib/dateUtils';

const MINUTE_HEIGHT = 0.75;
const HOUR_HEIGHT = 60 * MINUTE_HEIGHT;
const TIME_COLUMN_WIDTH = 70;
const COLUMN_GUTTER = 4;

interface WeeklyTimeGridProps {
  weekDates: Date[];
  tasksByDate: Record<string, Task[]>;
  onCompleteTask: (taskId: string) => void;
  onTaskPress: (task: Task) => void;
  shouldScrollToNow?: boolean;
}

const getTimeInMinutes = (timeString: string) => {
  const parsed = parseTimeString(timeString);
  if (!parsed) return 0;
  return parsed.hours * 60 + parsed.minutes;
};

const calculateEventLayout = (events: Task[]) => {
  if (events.length === 0) return [];

  const sortedEvents = [...events].sort((a, b) => {
    const aStart = getTimeInMinutes(a.start_time!);
    const bStart = getTimeInMinutes(b.start_time!);
    return aStart - bStart;
  });

  const eventsWithLayout = sortedEvents.map(event => ({
    ...event,
    startMinutes: getTimeInMinutes(event.start_time!),
    endMinutes: getTimeInMinutes(event.end_time!),
    column: 0,
    maxColumns: 1,
  }));

  const columns: number[] = [];

  for (const event of eventsWithLayout) {
    let assignedColumn = -1;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] <= event.startMinutes) {
        assignedColumn = i;
        break;
      }
    }

    if (assignedColumn === -1) {
      assignedColumn = columns.length;
      columns.push(event.endMinutes);
    } else {
      columns[assignedColumn] = event.endMinutes;
    }

    event.column = assignedColumn;
  }

  for (const event of eventsWithLayout) {
    let maxOverlaps = 1;
    const overlappingEvents = eventsWithLayout.filter(other =>
      other !== event &&
      other.startMinutes < event.endMinutes &&
      other.endMinutes > event.startMinutes
    );
    const allOverlappingEvents = [event, ...overlappingEvents];
    maxOverlaps = Math.max(...allOverlappingEvents.map(e => e.column)) + 1;
    event.maxColumns = maxOverlaps;
  }

  return eventsWithLayout;
};

const WeeklyTimeGridComponent = ({
  weekDates,
  tasksByDate,
  onCompleteTask,
  onTaskPress,
  shouldScrollToNow = false,
}: WeeklyTimeGridProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const [columnWidth, setColumnWidth] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [currentTimeString, setCurrentTimeString] = useState('');
  const [viewportH, setViewportH] = useState(0);
  const [hasScrolledToNow, setHasScrolledToNow] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const availableWidth = screenWidth - TIME_COLUMN_WIDTH - 32;
  const calculatedColumnWidth = availableWidth / 7;

  const today = formatLocalDate(new Date());
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      setCurrentTimePosition(totalMinutes * MINUTE_HEIGHT);
      setCurrentTimeString(now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }));
    };

    updateCurrentTime();
    const timeInterval = setInterval(updateCurrentTime, 60000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (hasScrolledToNow) return;
    if (!scrollRef.current || viewportH <= 0) return;

    const contentH = 24 * 60 * MINUTE_HEIGHT;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const currentTimeY = minutes * MINUTE_HEIGHT;

    let targetY = currentTimeY - viewportH / 2;
    if (targetY < 0) targetY = 0;
    if (targetY > contentH - viewportH) targetY = Math.max(0, contentH - viewportH);

    const cancel = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: targetY, animated: false });
        setHasScrolledToNow(true);
      });
    });

    return () => cancel && (cancel as any).done === false && (cancel as any).cancel?.();
  }, [viewportH, hasScrolledToNow]);

  useEffect(() => {
    setHasScrolledToNow(false);
  }, [shouldScrollToNow]);

  const eventsByDateAndColumn = useMemo(() => {
    const result: Record<string, any[]> = {};
    weekDates.forEach(date => {
      const dateStr = formatLocalDate(date);
      const dayTasks = tasksByDate[dateStr] || [];

      const timedEvents = dayTasks.filter(task => task.start_time && task.end_time && !task.is_all_day);
      const noTimeItems = dayTasks.filter(task => !task.is_all_day && !task.is_anytime && (!task.start_time || !task.end_time));

      const noTimeItemsAsMidnight = noTimeItems.map(task => ({
        ...task,
        start_time: '00:00:00',
        end_time: '00:15:00',
        isNoTimeTask: true,
      }));

      const allTimedEvents = [...timedEvents, ...noTimeItemsAsMidnight];
      result[dateStr] = calculateEventLayout(allTimedEvents);
    });
    return result;
  }, [weekDates, tasksByDate]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        style={styles.scrollView}
        showsVerticalScrollIndicator
        horizontal={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={styles.horizontalScroll}
        >
          <View style={styles.gridContainer}>
            <View style={styles.timeGridRow}>
              <View style={[styles.timeColumn, { width: TIME_COLUMN_WIDTH }]}>
                {hours.map(hour => (
                  <View key={hour} style={[styles.timeSlot, { height: HOUR_HEIGHT }]}>
                    <Text style={styles.timeLabel}>
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </Text>
                  </View>
                ))}
              </View>

              {weekDates.map((date, dayIndex) => {
                const dateStr = formatLocalDate(date);
                const isToday = dateStr === today;
                const eventsForDay = eventsByDateAndColumn[dateStr] || [];

                return (
                  <View key={dayIndex} style={[styles.dayColumn, { width: calculatedColumnWidth }]}>
                    <View style={[styles.timeGrid, { height: 24 * HOUR_HEIGHT }]}>
                      {hours.map(hour => (
                        <View key={hour} style={[styles.hourSlot, { height: HOUR_HEIGHT }]}>
                          <View style={styles.hourLine} />
                          <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.25 }]} />
                          <View style={[styles.halfHourLine, { top: HOUR_HEIGHT * 0.5 }]} />
                          <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.75 }]} />
                        </View>
                      ))}

                      {eventsForDay.map((event, idx) => {
                        const top = event.startMinutes * MINUTE_HEIGHT;
                        const heightPx = Math.max((event.endMinutes - event.startMinutes) * MINUTE_HEIGHT, 30);
                        const availableColWidth = calculatedColumnWidth - 8;
                        const colWidth = (availableColWidth - (event.maxColumns - 1) * COLUMN_GUTTER) / event.maxColumns;
                        const leftOffset = event.column * (colWidth + COLUMN_GUTTER);

                        return (
                          <CalendarEventDisplay
                            key={`${event.id}-${dateStr}-${idx}`}
                            task={event}
                            onPress={onTaskPress}
                            style={{
                              position: 'absolute',
                              top,
                              height: heightPx,
                              left: 4 + leftOffset,
                              width: colWidth,
                              zIndex: 1,
                            }}
                          />
                        );
                      })}

                      {isToday && (
                        <View style={[styles.currentTimeLine, { top: currentTimePosition }]}>
                          <View style={styles.currentTimeDot} />
                          <View style={styles.currentTimeLineBar} />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

export const WeeklyTimeGrid = memo(WeeklyTimeGridComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  horizontalScroll: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'column',
  },
  timeGridRow: {
    flexDirection: 'row',
    minHeight: 24 * HOUR_HEIGHT,
  },
  timeColumn: {
    backgroundColor: '#f9fafb',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  timeSlot: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timeLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: -6,
  },
  dayColumn: {
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    position: 'relative',
  },
  timeGrid: {
    position: 'relative',
  },
  hourSlot: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  quarterHourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#f3f4f6',
    opacity: 0.5,
  },
  halfHourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#e5e7eb',
    opacity: 0.7,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginLeft: -4,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#dc2626',
  },
});
