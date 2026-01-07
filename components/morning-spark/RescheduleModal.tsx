import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { X, Calendar, Clock, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface RescheduleModalProps {
  visible: boolean;
  event: {
    id: string;
    title: string;
    start_date: string;
    start_time: string;
    end_time?: string;
  } | null;
  onClose: () => void;
  onReschedule: (eventId: string, newDate: string, newStartTime: string, newEndTime: string | null) => Promise<void>;
}

export function RescheduleModal({
  visible,
  event,
  onClose,
  onReschedule,
}: RescheduleModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (event && visible) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow);

      if (event.start_time) {
        const [hours, minutes] = event.start_time.split(':');
        setStartHour(parseInt(hours, 10));
        setStartMinute(parseInt(minutes, 10));
      }

      if (event.end_time) {
        const [hours, minutes] = event.end_time.split(':');
        setEndHour(parseInt(hours, 10));
        setEndMinute(parseInt(minutes, 10));
      }
    }
  }, [event, visible]);

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTime(hour: number, minute: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${ampm}`;
  }

  function timeToString(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  function dateToString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function adjustDate(days: number) {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  }

  function adjustTime(
    type: 'start' | 'end',
    unit: 'hour' | 'minute',
    delta: number
  ) {
    if (type === 'start') {
      if (unit === 'hour') {
        setStartHour((prev) => Math.max(0, Math.min(23, prev + delta)));
      } else {
        setStartMinute((prev) => {
          const newMinute = prev + delta;
          if (newMinute >= 60) {
            setStartHour((h) => Math.min(23, h + 1));
            return 0;
          }
          if (newMinute < 0) {
            setStartHour((h) => Math.max(0, h - 1));
            return 45;
          }
          return newMinute;
        });
      }
    } else {
      if (unit === 'hour') {
        setEndHour((prev) => Math.max(0, Math.min(23, prev + delta)));
      } else {
        setEndMinute((prev) => {
          const newMinute = prev + delta;
          if (newMinute >= 60) {
            setEndHour((h) => Math.min(23, h + 1));
            return 0;
          }
          if (newMinute < 0) {
            setEndHour((h) => Math.max(0, h - 1));
            return 45;
          }
          return newMinute;
        });
      }
    }
  }

  async function handleSave() {
    if (!event) return;

    try {
      setSaving(true);
      await onReschedule(
        event.id,
        dateToString(selectedDate),
        timeToString(startHour, startMinute),
        event.end_time ? timeToString(endHour, endMinute) : null
      );
      onClose();
    } catch (error) {
      console.error('Error rescheduling:', error);
    } finally {
      setSaving(false);
    }
  }

  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Reschedule Event
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              disabled={saving}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>
              {event.title}
            </Text>

            <View style={styles.pickerSection}>
              <View style={styles.pickerLabel}>
                <Calendar size={18} color={colors.textSecondary} />
                <Text style={[styles.pickerLabelText, { color: colors.textSecondary }]}>
                  New Date
                </Text>
              </View>

              <View style={styles.dateControl}>
                <TouchableOpacity
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustDate(-1)}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>

                <View style={[styles.dateDisplay, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {formatDate(selectedDate)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustDate(1)}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pickerSection}>
              <View style={styles.pickerLabel}>
                <Clock size={18} color={colors.textSecondary} />
                <Text style={[styles.pickerLabelText, { color: colors.textSecondary }]}>
                  Start Time
                </Text>
              </View>

              <View style={styles.timeControl}>
                <View style={styles.timeUnit}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => adjustTime('start', 'hour', 1)}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                  <View style={[styles.timeDisplay, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {startHour.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => adjustTime('start', 'hour', -1)}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>

                <View style={styles.timeUnit}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => adjustTime('start', 'minute', 15)}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                  <View style={[styles.timeDisplay, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {startMinute.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => adjustTime('start', 'minute', -15)}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.timePreview, { color: colors.textSecondary }]}>
                  {formatTime(startHour, startMinute)}
                </Text>
              </View>
            </View>

            {event.end_time && (
              <View style={styles.pickerSection}>
                <View style={styles.pickerLabel}>
                  <Clock size={18} color={colors.textSecondary} />
                  <Text style={[styles.pickerLabelText, { color: colors.textSecondary }]}>
                    End Time
                  </Text>
                </View>

                <View style={styles.timeControl}>
                  <View style={styles.timeUnit}>
                    <TouchableOpacity
                      style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                      onPress={() => adjustTime('end', 'hour', 1)}
                    >
                      <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                    <View style={[styles.timeDisplay, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.timeText, { color: colors.text }]}>
                        {endHour.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                      onPress={() => adjustTime('end', 'hour', -1)}
                    >
                      <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>

                  <View style={styles.timeUnit}>
                    <TouchableOpacity
                      style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                      onPress={() => adjustTime('end', 'minute', 15)}
                    >
                      <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                    <View style={[styles.timeDisplay, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.timeText, { color: colors.text }]}>
                        {endMinute.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                      onPress={() => adjustTime('end', 'minute', -15)}
                    >
                      <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.timePreview, { color: colors.textSecondary }]}>
                    {formatTime(endHour, endMinute)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { backgroundColor: colors.surface },
              ]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.updateButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.updateButtonText}>
                {saving ? 'Updating...' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  pickerSection: {
    marginBottom: 20,
  },
  pickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pickerLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateDisplay: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adjustButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  timeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 8,
  },
  timeDisplay: {
    width: 50,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 4,
  },
  timePreview: {
    fontSize: 13,
    marginLeft: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
