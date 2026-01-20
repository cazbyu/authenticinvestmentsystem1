import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DailyNotesView from './DailyNotesView';
import { ReflectionWithRelations } from '@/lib/reflectionUtils';
import { X } from 'lucide-react-native';
import { parseLocalDate } from '@/lib/dateUtils';

interface DailyViewModalProps {
  visible: boolean;
  selectedDate: string;
  onClose: () => void;
  onReflectionPress?: (reflection: ReflectionWithRelations) => void;
  onNotePress?: (item: any) => void;
}

export default function DailyViewModal({
  visible,
  selectedDate,
  onClose,
  onReflectionPress,
  onNotePress,
}: DailyViewModalProps) {
  const { colors } = useTheme();

  const formatDateHeader = (dateString: string) => {
    const date = parseLocalDate(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {formatDateHeader(selectedDate)}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Reflection Report
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.surface }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <DailyNotesView
            selectedDate={selectedDate}
            onReflectionPress={onReflectionPress}
            onNotePress={onNotePress}
          />
        </View>
      </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
});
