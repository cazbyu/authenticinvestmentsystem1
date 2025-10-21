import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Calendar } from 'react-native-calendars';
import { formatLocalDate } from '@/lib/dateUtils';

interface CustomRecurrenceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (rule: string, endDate: string | null) => void;
  startDate: string;
  initialRule?: string;
  initialEndDate?: string | null;
}

type FrequencyUnit = 'day' | 'week' | 'month' | 'year';
type EndType = 'never' | 'on' | 'after';

export function CustomRecurrenceModal({
  visible,
  onClose,
  onSave,
  startDate,
  initialRule,
  initialEndDate
}: CustomRecurrenceModalProps) {
  const { colors } = useTheme();

  const [interval, setInterval] = useState(1);
  const [frequency, setFrequency] = useState<FrequencyUnit>('week');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthlyType, setMonthlyType] = useState<'date' | 'weekday'>('date');
  const [endType, setEndType] = useState<EndType>('after');
  const [endDate, setEndDate] = useState('');
  const [occurrences, setOccurrences] = useState('12');
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showMonthlyPicker, setShowMonthlyPicker] = useState(false);
  const [showOccurrencesPicker, setShowOccurrencesPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible && startDate) {
      const date = new Date(startDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      const dayCode = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek];
      setSelectedDays([dayCode]);

      if (initialEndDate) {
        const tenYearsLater = new Date(date);
        tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
        setEndDate(formatLocalDate(tenYearsLater));
      }
    }
  }, [visible, startDate]);

  const dayButtons = [
    { code: 'S', full: 'SU', label: 'Sunday' },
    { code: 'M', full: 'MO', label: 'Monday' },
    { code: 'T', full: 'TU', label: 'Tuesday' },
    { code: 'W', full: 'WE', label: 'Wednesday' },
    { code: 'T', full: 'TH', label: 'Thursday' },
    { code: 'F', full: 'FR', label: 'Friday' },
    { code: 'S', full: 'SA', label: 'Saturday' },
  ];

  const handleDayToggle = (dayCode: string) => {
    setSelectedDays(prev =>
      prev.includes(dayCode)
        ? prev.filter(d => d !== dayCode)
        : [...prev, dayCode]
    );
  };

  const getMonthlyOptions = () => {
    if (!startDate) return [];

    const date = new Date(startDate + 'T00:00:00');
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    const weekOfMonth = Math.ceil(dayOfMonth / 7);
    const ordinals = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
    const ordinal = ordinals[weekOfMonth] || 'last';

    return [
      { label: `Monthly on day ${dayOfMonth}`, value: 'date' },
      { label: `Monthly on the ${ordinal} ${dayName}`, value: 'weekday' },
    ];
  };

  const handleSave = () => {
    const freqMap: Record<FrequencyUnit, string> = {
      day: 'DAILY',
      week: 'WEEKLY',
      month: 'MONTHLY',
      year: 'YEARLY'
    };
    let rule = `RRULE:FREQ=${freqMap[frequency]}`;

    if (interval > 1) {
      rule += `;INTERVAL=${interval}`;
    }

    if (frequency === 'week' && selectedDays.length > 0) {
      rule += `;BYDAY=${selectedDays.join(',')}`;
    }

    if (frequency === 'month') {
      if (monthlyType === 'date') {
        const date = new Date(startDate + 'T00:00:00');
        rule += `;BYMONTHDAY=${date.getDate()}`;
      } else {
        const date = new Date(startDate + 'T00:00:00');
        const dayOfWeek = date.getDay();
        const dayCode = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek];
        const weekOfMonth = Math.ceil(date.getDate() / 7);
        rule += `;BYDAY=${dayCode};BYSETPOS=${weekOfMonth}`;
      }
    }

    if (endType === 'after') {
      const count = parseInt(occurrences, 10);
      if (!isNaN(count) && count > 0) {
        rule += `;COUNT=${count}`;
      }
    }

    const finalEndDate = endType === 'on' && endDate ? endDate : null;
    onSave(rule, finalEndDate);
    onClose();
  };

  const renderIntervalSelector = () => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.text }]}>Repeat every</Text>
      <TouchableOpacity
        style={[styles.picker, { backgroundColor: colors.background, borderColor: colors.border }]}
        onPress={() => setShowIntervalPicker(!showIntervalPicker)}
      >
        <Text style={[styles.pickerText, { color: colors.text }]}>{interval}</Text>
        {showIntervalPicker ? (
          <ChevronUp size={20} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.picker, styles.pickerWide, { backgroundColor: colors.background, borderColor: colors.border }]}
        onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}
      >
        <Text style={[styles.pickerText, { color: colors.text }]}>
          {frequency === 'day' ? 'day' : frequency === 'week' ? 'week' : frequency === 'month' ? 'month' : 'year'}
        </Text>
        {showFrequencyPicker ? (
          <ChevronUp size={20} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderWeeklyRepeatOn = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>Repeat on</Text>
      <View style={styles.daysRow}>
        {dayButtons.map((day, index) => {
          const isSelected = selectedDays.includes(day.full);
          return (
            <TouchableOpacity
              key={`${day.full}-${index}`}
              style={[
                styles.dayCircle,
                { borderColor: colors.border, backgroundColor: colors.background },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => handleDayToggle(day.full)}
            >
              <Text style={[
                styles.dayLetter,
                { color: isSelected ? '#ffffff' : colors.text }
              ]}>
                {day.code}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderMonthlyOptions = () => {
    const options = getMonthlyOptions();
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.picker, styles.pickerFull, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={() => setShowMonthlyPicker(!showMonthlyPicker)}
        >
          <Text style={[styles.pickerText, { color: colors.text }]}>
            {options.find(opt => opt.value === monthlyType)?.label || options[0].label}
          </Text>
          {showMonthlyPicker ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {showMonthlyPicker && (
          <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setMonthlyType(option.value as 'date' | 'weekday');
                  setShowMonthlyPicker(false);
                }}
              >
                <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEndsSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>Ends</Text>

      <View style={styles.radioGroup}>
        <TouchableOpacity
          style={styles.radioRow}
          onPress={() => setEndType('never')}
        >
          <View style={[
            styles.radio,
            { borderColor: colors.border },
            endType === 'never' && { borderColor: colors.primary }
          ]}>
            {endType === 'never' && (
              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Text style={[styles.radioLabel, { color: colors.text }]}>Never</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioRow}
          onPress={() => setEndType('on')}
        >
          <View style={[
            styles.radio,
            { borderColor: colors.border },
            endType === 'on' && { borderColor: colors.primary }
          ]}>
            {endType === 'on' && (
              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Text style={[styles.radioLabel, { color: colors.text }]}>On</Text>
          {endType === 'on' && (
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>
                {endDate || 'Select date'}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioRow}
          onPress={() => setEndType('after')}
        >
          <View style={[
            styles.radio,
            { borderColor: colors.border },
            endType === 'after' && { borderColor: colors.primary }
          ]}>
            {endType === 'after' && (
              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Text style={[styles.radioLabel, { color: colors.text }]}>After</Text>
          {endType === 'after' && (
            <TouchableOpacity
              style={[styles.occurrencesButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowOccurrencesPicker(!showOccurrencesPicker)}
            >
              <Text style={[styles.occurrencesText, { color: colors.text }]}>{occurrences}</Text>
              {showOccurrencesPicker ? (
                <ChevronUp size={16} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={16} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          )}
          {endType === 'after' && (
            <Text style={[styles.radioLabel, { color: colors.text }]}>occurrences</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: '#f0f0f0' }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Custom recurrence</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {renderIntervalSelector()}

          {showIntervalPicker && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setInterval(num);
                    setShowIntervalPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showFrequencyPicker && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(['day', 'week', 'month', 'year'] as FrequencyUnit[]).map(freq => (
                <TouchableOpacity
                  key={freq}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFrequency(freq);
                    setShowFrequencyPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }]}>{freq}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {frequency === 'week' && renderWeeklyRepeatOn()}
          {frequency === 'month' && renderMonthlyOptions()}

          {renderEndsSection()}

          {showOccurrencesPicker && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ScrollView style={styles.occurrencesScroll}>
                {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                  <TouchableOpacity
                    key={num}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setOccurrences(String(num));
                      setShowOccurrencesPicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={[styles.buttonText, styles.saveButtonText]}>Done</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={[styles.datePickerContainer, { backgroundColor: colors.surface }]}>
              <Calendar
                onDayPress={(day) => {
                  setEndDate(day.dateString);
                  setShowDatePicker(false);
                }}
                markedDates={{
                  [endDate]: { selected: true, selectedColor: colors.primary }
                }}
                minDate={startDate}
                theme={{
                  backgroundColor: colors.surface,
                  calendarBackground: colors.surface,
                  textSectionTitleColor: colors.text,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: colors.primary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textSecondary,
                  monthTextColor: colors.text,
                  arrowColor: colors.primary,
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 70,
  },
  pickerWide: {
    flex: 1,
  },
  pickerFull: {
    width: '100%',
  },
  pickerText: {
    fontSize: 16,
    marginRight: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayLetter: {
    fontSize: 16,
    fontWeight: '500',
  },
  radioGroup: {
    gap: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 16,
  },
  dateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  dateButtonText: {
    fontSize: 14,
  },
  occurrencesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    gap: 8,
  },
  occurrencesText: {
    fontSize: 16,
  },
  dropdown: {
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 16,
  },
  occurrencesScroll: {
    maxHeight: 200,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    minWidth: 100,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: {
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 400,
  },
});
