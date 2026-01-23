import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import {
  Star,
  Leaf,
  Flag,
  Users,
  X,
  CheckSquare,
  Calendar,
  Lightbulb,
  BookOpen,
  Flower2,
  AlertCircle,
  Edit,
  Check,
  ChevronRight,
} from 'lucide-react-native';

interface SparkQuestionModalProps {
  visible: boolean;
  cardinal: 'north' | 'east' | 'south' | 'west' | null;
  question: string;
  onAction: (actionType: string) => void;
  onNext: () => void;
  onClose: () => void;
  isLastCardinal?: boolean;
}

const CARDINAL_THEMES = {
  north: { title: 'Mission & Vision', color: '#ed1c24', Icon: Star },
  east: { title: 'Wellness', color: '#39b54a', Icon: Leaf },
  south: { title: 'Goals', color: '#00abc5', Icon: Flag },
  west: { title: 'Roles', color: '#ffd400', Icon: Users },
};

const ACTION_ICONS = [
  { id: 'task', Icon: CheckSquare, label: 'Task' },
  { id: 'event', Icon: Calendar, label: 'Event' },
  { id: 'idea', Icon: Lightbulb, label: 'Idea' },
  { id: 'reflect', Icon: BookOpen, label: 'Reflect' },
  { id: 'rose', Icon: Flower2, label: 'Rose' },
  { id: 'thorn', Icon: AlertCircle, label: 'Thorn' },
  { id: 'note', Icon: Edit, label: 'Note' },
];

export default function SparkQuestionModal({
  visible,
  cardinal,
  question,
  onAction,
  onNext,
  onClose,
  isLastCardinal = false,
}: SparkQuestionModalProps) {
  if (!cardinal) return null;

  const theme = CARDINAL_THEMES[cardinal];
  const HeaderIcon = theme.Icon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.header, { backgroundColor: theme.color }]}>
            <HeaderIcon size={24} color="#fff" />
            <Text style={styles.headerTitle}>{theme.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{question}</Text>
          </View>

          <View style={styles.actionsContainer}>
            <Text style={styles.actionsLabel}>Take Action:</Text>
            <View style={styles.actionsRow}>
              {ACTION_ICONS.map((action) => {
                const ActionIcon = action.Icon;
                return (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.actionButton}
                    onPress={() => onAction(action.id)}
                  >
                    <View style={[styles.actionIconCircle, { borderColor: theme.color }]}>
                      <ActionIcon size={20} color={theme.color} />
                    </View>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.color }]}
            onPress={onNext}
          >
            <Text style={styles.nextButtonText}>
              {isLastCardinal ? 'Complete' : 'Next'}
            </Text>
            {isLastCardinal ? (
              <Check size={24} color="#fff" />
            ) : (
              <ChevronRight size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  questionContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333',
    textAlign: 'center',
  },
  actionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    width: 60,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  actionLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
