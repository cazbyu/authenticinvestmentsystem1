import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface RecurrenceDropdownProps {
  value: string | undefined;
  onChange: (value: string) => void;
  onOpenCustom: () => void;
  startDate: string;
}

export function RecurrenceDropdown({ value, onChange, onOpenCustom, startDate }: RecurrenceDropdownProps) {
  const { colors } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const getSmartOptions = () => {
    if (!startDate) return [];

    const date = new Date(startDate + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    const dayOfMonth = date.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[date.getMonth()];

    const weekOfMonth = Math.ceil(dayOfMonth / 7);
    const ordinals = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
    const ordinal = ordinals[weekOfMonth] || 'last';

    return [
      { label: 'Does not repeat', value: '' },
      { label: 'Daily', value: 'RRULE:FREQ=DAILY' },
      { label: `Weekly on ${dayName}`, value: `RRULE:FREQ=WEEKLY;BYDAY=${['SU','MO','TU','WE','TH','FR','SA'][dayOfWeek]}` },
      { label: `Monthly on the ${ordinal} ${dayName}`, value: `RRULE:FREQ=MONTHLY;BYDAY=${['SU','MO','TU','WE','TH','FR','SA'][dayOfWeek]};BYSETPOS=${weekOfMonth}` },
      { label: `Annually on ${monthName} ${dayOfMonth}`, value: 'RRULE:FREQ=YEARLY' },
      { label: 'Every weekday (Monday to Friday)', value: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
      { label: 'Custom...', value: 'custom' },
    ];
  };

  const getDisplayLabel = () => {
    if (!value) return 'Does not repeat';

    const options = getSmartOptions();
    const match = options.find(opt => opt.value === value);
    if (match) return match.label;

    if (value.includes('FREQ=DAILY')) return 'Daily';
    if (value.includes('FREQ=WEEKLY') || value.includes('FREQ=WEEK')) {
      if (value.includes('MO,TU,WE,TH,FR')) return 'Every weekday';
      return 'Custom weekly';
    }
    if (value.includes('FREQ=MONTHLY') || value.includes('FREQ=MONTH')) return 'Custom monthly';
    if (value.includes('FREQ=YEARLY') || value.includes('FREQ=YEAR')) return 'Custom yearly';

    return 'Custom';
  };

  const handleSelect = (option: { label: string; value: string }) => {
    if (option.value === 'custom') {
      setShowMenu(false);
      onOpenCustom();
    } else {
      onChange(option.value);
      setShowMenu(false);
    }
  };

  const options = getSmartOptions();
  const displayLabel = getDisplayLabel();

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowMenu(true)}
      >
        <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{displayLabel}</Text>
        <ChevronDown size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
            <ScrollView style={styles.menuScroll}>
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isDivider = index === 0 || index === options.length - 1;

                return (
                  <View key={option.value || 'none'}>
                    <TouchableOpacity
                      style={[
                        styles.menuItem,
                        { backgroundColor: isSelected ? colors.primary + '10' : 'transparent' }
                      ]}
                      onPress={() => handleSelect(option)}
                    >
                      <Text style={[
                        styles.menuItemText,
                        { color: colors.text },
                        isSelected && { fontWeight: '600' }
                      ]}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Check size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                    {isDivider && index < options.length - 1 && (
                      <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    width: 150,
    alignSelf: 'flex-start',
  },
  dropdownButtonText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuScroll: {
    maxHeight: 400,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
  },
});
