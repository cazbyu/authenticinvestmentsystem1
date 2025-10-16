import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';

interface TimePickerDropdownProps {
  value: string;
  onChange: (time: string) => void;
  referenceTime?: string;
  startDate?: string;
  endDate?: string;
  placeholder?: string;
  isDark?: boolean;
  minTime?: string;
}

export function TimePickerDropdown({
  value,
  onChange,
  referenceTime,
  startDate,
  endDate,
  placeholder = 'Select time',
  isDark = false,
  minTime,
}: TimePickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const showDuration = referenceTime && startDate && endDate && startDate === endDate;

  useEffect(() => {
    if (isOpen && scrollViewRef.current && value) {
      const options = generateTimeOptions();
      const selectedIndex = options.findIndex(opt => opt.time === value);

      if (selectedIndex !== -1) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: selectedIndex * 36,
            animated: false,
          });
        }, 100);
      }
    }
  }, [isOpen]);

  const generateTimeOptions = (): Array<{ time: string; duration: string }> => {
    const options: Array<{ time: string; duration: string }> = [];

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = formatTime(hour, minute);

        if (minTime && compareTimeStrings(timeStr, minTime) < 0) {
          continue;
        }

        let duration = '';
        if (showDuration && referenceTime) {
          duration = calculateDuration(referenceTime, timeStr);
        }

        options.push({ time: timeStr, duration });
      }
    }

    return options;
  };

  const formatTime = (hour: number, minute: number): string => {
    const isPM = hour >= 12;
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${isPM ? 'pm' : 'am'}`;
  };

  const compareTimeStrings = (time1: string, time2: string): number => {
    const parse = (timeStr: string) => {
      const timeLower = timeStr.toLowerCase().trim();
      const isPM = timeLower.includes('pm');
      const timeOnly = timeLower.replace(/am|pm/g, '').trim();
      const [h, m] = timeOnly.split(':').map(s => parseInt(s.trim(), 10));
      let hours = h === 12 ? (isPM ? 12 : 0) : (isPM ? h + 12 : h);
      return hours * 60 + (m || 0);
    };

    return parse(time1) - parse(time2);
  };

  const calculateDuration = (startTime: string, endTime: string): string => {
    try {
      const parseTime = (timeStr: string) => {
        const timeLower = timeStr.toLowerCase().trim();
        const isPM = timeLower.includes('pm');
        const timeOnly = timeLower.replace(/am|pm/g, '').trim();
        const [h, m] = timeOnly.split(':').map(s => parseInt(s.trim(), 10));
        let hours = h === 12 ? (isPM ? 12 : 0) : (isPM ? h + 12 : h);
        return hours * 60 + (m || 0);
      };

      const startMinutes = parseTime(startTime);
      const endMinutes = parseTime(endTime);
      let diffMinutes = endMinutes - startMinutes;

      if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }

      if (diffMinutes === 0) {
        return '(0 mins)';
      }

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      if (hours === 0) {
        return `(${minutes} mins)`;
      } else if (minutes === 0) {
        return hours === 1 ? '(1 hr)' : `(${hours} hrs)`;
      } else {
        return `(${hours} hr ${minutes} mins)`;
      }
    } catch (e) {
      return '';
    }
  };

  const handleOpen = () => {
    if (buttonRef.current) {
      buttonRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownLayout({
          top: pageY + height,
          left: pageX,
          width: width,
        });
        setIsOpen(true);
      });
    }
  };

  const handleSelect = (time: string) => {
    onChange(time);
    setIsOpen(false);
  };

  const options = generateTimeOptions();

  const colors = {
    background: isDark ? '#1f1f1f' : '#ffffff',
    border: isDark ? '#3f3f3f' : '#dadce0',
    text: isDark ? '#e0e0e0' : '#3c4043',
    textSecondary: isDark ? '#a0a0a0' : '#5f6368',
    hover: isDark ? '#2a2a2a' : '#f1f3f4',
    selected: isDark ? '#2a2a2a' : '#e8f0fe',
  };

  return (
    <View>
      <TouchableOpacity
        ref={buttonRef}
        style={[
          styles.button,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          }
        ]}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, { color: value ? colors.text : colors.textSecondary }]}>
          {value || placeholder}
        </Text>
        <ChevronDown size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={[
              styles.dropdown,
              {
                top: dropdownLayout.top,
                left: dropdownLayout.left,
                width: dropdownLayout.width,
                backgroundColor: colors.background,
                borderColor: colors.border,
              }
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {options.map((option, index) => {
                const isSelected = value === option.time;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.option,
                      { backgroundColor: isSelected ? colors.selected : 'transparent' }
                    ]}
                    onPress={() => handleSelect(option.time)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {option.time}
                      {option.duration && (
                        <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                          {' '}{option.duration}
                        </Text>
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 4,
    minHeight: 40,
  },
  buttonText: {
    fontSize: 14,
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdown: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 4,
    maxHeight: 180,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
  },
  durationText: {
    fontSize: 14,
  },
});
