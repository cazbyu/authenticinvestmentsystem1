/**
 * DateTimePickerModal — Cross-platform date + optional time picker
 *
 * Pure RN implementation (no native date picker dependency).
 * Used by TodaysCommitment dashboard card for rescheduling tasks/events.
 *
 * Props:
 *   visible    – controls modal visibility
 *   mode       – 'task' (date only) or 'event' (date + time)
 *   initialDate – starting date
 *   onConfirm  – (newDate: Date, newTime?: Date) => void
 *   onCancel   – () => void
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { X, Calendar, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

// ── Quick-pick date helpers ─────────────────────────────────────

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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

// ── Props ────────────────────────────────────────────────────────

interface DateTimePickerModalProps {
  visible: boolean;
  /** 'task' = date only, 'event' = date + time */
  mode: 'task' | 'event';
  /** Starting date value */
  initialDate: Date;
  /** Called when user confirms — newTime only provided for 'event' mode */
  onConfirm: (newDate: Date, newTime?: Date) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────

export function DateTimePickerModal({
  visible,
  mode,
  initialDate,
  onConfirm,
  onCancel,
}: DateTimePickerModalProps) {
  const { colors, isDarkMode } = useTheme();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      // Default to tomorrow
      const tomorrow = addDays(new Date(), 1);
      setSelectedDate(initialDate > new Date() ? initialDate : tomorrow);

      const h = initialDate.getHours();
      const m = initialDate.getMinutes();
      setHour(h || 9);
      setMinute(m || 0);
    }
  }, [visible, initialDate]);

  function adjustDate(days: number) {
    setSelectedDate((prev) => addDays(prev, days));
  }

  function adjustHour(delta: number) {
    setHour((prev) => Math.max(0, Math.min(23, prev + delta)));
  }

  function adjustMinute(delta: number) {
    setMinute((prev) => {
      const next = prev + delta;
      if (next >= 60) {
        setHour((h) => Math.min(23, h + 1));
        return 0;
      }
      if (next < 0) {
        setHour((h) => Math.max(0, h - 1));
        return 45;
      }
      return next;
    });
  }

  function handleConfirm() {
    if (mode === 'event') {
      const timeDate = new Date(selectedDate);
      timeDate.setHours(hour, minute, 0, 0);
      onConfirm(selectedDate, timeDate);
    } else {
      onConfirm(selectedDate);
    }
  }

  // Quick-pick dates
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  const nextWeek = addDays(today, 7);

  const quickDates = [
    { label: 'Tomorrow', date: tomorrow },
    { label: formatDate(dayAfter).split(',')[0], date: dayAfter },
    { label: 'Next week', date: nextWeek },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.content,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {mode === 'event' ? 'Reschedule Event' : 'Reschedule Task'}
            </Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Quick-pick chips */}
            <View style={styles.quickPickRow}>
              {quickDates.map((qd, i) => {
                const isActive = isSameDay(selectedDate, qd.date);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.quickChip,
                      isActive
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedDate(qd.date)}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        { color: isActive ? '#FFF' : colors.text },
                      ]}
                    >
                      {qd.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date selector */}
            <View style={styles.pickerSection}>
              <View style={styles.pickerLabel}>
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={[styles.pickerLabelText, { color: colors.textSecondary }]}>
                  Date
                </Text>
              </View>

              <View style={styles.dateControl}>
                <TouchableOpacity
                  style={[styles.adjustBtn, { backgroundColor: colors.surface }]}
                  onPress={() => adjustDate(-1)}
                >
                  <Text style={[styles.adjustBtnText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>

                <View style={[styles.dateDisplay, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {formatDate(selectedDate)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.adjustBtn, { backgroundColor: colors.surface }]}
                  onPress={() => adjustDate(1)}
                >
                  <Text style={[styles.adjustBtnText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Time selector (event mode only) */}
            {mode === 'event' && (
              <View style={styles.pickerSection}>
                <View style={styles.pickerLabel}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.pickerLabelText, { color: colors.textSecondary }]}>
                    Time
                  </Text>
                </View>

                <View style={styles.timeControl}>
                  {/* Hour */}
                  <View style={styles.timeUnit}>
                    <TouchableOpacity
                      style={[styles.adjustBtn, { backgroundColor: colors.surface }]}
                      onPress={() => adjustHour(1)}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                    <View style={[styles.timeDisplay, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.timeText, { color: colors.text }]}>
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adjustBtn, { backgroundColor: colors.surface }]}
                      onPress={() => adjustHour(-1)}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.text }]}>-</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.timeSep, { color: colors.text }]}>:</Text>

                  {/* Minute */}
                  <View style={styles.timeUnit}>
                    <TouchableOpacity
                      style={[styles.adjustBtn, { backgroundColor: colors.surface }]}
                      onPress={() => adjustMinute(15)}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                    <View style={[styles.timeDisplay, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.timeText, { color: colors.text }]}>
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adjustBtn, { backgroundColor: colors.surface }]}
                      onPress={() => adjustMinute(-15)}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.text }]}>-</Text>
                    </TouchableOpacity>
                  </View>

                  {/* AM/PM label */}
                  <Text style={[styles.ampmLabel, { color: colors.textSecondary }]}>
                    {formatTime(hour, minute).split(' ')[1]}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // Quick-pick
  quickPickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Picker section
  pickerSection: {
    marginBottom: 20,
  },
  pickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  pickerLabelText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Date control
  dateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateDisplay: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Time control
  timeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 6,
  },
  timeDisplay: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 56,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeSep: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  ampmLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Adjust buttons
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default DateTimePickerModal;
