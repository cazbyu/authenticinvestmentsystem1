import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { buildRRule, parseRRule, calculateEndDateFromCount, describeRRule } from '@/lib/rruleUtils';
import { formatLocalDate } from '@/lib/dateUtils';
import { Calendar } from 'react-native-calendars';

interface RecurrenceSettingsProps {
  recurrenceRule?: string;
  recurrenceEndDate?: string | null;
  startDate: string;
  onChangeRule: (rule: string) => void;
  onChangeEndDate: (date: string | null) => void;
}

type FreqTab = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type EndType = 'forever' | 'until' | 'count';

export default function RecurrenceSettings({
  recurrenceRule,
  recurrenceEndDate,
  startDate,
  onChangeRule,
  onChangeEndDate,
}: RecurrenceSettingsProps) {
  const { colors } = useTheme();
  const countUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [activeTab, setActiveTab] = useState<FreqTab>('WEEKLY');
  const [interval, setInterval] = useState<number>(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthlyOption, setMonthlyOption] = useState<'date' | 'weekday'>('date');
  const [monthlyDate, setMonthlyDate] = useState<number>(1);
  const [monthlyPosition, setMonthlyPosition] = useState<number>(1);
  const [monthlyWeekday, setMonthlyWeekday] = useState<string>('MO');

  const [endType, setEndType] = useState<EndType>('forever');
  const [countValue, setCountValue] = useState<string>('30');
  const [untilDate, setUntilDate] = useState<string>('');
  const [showUntilCalendar, setShowUntilCalendar] = useState(false);

  useEffect(() => {
    if (recurrenceRule) {
      const parsed = parseRRule(recurrenceRule);
      if (parsed) {
        setActiveTab(parsed.freq);
        setInterval(parsed.interval || 1);

        if (parsed.byday) {
          setSelectedDays(parsed.byday);
          if (parsed.bysetpos !== undefined) {
            setMonthlyPosition(parsed.bysetpos);
            setMonthlyWeekday(parsed.byday[0]);
            setMonthlyOption('weekday');
          }
        }

        if (parsed.bymonthday !== undefined) {
          setMonthlyDate(parsed.bymonthday);
          setMonthlyOption('date');
        }

        if (parsed.count !== undefined) {
          setEndType('count');
          setCountValue(String(parsed.count));
        } else if (parsed.until || recurrenceEndDate) {
          setEndType('until');
          setUntilDate(parsed.until || recurrenceEndDate || '');
        } else {
          setEndType('forever');
        }
      }
    }
  }, [recurrenceRule, recurrenceEndDate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (countUpdateTimeoutRef.current) {
        clearTimeout(countUpdateTimeoutRef.current);
      }
    };
  }, []);

  const updateRule = (updates: Partial<{
    freq: FreqTab;
    interval: number;
    byday: string[];
    bymonthday: number;
    bysetpos: number;
  }>) => {
    const currentParsed = recurrenceRule ? parseRRule(recurrenceRule) : null;

    const ruleOptions: any = {
      freq: updates.freq || activeTab,
      interval: updates.interval || interval,
    };

    if (updates.byday !== undefined || (updates.freq === 'WEEKLY' || activeTab === 'WEEKLY')) {
      if (updates.byday && updates.byday.length > 0) {
        ruleOptions.byday = updates.byday;
      } else if (selectedDays.length > 0 && (updates.freq === 'WEEKLY' || activeTab === 'WEEKLY')) {
        ruleOptions.byday = selectedDays;
      }
    }

    if (updates.bymonthday !== undefined) {
      ruleOptions.bymonthday = updates.bymonthday;
    }

    if (updates.bysetpos !== undefined && ruleOptions.byday) {
      ruleOptions.bysetpos = updates.bysetpos;
    }

    if (endType === 'count') {
      const countNum = parseInt(countValue, 10);
      if (!isNaN(countNum) && countNum > 0) {
        ruleOptions.count = countNum;
        const endDate = calculateEndDateFromCount(new Date(startDate), buildRRule(ruleOptions), countNum);
        if (endDate) {
          onChangeEndDate(formatLocalDate(endDate));
        } else {
          onChangeEndDate(null);
        }
      } else {
        onChangeEndDate(null);
      }
    } else if (endType === 'until' && untilDate) {
      onChangeEndDate(untilDate);
    } else {
      onChangeEndDate(null);
    }

    const newRule = buildRRule(ruleOptions);
    onChangeRule(newRule);
  };

  const handleTabChange = (tab: FreqTab) => {
    setActiveTab(tab);

    if (tab === 'WEEKLY' && selectedDays.length === 0) {
      const start = new Date(startDate);
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      setSelectedDays([dayMap[start.getDay()]]);
    }

    updateRule({ freq: tab });
  };

  const handleDayToggle = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    setSelectedDays(newDays);
    updateRule({ byday: newDays });
  };

  const handleMonFriToggle = () => {
    const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR'];
    const isMonFri = weekdays.every(d => selectedDays.includes(d));

    if (isMonFri) {
      setSelectedDays([]);
      updateRule({ byday: [] });
    } else {
      setSelectedDays(weekdays);
      updateRule({ byday: weekdays });
    }
  };

  const handleMonthlyOptionChange = (option: 'date' | 'weekday') => {
    setMonthlyOption(option);

    if (option === 'date') {
      updateRule({ bymonthday: monthlyDate, bysetpos: undefined, byday: undefined });
    } else {
      updateRule({ bysetpos: monthlyPosition, byday: [monthlyWeekday], bymonthday: undefined });
    }
  };

  const handleEndTypeChange = (type: EndType) => {
    setEndType(type);

    if (type === 'forever') {
      onChangeEndDate(null);
      updateRule({});
    } else if (type === 'count') {
      updateRule({});
    } else if (type === 'until' && untilDate) {
      onChangeEndDate(untilDate);
    }
  };

  const handleCountChange = (value: string) => {
    // Clear any existing timeout
    if (countUpdateTimeoutRef.current) {
      clearTimeout(countUpdateTimeoutRef.current);
    }

    // If empty, don't update state (keep the previous valid value)
    if (value === '') {
      return;
    }

    // Parse and validate the input
    const numValue = parseInt(value, 10);

    // Reject invalid, zero, or negative values
    if (isNaN(numValue) || numValue < 1) {
      return;
    }

    // Cap at reasonable maximum
    if (numValue > 999) {
      return;
    }

    // Update state with valid value
    setCountValue(String(numValue));

    // Debounce the update - only call updateRule after user stops typing for 500ms
    countUpdateTimeoutRef.current = setTimeout(() => {
      updateRule({});
    }, 500);
  };

  const handleUntilDateSelect = (date: string) => {
    setUntilDate(date);
    onChangeEndDate(date);
    setShowUntilCalendar(false);
    updateRule({});
  };

  const dayLabels = [
    { code: 'SU', label: 'Sun' },
    { code: 'MO', label: 'Mon' },
    { code: 'TU', label: 'Tue' },
    { code: 'WE', label: 'Wed' },
    { code: 'TH', label: 'Thu' },
    { code: 'FR', label: 'Fri' },
    { code: 'SA', label: 'Sat' },
  ];

  const positions = [
    { value: 1, label: 'First' },
    { value: 2, label: 'Second' },
    { value: 3, label: 'Third' },
    { value: 4, label: 'Fourth' },
    { value: -1, label: 'Last' },
  ];

  const weekdayOptions = [
    { code: 'MO', label: 'Monday' },
    { code: 'TU', label: 'Tuesday' },
    { code: 'WE', label: 'Wednesday' },
    { code: 'TH', label: 'Thursday' },
    { code: 'FR', label: 'Friday' },
    { code: 'SA', label: 'Saturday' },
    { code: 'SU', label: 'Sunday' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Repeat Frequency</Text>

      <View style={styles.tabs}>
        {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as FreqTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              { borderColor: colors.border, backgroundColor: colors.background },
              activeTab === tab && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab ? '#ffffff' : colors.text }
            ]}>
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'WEEKLY' && (
        <View style={styles.section}>
          <View style={styles.monFriRow}>
            <TouchableOpacity
              style={[
                styles.monFriButton,
                { borderColor: colors.border, backgroundColor: colors.background },
                ['MO', 'TU', 'WE', 'TH', 'FR'].every(d => selectedDays.includes(d)) &&
                  { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={handleMonFriToggle}
            >
              <Text style={[
                styles.monFriText,
                {
                  color: ['MO', 'TU', 'WE', 'TH', 'FR'].every(d => selectedDays.includes(d))
                    ? '#ffffff'
                    : colors.text
                }
              ]}>
                Mon-Fri
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.daysGrid}>
            {dayLabels.map(({ code, label }) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.dayButton,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  selectedDays.includes(code) && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => handleDayToggle(code)}
              >
                <Text style={[
                  styles.dayText,
                  { color: selectedDays.includes(code) ? '#ffffff' : colors.text }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {activeTab === 'MONTHLY' && (
        <View style={styles.section}>
          <View style={styles.monthlyOptions}>
            <TouchableOpacity
              style={[
                styles.monthlyOptionButton,
                { borderColor: colors.border, backgroundColor: colors.background },
                monthlyOption === 'date' && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => handleMonthlyOptionChange('date')}
            >
              <Text style={[
                styles.monthlyOptionText,
                { color: monthlyOption === 'date' ? '#ffffff' : colors.text }
              ]}>
                On day of month
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.monthlyOptionButton,
                { borderColor: colors.border, backgroundColor: colors.background },
                monthlyOption === 'weekday' && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => handleMonthlyOptionChange('weekday')}
            >
              <Text style={[
                styles.monthlyOptionText,
                { color: monthlyOption === 'weekday' ? '#ffffff' : colors.text }
              ]}>
                On weekday
              </Text>
            </TouchableOpacity>
          </View>

          {monthlyOption === 'date' && (
            <View style={styles.monthlyDateInput}>
              <Text style={[styles.label, { color: colors.text }]}>Day of month:</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={String(monthlyDate)}
                onChangeText={(value) => {
                  const num = parseInt(value, 10);
                  if (!isNaN(num) && num >= 1 && num <= 31) {
                    setMonthlyDate(num);
                    updateRule({ bymonthday: num, bysetpos: undefined, byday: undefined });
                  }
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                (1-31, auto-adjusts for shorter months)
              </Text>
            </View>
          )}

          {monthlyOption === 'weekday' && (
            <View style={styles.monthlyWeekdayInput}>
              <Text style={[styles.label, { color: colors.text }]}>Position:</Text>
              <View style={styles.positionsGrid}>
                {positions.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.positionButton,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      monthlyPosition === value && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => {
                      setMonthlyPosition(value);
                      updateRule({ bysetpos: value, byday: [monthlyWeekday], bymonthday: undefined });
                    }}
                  >
                    <Text style={[
                      styles.positionText,
                      { color: monthlyPosition === value ? '#ffffff' : colors.text }
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Weekday:</Text>
              <View style={styles.weekdaysGrid}>
                {weekdayOptions.map(({ code, label }) => (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.weekdayButton,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      monthlyWeekday === code && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => {
                      setMonthlyWeekday(code);
                      updateRule({ bysetpos: monthlyPosition, byday: [code], bymonthday: undefined });
                    }}
                  >
                    <Text style={[
                      styles.weekdayText,
                      { color: monthlyWeekday === code ? '#ffffff' : colors.text }
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {(activeTab === 'DAILY' || activeTab === 'YEARLY') && (
        <View style={styles.section}>
          <View style={styles.intervalRow}>
            <Text style={[styles.label, { color: colors.text }]}>Every</Text>
            <TextInput
              style={[styles.intervalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={String(interval)}
              onChangeText={(value) => {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num >= 1) {
                  setInterval(num);
                  updateRule({ interval: num });
                }
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={[styles.label, { color: colors.text }]}>
              {activeTab === 'DAILY' ? (interval === 1 ? 'day' : 'days') : (interval === 1 ? 'year' : 'years')}
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Ends</Text>

      <View style={styles.endOptions}>
        <TouchableOpacity
          style={[
            styles.endOption,
            { borderColor: colors.border, backgroundColor: colors.background },
            endType === 'forever' && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={() => handleEndTypeChange('forever')}
        >
          <Text style={[
            styles.endOptionText,
            { color: endType === 'forever' ? '#ffffff' : colors.text }
          ]}>
            Never
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.endOption,
            { borderColor: colors.border, backgroundColor: colors.background },
            endType === 'until' && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={() => handleEndTypeChange('until')}
        >
          <Text style={[
            styles.endOptionText,
            { color: endType === 'until' ? '#ffffff' : colors.text }
          ]}>
            On date
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.endOption,
            { borderColor: colors.border, backgroundColor: colors.background },
            endType === 'count' && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={() => handleEndTypeChange('count')}
        >
          <Text style={[
            styles.endOptionText,
            { color: endType === 'count' ? '#ffffff' : colors.text }
          ]}>
            After X times
          </Text>
        </TouchableOpacity>
      </View>

      {endType === 'until' && (
        <View style={styles.endDetailsSection}>
          <TouchableOpacity
            style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={() => setShowUntilCalendar(true)}
          >
            <Text style={[styles.dateButtonText, { color: colors.text }]}>
              {untilDate || 'Select end date'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {endType === 'count' && (
        <View style={styles.endDetailsSection}>
          <View style={styles.countRow}>
            <Text style={[styles.label, { color: colors.text }]}>Number of occurrences:</Text>
            <TextInput
              style={[styles.countInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={countValue}
              onChangeText={handleCountChange}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="1-999"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 4 }]}>
            Enter a number between 1 and 999
          </Text>
        </View>
      )}

      {recurrenceRule && (
        <View style={[styles.summaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Summary:</Text>
          <Text style={[styles.summaryText, { color: colors.text }]}>
            {describeRRule(recurrenceRule)}
            {endType === 'until' && recurrenceEndDate && ` until ${new Date(recurrenceEndDate).toLocaleDateString()}`}
            {endType === 'count' && recurrenceEndDate && ` until ${new Date(recurrenceEndDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' })}`}
          </Text>
        </View>
      )}

      <Modal
        visible={showUntilCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUntilCalendar(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUntilCalendar(false)}
        >
          <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
            <Calendar
              onDayPress={(day) => handleUntilDateSelect(day.dateString)}
              markedDates={{
                [untilDate]: { selected: true, selectedColor: colors.primary }
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  monFriRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  monFriButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  monFriText: {
    fontSize: 14,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  monthlyOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  monthlyOptionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  monthlyOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  monthlyDateInput: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  monthlyWeekdayInput: {
    gap: 8,
  },
  positionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  weekdaysGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  weekdayButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intervalInput: {
    width: 60,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  endOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  endOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  endOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  endDetailsSection: {
    marginBottom: 16,
  },
  dateButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  countRow: {
    gap: 8,
  },
  countInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  summaryBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
  },
});
