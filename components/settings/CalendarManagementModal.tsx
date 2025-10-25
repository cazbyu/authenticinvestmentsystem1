import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import { US_HOLIDAYS, Holiday } from '@/lib/holidays';

interface CalendarManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CalendarManagementModal({ visible, onClose }: CalendarManagementModalProps) {
  const [showHolidaysPage, setShowHolidaysPage] = useState(false);
  const [showSpecialDaysPage, setShowSpecialDaysPage] = useState(false);

  const handleClose = () => {
    setShowHolidaysPage(false);
    setShowSpecialDaysPage(false);
    onClose();
  };

  if (showHolidaysPage) {
    return <HolidaySelectionPage onBack={() => setShowHolidaysPage(false)} />;
  }

  if (showSpecialDaysPage) {
    return <CustomSpecialDaysPage onBack={() => setShowSpecialDaysPage(false)} />;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar Management</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display Options</Text>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowHolidaysPage(true)}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Holidays</Text>
                <Text style={styles.settingDescription}>
                  Choose which holidays to display on your calendar
                </Text>
              </View>
              <ChevronRight size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowSpecialDaysPage(true)}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Custom Special Days</Text>
                <Text style={styles.settingDescription}>
                  Add your own special days and celebrations
                </Text>
              </View>
              <ChevronRight size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function HolidaySelectionPage({ onBack }: { onBack: () => void }) {
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>(
    US_HOLIDAYS.filter(h => h.enabled).map(h => h.id)
  );

  const toggleHoliday = (holidayId: string) => {
    if (selectedHolidays.includes(holidayId)) {
      setSelectedHolidays(selectedHolidays.filter(id => id !== holidayId));
    } else {
      setSelectedHolidays([...selectedHolidays, holidayId]);
    }
  };

  const federalHolidays = US_HOLIDAYS.filter(h => h.category === 'federal');
  const religiousHolidays = US_HOLIDAYS.filter(h => h.category === 'religious');
  const observances = US_HOLIDAYS.filter(h => h.category === 'observance');

  const renderHolidayItem = (holiday: Holiday) => {
    const isSelected = selectedHolidays.includes(holiday.id);

    return (
      <TouchableOpacity
        key={holiday.id}
        style={styles.holidayItem}
        onPress={() => toggleHoliday(holiday.id)}
      >
        <View style={styles.holidayInfo}>
          <View style={[styles.colorDot, { backgroundColor: holiday.color }]} />
          <Text style={styles.holidayName}>{holiday.name}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Holidays</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.holidaySection}>
          <Text style={styles.holidaySectionTitle}>Federal Holidays</Text>
          {federalHolidays.map(renderHolidayItem)}
        </View>

        <View style={styles.holidaySection}>
          <Text style={styles.holidaySectionTitle}>Religious Holidays</Text>
          {religiousHolidays.map(renderHolidayItem)}
        </View>

        <View style={styles.holidaySection}>
          <Text style={styles.holidaySectionTitle}>Observances</Text>
          {observances.map(renderHolidayItem)}
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function CustomSpecialDaysPage({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom Special Days</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.placeholderContent}>
          <Text style={styles.placeholderTitle}>Coming Soon</Text>
          <Text style={styles.placeholderText}>
            Add your own custom special days like birthdays, anniversaries, and personal celebrations to your calendar.
          </Text>
          <Text style={styles.placeholderText}>
            This feature is currently under development.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    fontSize: 16,
    color: '#0078d4',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },

  // Holiday selection styles
  holidaySection: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  holidaySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  holidayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  holidayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  holidayName: {
    fontSize: 15,
    color: '#1f2937',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Placeholder styles
  placeholderContent: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
