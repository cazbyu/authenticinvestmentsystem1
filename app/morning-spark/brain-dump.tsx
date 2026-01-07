import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, FileText, Lightbulb, MessageSquare, CheckCircle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  checkTodaysSpark,
  getBrainDumpItems,
  convertBrainDumpToTask,
  saveBrainDumpAsIdea,
  addReflectionToBrainDump,
  acknowledgeBrainDump,
  formatBrainDumpTime,
  getBrainDumpMessage,
  BrainDumpItem,
} from '@/lib/sparkUtils';

interface ToastMessage {
  message: string;
  visible: boolean;
}

export default function BrainDumpScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [brainDumpItems, setBrainDumpItems] = useState<BrainDumpItem[]>([]);
  const [userId, setUserId] = useState<string>('');

  const [showDeferGate, setShowDeferGate] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BrainDumpItem | null>(null);
  const [reflectionText, setReflectionText] = useState('');

  const [toast, setToast] = useState<ToastMessage>({ message: '', visible: false });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const itemAnimations = useRef<{[key: string]: Animated.Value}>({}).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (toast.visible) {
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2700),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToast({ message: '', visible: false });
      });
    }
  }, [toast.visible]);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      const [spark, items] = await Promise.all([
        checkTodaysSpark(user.id),
        getBrainDumpItems(user.id),
      ]);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      setFuelLevel(spark.fuel_level);
      setBrainDumpItems(items);

      items.forEach(item => {
        itemAnimations[item.id] = new Animated.Value(1);
      });

      if (spark.fuel_level === 1 && items.length > 0) {
        setShowDeferGate(true);
        setShowNotes(false);
      } else {
        setShowDeferGate(false);
        setShowNotes(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load brain dump items. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDefer() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/morning-spark/deposit-ideas');
  }

  function handleViewNotes() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowDeferGate(false);
    setShowNotes(true);
  }

  function showToast(message: string) {
    setToast({ message, visible: true });
  }

  function removeItemWithAnimation(itemId: string, callback: () => void) {
    if (!itemAnimations[itemId]) {
      itemAnimations[itemId] = new Animated.Value(1);
    }

    Animated.timing(itemAnimations[itemId], {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      callback();
      setBrainDumpItems(prev => prev.filter(item => item.id !== itemId));
    });
  }

  async function handleMakeTask(item: BrainDumpItem) {
    try {
      setProcessing(item.id);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await convertBrainDumpToTask(item.id, userId, item.content);

      removeItemWithAnimation(item.id, () => {
        showToast('✓ Added to today\'s tasks!');
      });
    } catch (error) {
      console.error('Error converting to task:', error);
      Alert.alert('Error', 'Failed to convert to task. Please try again.');
    } finally {
      setProcessing(null);
    }
  }

  async function handleSaveIdea(item: BrainDumpItem) {
    try {
      setProcessing(item.id);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await saveBrainDumpAsIdea(item.id, userId, item.content);

      removeItemWithAnimation(item.id, () => {
        showToast('✓ Saved to your Deposit Ideas!');
      });
    } catch (error) {
      console.error('Error saving as idea:', error);
      Alert.alert('Error', 'Failed to save as idea. Please try again.');
    } finally {
      setProcessing(null);
    }
  }

  function handleReflect(item: BrainDumpItem) {
    setSelectedItem(item);
    setReflectionText('');
    setReflectionModalVisible(true);
  }

  async function submitReflection() {
    if (!selectedItem || !reflectionText.trim()) {
      Alert.alert('Error', 'Please enter a reflection.');
      return;
    }

    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await addReflectionToBrainDump(selectedItem.id, userId, reflectionText);

      setReflectionModalVisible(false);
      setSelectedItem(null);
      setReflectionText('');

      showToast('✓ Reflection captured!');
    } catch (error) {
      console.error('Error adding reflection:', error);
      Alert.alert('Error', 'Failed to add reflection. Please try again.');
    }
  }

  async function handleAcknowledge(item: BrainDumpItem) {
    try {
      setProcessing(item.id);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await acknowledgeBrainDump(item.id);

      removeItemWithAnimation(item.id, () => {
        showToast('✓ Acknowledged!');
      });
    } catch (error) {
      console.error('Error acknowledging item:', error);
      Alert.alert('Error', 'Failed to acknowledge item. Please try again.');
    } finally {
      setProcessing(null);
    }
  }

  function handleContinue() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push('/morning-spark/deposit-ideas');
  }

  function handleAdjust() {
    Alert.alert(
      'Process Remaining Items',
      'Use the quick actions above to process remaining items, or Accept & Continue to move forward.',
      [{ text: 'OK', style: 'default' }]
    );
  }

  function renderBrainDumpCard(item: BrainDumpItem) {
    const animatedStyle = {
      opacity: itemAnimations[item.id] || 1,
      transform: [
        {
          scale: itemAnimations[item.id]?.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1],
          }) || 1,
        },
      ],
    };

    const isProcessing = processing === item.id;

    return (
      <Animated.View key={item.id} style={[styles.brainDumpCard, { backgroundColor: colors.surface, borderColor: colors.border }, animatedStyle]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardContent, { color: colors.text }]}>{item.content}</Text>
          <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
            {formatBrainDumpTime(item.created_at)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDarkMode ? '#3B82F620' : '#3B82F610' }]}
            onPress={() => handleMakeTask(item)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <FileText size={18} color="#3B82F6" />
            <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>📋 Create Task</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDarkMode ? '#F59E0B20' : '#F59E0B10' }]}
            onPress={() => handleSaveIdea(item)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Lightbulb size={18} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>💡 Save as Idea</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' }]}
            onPress={() => handleAcknowledge(item)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <CheckCircle size={18} color="#10B981" />
            <Text style={[styles.actionButtonText, { color: '#10B981' }]}>✓ Acknowledge</Text>
          </TouchableOpacity>
        </View>

        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </Animated.View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasItems = brainDumpItems.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yesterday's Notes</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Yesterday's Brain Dump</Text>
          {fuelLevel && showDeferGate && (
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              You created some notes yesterday. Would you like to defer them so they don't weigh on you?
            </Text>
          )}
          {fuelLevel && !showDeferGate && (
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              {getBrainDumpMessage(fuelLevel)}
            </Text>
          )}
          {hasItems && showNotes && (
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {brainDumpItems.length} thought{brainDumpItems.length > 1 ? 's' : ''} from yesterday
            </Text>
          )}
        </View>

        {showDeferGate && (
          <View style={styles.deferGateContainer}>
            <TouchableOpacity
              style={[styles.deferButton, { backgroundColor: colors.primary }]}
              onPress={handleDefer}
              activeOpacity={0.8}
            >
              <Text style={styles.deferButtonText}>Yes, defer them</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewNotesButton, { borderColor: colors.border, backgroundColor: 'transparent' }]}
              onPress={handleViewNotes}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewNotesButtonText, { color: colors.text }]}>No, let me review</Text>
            </TouchableOpacity>
          </View>
        )}

        {!hasItems && !showDeferGate ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes from yesterday</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You're all clear!
            </Text>
          </View>
        ) : showNotes ? (
          <View style={styles.cardsContainer}>
            {brainDumpItems.map((item) => renderBrainDumpCard(item))}
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {!showDeferGate && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={reflectionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReflectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Reflection</Text>
              <TouchableOpacity
                onPress={() => setReflectionModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={[styles.selectedItemPreview, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                <Text style={[styles.selectedItemText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {selectedItem.content}
                </Text>
              </View>
            )}

            <TextInput
              style={[
                styles.reflectionInput,
                {
                  backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="What are your thoughts on this?"
              placeholderTextColor={colors.textSecondary}
              value={reflectionText}
              onChangeText={setReflectionText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setReflectionModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={submitReflection}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>Add Reflection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toast.visible && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
              opacity: toastOpacity,
            },
          ]}
        >
          <Text style={[styles.toastText, { color: colors.text }]}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
  },
  titleSection: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deferGateContainer: {
    gap: 12,
    paddingTop: 16,
    paddingBottom: 24,
  },
  deferButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deferButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  viewNotesButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  viewNotesButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 16,
  },
  brainDumpCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minWidth: 44,
    minHeight: 44,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedItemPreview: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedItemText: {
    fontSize: 14,
    lineHeight: 20,
  },
  reflectionInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 150,
    borderWidth: 1,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {},
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
