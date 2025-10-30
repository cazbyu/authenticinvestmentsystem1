import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface RecurringTaskActionModalProps {
  visible: boolean;
  onClose: () => void;
  onThisOccurrence: () => void;
  onAllOccurrences: () => void;
  actionType: 'delete' | 'edit';
  taskTitle: string;
}

export default function RecurringTaskActionModal({
  visible,
  onClose,
  onThisOccurrence,
  onAllOccurrences,
  actionType,
  taskTitle,
}: RecurringTaskActionModalProps) {
  const { colors } = useTheme();

  const actionVerb = actionType === 'delete' ? 'Delete' : 'Edit';
  const actionVerbLower = actionType === 'delete' ? 'delete' : 'edit';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.container, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {actionVerb} Recurring Task
          </Text>

          <Text style={[styles.taskTitle, { color: colors.text }]}>
            {taskTitle}
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            This is a recurring task. What would you like to {actionVerbLower}?
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                onThisOccurrence();
                onClose();
              }}
            >
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                {actionType === 'delete' ? 'This occurrence only' : 'This occurrence'}
              </Text>
              <Text style={[styles.buttonSubtext, styles.primaryButtonSubtext]}>
                {actionType === 'delete'
                  ? 'Removes this date from the series'
                  : 'Edit just this one time'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, {
                backgroundColor: colors.background,
                borderColor: colors.border,
              }]}
              onPress={() => {
                onAllOccurrences();
                onClose();
              }}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                {actionType === 'delete' ? 'All occurrences' : 'All future occurrences'}
              </Text>
              <Text style={[styles.buttonSubtext, { color: colors.textSecondary }]}>
                {actionType === 'delete'
                  ? 'Deletes the entire series'
                  : 'Changes apply to this and future dates'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  container: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 10000,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
  },
  secondaryButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  buttonSubtext: {
    fontSize: 12,
    lineHeight: 16,
  },
  primaryButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
