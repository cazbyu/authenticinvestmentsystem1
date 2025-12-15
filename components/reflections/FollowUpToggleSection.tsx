import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import { TimePickerDropdown } from '../tasks/TimePickerDropdown';

interface FollowUpToggleSectionProps {
  enabled: boolean;
  date: string;
  time: string;
  isAnytime: boolean;
  onToggle: (enabled: boolean) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onAnytimeChange: (isAnytime: boolean) => void;
}

export default function FollowUpToggleSection({
  enabled,
  date,
  time,
  isAnytime,
  onToggle,
  onDateChange,
  onTimeChange,
  onAnytimeChange,
}: FollowUpToggleSectionProps) {
  const { colors, isDarkMode } = useTheme();
  const [showCalendar, setShowCalendar] = useState(false);

  const getInitialDefaultTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes + 15);
    now.setSeconds(0);
    now.setMilliseconds(0);
    const hours = now.getHours();
    const mins = now.getMinutes();
    const isPM = hours >= 12;
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${isPM ? 'pm' : 'am'}`;
  };

  const formatDisplayDate = (dateString: string) => {
    const d = parseLocalDate(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleToggle = (newEnabled: boolean) => {
    onToggle(newEnabled);
  };

  const handleAnytimeToggle = (newIsAnytime: boolean) => {
    onAnytimeChange(newIsAnytime);
    if (!newIsAnytime && !time) {
      onTimeChange(getInitialDefaultTime());
    } else if (newIsAnytime) {
      onTimeChange('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={[styles.label, { color: colors.text }]}>Follow Up</Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      {enabled && (
        <View style={styles.pickerContainer}>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateField}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Date</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowCalendar(true)}
              >
                <CalendarIcon size={18} color={colors.text} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatDisplayDate(date)}
                </Text>
              </TouchableOpacity>
            </View>

            {!isAnytime && (
              <View style={styles.timeField}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Time</Text>
                <TimePickerDropdown
                  value={time}
                  onChange={onTimeChange}
                  colors={colors}
                />
              </View>
            )}

            <View style={styles.anytimeField}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Anytime</Text>
              <Switch
                value={isAnytime}
                onValueChange={handleAnytimeToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <Text style={[styles.selectedInfo, { color: colors.textSecondary }]}>
            Follow up on {formatDisplayDate(date)}{!isAnytime && time ? ` at ${time}` : ''}
          </Text>
        </View>
      )}

      <Modal visible={showCalendar} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Follow-Up Date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Text style={[styles.closeButton, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Calendar
              current={date}
              minDate={formatLocalDate(new Date())}
              onDayPress={(day) => {
                onDateChange(day.dateString);
                setShowCalendar(false);
              }}
              markedDates={{
                [date]: { selected: true, selectedColor: colors.primary }
              }}
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.text,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary,
                arrowColor: colors.primary,
                monthTextColor: colors.text,
                indicatorColor: colors.primary,
                textDayFontWeight: '400',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '400',
                textDayFontSize: 16,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    marginTop: 12,
    gap: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  dateField: {
    width: 150,
    gap: 6,
  },
  timeField: {
    width: 150,
    gap: 6,
  },
  anytimeField: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateText: {
    fontSize: 15,
  },
  selectedInfo: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
});
