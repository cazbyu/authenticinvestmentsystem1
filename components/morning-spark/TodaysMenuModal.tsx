import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { X, Calendar, CheckSquare } from 'lucide-react-native';

interface Event {
  id: string;
  title: string;
  start_time?: string;
  points?: number;
}

interface Task {
  id: string;
  title: string;
  points?: number;
  priority?: string;
}

interface TodaysMenuModalProps {
  visible: boolean;
  onClose: () => void;
  fuelLevel: 1 | 2 | 3;
  events: Event[];
  tasks: Task[];
  reflections: {
    commitReflection: boolean;
    commitRose: boolean;
    commitThorn: boolean;
  };
  formatTimeDisplay: (time: string) => string;
  colors: any;
}

const FUEL_MESSAGES = {
  1: "Although you may not be feeling it right now, you got this. Recovery days are great for reflection and realignment. Think about something unique that you are thankful for and write it down. If you find some extra energy, take a peak at your Mission and 5 Year Vision Statements. At the end of the day, direction matters.",
  2: "Consistency is the father of destiny. Pace yourself toward your commitment, remember to reflect, look out for a small blessing today, and take time to write down a thorn (something that may be hard or an unexpected obstacle) - paying attention to those offer opportunities for growth.",
  3: "You're feeling it! Let's push it today, but keep enough in the tank to maintain or slightly increase your day-to-day pace and remember direction is more important than speed. The faster you run in the wrong direction, the faster you get to the wrong place. Pause to reflect, be grateful and learn from obstacles along your journey.",
};

export function TodaysMenuModal({
  visible,
  onClose,
  fuelLevel,
  events,
  tasks,
  reflections,
  formatTimeDisplay,
  colors,
}: TodaysMenuModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop - tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Modal content - stop propagation so tapping inside doesn't close */}
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Header with close button */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                Today's Menu
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Inspirational Message */}
              <Text style={[styles.inspirationalMessage, { color: colors.textSecondary }]}>
                {FUEL_MESSAGES[fuelLevel]}
              </Text>

              {/* Events Section */}
              {events.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    EVENTS ({events.length})
                  </Text>
                  {events.map((event) => (
                    <View
                      key={event.id}
                      style={[styles.item, { borderBottomColor: colors.border }]}
                    >
                      <Calendar size={16} color={colors.primary} />
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>
                          {event.title}
                        </Text>
                        {event.start_time && (
                          <Text style={[styles.itemTime, { color: colors.textSecondary }]}>
                            {formatTimeDisplay(event.start_time)}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.itemPoints, { color: '#10B981' }]}>
                        +{event.points || 3}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Tasks Section */}
              {tasks.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    TASKS ({tasks.length})
                  </Text>
                  {tasks.map((task) => (
                    <View
                      key={task.id}
                      style={[styles.item, { borderBottomColor: colors.border }]}
                    >
                      <CheckSquare size={16} color={colors.primary} />
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>
                          {task.title}
                        </Text>
                      </View>
                      <Text style={[styles.itemPoints, { color: '#10B981' }]}>
                        +{task.points || 3}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Reflections Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  REFLECTIONS
                </Text>
                
                {reflections.commitReflection && (
                  <View style={[styles.item, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.reflectionText, { color: colors.text }]}>
                      ✓ Add a Reflection
                    </Text>
                    <Text style={[styles.itemPoints, { color: '#10B981' }]}>+1</Text>
                  </View>
                )}

                {reflections.commitRose && (
                  <View style={[styles.item, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.reflectionText, { color: colors.text }]}>
                      ✓ Add a Rose
                    </Text>
                    <Text style={[styles.itemPoints, { color: '#10B981' }]}>+2</Text>
                  </View>
                )}

                {reflections.commitThorn && (
                  <View style={[styles.item, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.reflectionText, { color: colors.text }]}>
                      ✓ Add a Thorn
                    </Text>
                    <Text style={[styles.itemPoints, { color: '#10B981' }]}>+1</Text>
                  </View>
                )}

                {!reflections.commitReflection && !reflections.commitRose && !reflections.commitThorn && (
                  <Text style={[styles.noReflections, { color: colors.textSecondary }]}>
                    No reflections committed
                  </Text>
                )}
              </View>

              {/* Bottom spacing */}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  modalContent: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    padding: 20,
  },
  inspirationalMessage: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemTime: {
    fontSize: 13,
  },
  itemPoints: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  reflectionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  noReflections: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});