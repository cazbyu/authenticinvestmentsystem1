import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { X, CheckSquare, Calendar as CalendarIcon, Lightbulb, TrendingDown, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type ActionType = 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'followUp';

interface ActionSelectionModalProps {
  visible: boolean;
  onActionSelect: (action: ActionType) => void;
  onClose: () => void;
}

export default function ActionSelectionModal({
  visible,
  onActionSelect,
  onClose,
}: ActionSelectionModalProps) {
  const { colors } = useTheme();

  const actions = [
    {
      type: 'task' as ActionType,
      label: 'Create a Task',
      icon: CheckSquare,
      color: '#0078d4',
    },
    {
      type: 'event' as ActionType,
      label: 'Create an Event',
      icon: CalendarIcon,
      color: '#10b981',
    },
    {
      type: 'depositIdea' as ActionType,
      label: 'Create a Deposit Idea',
      icon: Lightbulb,
      color: '#8b5cf6',
    },
    {
      type: 'withdrawal' as ActionType,
      label: 'Create a Withdrawal',
      icon: TrendingDown,
      color: '#f59e0b',
    },
    {
      type: 'followUp' as ActionType,
      label: 'Follow Up',
      icon: Clock,
      color: colors.primary,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Select an Action</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content}>
            {actions.map((action) => {
              const IconComponent = action.icon;
              return (
                <TouchableOpacity
                  key={action.type}
                  style={[styles.actionButton, { borderColor: colors.border }]}
                  onPress={() => {
                    onActionSelect(action.type);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: `${action.color}15` }]}>
                    <IconComponent size={24} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
});
