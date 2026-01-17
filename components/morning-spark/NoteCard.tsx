import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  ClipboardList,
  Lightbulb,
  Calendar,
  Check,
  Clock,
  X,
} from 'lucide-react-native';
import Autolink from 'react-native-autolink';
import { useTheme } from '@/contexts/ThemeContext';
import { TimePickerDropdown } from '@/components/tasks/TimePickerDropdown';

interface NoteCardProps {
  note: {
    id: string;
    content: string;
    created_at: string;
  };
  onConvertToTask: (noteId: string, content: string) => Promise<void>;
  onConvertToDepositIdea: (noteId: string, content: string) => Promise<void>;
  onConvertToEvent: (noteId: string, content: string, startTime: string) => Promise<void>;
  onLog: (noteId: string) => Promise<void>;
}

export function NoteCard({
  note,
  onConvertToTask,
  onConvertToDepositIdea,
  onConvertToEvent,
  onLog,
}: NoteCardProps) {
  const { colors, isDarkMode } = useTheme();
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  async function handleConvertToTask() {
    try {
      setLoading(true);
      await onConvertToTask(note.id, note.content);
    } catch (error) {
      console.error('Error converting to task:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToDepositIdea() {
    try {
      setLoading(true);
      await onConvertToDepositIdea(note.id, note.content);
    } catch (error) {
      console.error('Error converting to deposit idea:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToEvent() {
    try {
      setLoading(true);
      await onConvertToEvent(note.id, note.content, selectedTime);
      setTimePickerVisible(false);
    } catch (error) {
      console.error('Error converting to event:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLog() {
    try {
      setLoading(true);
      await onLog(note.id);
    } catch (error) {
      console.error('Error logging note:', error);
    } finally {
      setLoading(false);
    }
  }

  function truncateContent(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  if (loading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Autolink
          text={truncateContent(note.content)}
          linkStyle={{ color: '#3b82f6', textDecorationLine: 'underline' }}
          onPress={(url) => Linking.openURL(url)}
          style={[styles.content, { color: colors.text }]}
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3B82F620' }]}
            onPress={handleConvertToTask}
          >
            <ClipboardList size={14} color="#3B82F6" />
            <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>
              Task
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#F59E0B20' }]}
            onPress={handleConvertToDepositIdea}
          >
            <Lightbulb size={14} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>
              Idea
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8B5CF620' }]}
            onPress={() => setTimePickerVisible(true)}
          >
            <Calendar size={14} color="#8B5CF6" />
            <Text style={[styles.actionButtonText, { color: '#8B5CF6' }]}>
              Event
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10B98120' }]}
            onPress={handleLog}
          >
            <Check size={14} color="#10B981" />
            <Text style={[styles.actionButtonText, { color: '#10B981' }]}>
              Log
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
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
                Set Event Time
              </Text>
              <TouchableOpacity
                onPress={() => setTimePickerVisible(false)}
                style={styles.closeButton}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.notePreview, { color: colors.textSecondary }]}>
                {truncateContent(note.content, 100)}
              </Text>

              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerLabel}>
                  <Clock size={18} color={colors.textSecondary} />
                  <Text style={[styles.timePickerLabelText, { color: colors.textSecondary }]}>
                    Start Time
                  </Text>
                </View>

                <TimePickerDropdown
                  value={selectedTime}
                  onChange={(time) => setSelectedTime(time)}
                  placeholder="Select time"
                  isDark={isDarkMode}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.surface }]}
                onPress={() => setTimePickerVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={handleConvertToEvent}
              >
                <Text style={styles.createButtonText}>Create Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
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
    maxWidth: 400,
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
  notePreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  timePickerContainer: {
    gap: 12,
  },
  timePickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timePickerLabelText: {
    fontSize: 14,
    fontWeight: '500',
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
  createButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
