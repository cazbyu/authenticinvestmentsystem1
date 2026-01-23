import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Image,
} from 'react-native';
import {
  Star,
  Leaf,
  Flag,
  Users,
  X,
  CheckSquare,
  Calendar,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

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
  north: {
    title: 'Mission & Vision',
    color: '#ed1c24',
    Icon: Star,
    bankLabel: 'View North Star',
    bankRoute: '/settings'
  },
  east: {
    title: 'Wellness',
    color: '#39b54a',
    Icon: Leaf,
    bankLabel: 'Wellness Bank',
    bankRoute: '/(tabs)/wellness'
  },
  south: {
    title: 'Goals',
    color: '#00abc5',
    Icon: Flag,
    bankLabel: 'Goal Bank',
    bankRoute: '/(tabs)/goals'
  },
  west: {
    title: 'Roles',
    color: '#ffd400',
    Icon: Users,
    bankLabel: 'Role Bank',
    bankRoute: '/(tabs)/roles'
  },
};

const ACTION_ICONS = [
  { id: 'task', Icon: CheckSquare, label: 'Task', type: 'icon' },
  { id: 'event', Icon: Calendar, label: 'Event', type: 'icon' },
  { id: 'idea', image: require('@/assets/images/deposit-idea.png'), label: 'Idea', type: 'image' },
  { id: 'reflect', image: require('@/assets/images/reflections-72.png'), label: 'Reflect', type: 'image' },
  { id: 'rose', image: require('@/assets/images/rose-81.png'), label: 'Rose', type: 'image' },
  { id: 'thorn', image: require('@/assets/images/thorn-81.png'), label: 'Thorn', type: 'image' },
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
  const router = useRouter();

  if (!cardinal) return null;

  const theme = CARDINAL_THEMES[cardinal];
  const HeaderIcon = theme.Icon;

  const handleBankPress = () => {
    onClose();
    router.push(theme.bankRoute as any);
  };

  const handleActionPress = (actionType: string) => {
    onClose(); // Close the Spark modal first
    onAction(actionType); // Then trigger the action (opens TaskEventForm)
  };

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

          <TouchableOpacity
            style={[styles.bankButton, { borderColor: theme.color }]}
            onPress={handleBankPress}
            activeOpacity={0.7}
          >
            <HeaderIcon size={18} color={theme.color} />
            <Text style={[styles.bankButtonText, { color: theme.color }]}>
              {theme.bankLabel}
            </Text>
            <ChevronRight size={16} color={theme.color} />
          </TouchableOpacity>

          <View style={styles.actionsContainer}>
            <Text style={styles.actionsLabel}>Take Action:</Text>
            <View style={styles.actionsRow}>
              {ACTION_ICONS.map((action) => {
                return (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.actionButton}
                    onPress={() => handleActionPress(action.id)}
                  >
                    <View style={[styles.actionIconCircle, { borderColor: theme.color }]}>
                      {action.type === 'image' ? (
                        <Image
                          source={action.image}
                          style={styles.actionIconImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <action.Icon size={20} color={theme.color} />
                      )}
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
  bankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    gap: 8,
  },
  bankButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  actionIconImage: {
    width: 28,
    height: 28,
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
