import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { FollowUpItem, FollowUpItemData } from './FollowUpItem';
import { toLocalISOString } from '@/lib/dateUtils';

interface FollowUpSectionProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onItemActioned?: () => void;
}

interface GroupedItems {
  tasks: FollowUpItemData[];
  ideas: FollowUpItemData[];
  notes: FollowUpItemData[];
}

export function FollowUpSection({
  fuelLevel,
  userId,
  onItemActioned,
}: FollowUpSectionProps) {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpItemData[]>([]);
  const [collapsed, setCollapsed] = useState(fuelLevel === 1);
  const [delayModalVisible, setDelayModalVisible] = useState(false);
  const [delayItem, setDelayItem] = useState<FollowUpItemData | null>(null);
  const [delayDays, setDelayDays] = useState('7');

  useEffect(() => {
    loadFollowUps();
  }, [userId]);

  async function loadFollowUps() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('v_morning_spark_follow_ups')
        .select('*')
        .eq('user_id', userId)
        .order('follow_up_date', { ascending: true });

      if (error) throw error;

      setFollowUps((data || []) as FollowUpItemData[]);
    } catch (error) {
      console.error('Error loading follow-ups:', error);
      Alert.alert('Error', 'Failed to load follow-ups. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function groupItems(): GroupedItems {
    const groups: GroupedItems = {
      tasks: [],
      ideas: [],
      notes: [],
    };

    followUps.forEach((item) => {
      if (item.parent_type === 'task' || item.parent_type === 'event') {
        groups.tasks.push(item);
      } else if (item.parent_type === 'depositIdea') {
        groups.ideas.push(item);
      } else if (item.parent_type === 'reflection') {
        groups.notes.push(item);
      }
    });

    return groups;
  }

  async function handleTakeAction(item: FollowUpItemData) {
    try {
      setProcessing(item.follow_up_id);

      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      if (item.parent_type === 'task' || item.parent_type === 'event') {
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({
            due_date: today,
            is_important: true,
          })
          .eq('id', item.parent_id);

        if (error) throw error;
      } else if (item.parent_type === 'depositIdea') {
        const { data: taskData, error: taskError } = await supabase
          .from('0008-ap-tasks')
          .insert({
            user_id: userId,
            type: 'task',
            title: item.title,
            due_date: today,
            status: 'pending',
            is_important: true,
            is_urgent: false,
          })
          .select()
          .single();

        if (taskError) throw taskError;

        await supabase
          .from('0008-ap-deposit-ideas')
          .update({
            activated_at: toLocalISOString(new Date()),
            activated_task_id: taskData.id,
          })
          .eq('id', item.parent_id);
      } else if (item.parent_type === 'reflection') {
        await supabase
          .from('0008-ap-tasks')
          .insert({
            user_id: userId,
            type: 'task',
            title: `Review: ${item.title}`,
            due_date: today,
            status: 'pending',
            is_important: true,
            is_urgent: false,
          });
      }

      await supabase
        .from('0008-ap-universal-follow-up-join')
        .update({
          status: 'done',
          completed_at: toLocalISOString(new Date()),
        })
        .eq('id', item.follow_up_id);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setFollowUps((prev) => prev.filter((fu) => fu.follow_up_id !== item.follow_up_id));

      if (onItemActioned) {
        onItemActioned();
      }

      Alert.alert('Success', 'Item added to today\'s tasks!');
    } catch (error) {
      console.error('Error taking action:', error);
      Alert.alert('Error', 'Failed to take action. Please try again.');
    } finally {
      setProcessing(null);
    }
  }

  async function handleFileAway(item: FollowUpItemData) {
    try {
      setProcessing(item.follow_up_id);

      const supabase = getSupabaseClient();

      if (item.parent_type === 'depositIdea') {
        await supabase
          .from('0008-ap-deposit-ideas')
          .update({ archived: true })
          .eq('id', item.parent_id);
      } else if (item.parent_type === 'reflection') {
        await supabase
          .from('0008-ap-reflections')
          .update({ archived: true })
          .eq('id', item.parent_id);
      }

      await supabase
        .from('0008-ap-universal-follow-up-join')
        .update({
          status: 'done',
          completed_at: toLocalISOString(new Date()),
        })
        .eq('id', item.follow_up_id);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setFollowUps((prev) => prev.filter((fu) => fu.follow_up_id !== item.follow_up_id));

      if (onItemActioned) {
        onItemActioned();
      }

      Alert.alert('Success', 'Item filed away!');
    } catch (error) {
      console.error('Error filing away:', error);
      Alert.alert('Error', 'Failed to file away. Please try again.');
    } finally {
      setProcessing(null);
    }
  }

  function handleDelay(item: FollowUpItemData) {
    setDelayItem(item);
    setDelayModalVisible(true);
  }

  async function confirmDelay() {
    if (!delayItem) return;

    const days = parseInt(delayDays, 10);
    if (isNaN(days) || days < 1) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days.');
      return;
    }

    try {
      setProcessing(delayItem.follow_up_id);
      setDelayModalVisible(false);

      const supabase = getSupabaseClient();
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);

      await supabase
        .from('0008-ap-universal-follow-up-join')
        .update({
          follow_up_date: toLocalISOString(newDate).split('T')[0],
          status: 'snoozed',
        })
        .eq('id', delayItem.follow_up_id);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setFollowUps((prev) => prev.filter((fu) => fu.follow_up_id !== delayItem.follow_up_id));

      if (onItemActioned) {
        onItemActioned();
      }

      Alert.alert('Success', `Delayed for ${days} day${days > 1 ? 's' : ''}!`);
    } catch (error) {
      console.error('Error delaying:', error);
      Alert.alert('Error', 'Failed to delay. Please try again.');
    } finally {
      setProcessing(null);
      setDelayItem(null);
      setDelayDays('7');
    }
  }

  async function handleDismiss(item: FollowUpItemData) {
    Alert.alert(
      'Dismiss Follow-Up',
      'Are you sure you want to dismiss this follow-up? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(item.follow_up_id);

              const supabase = getSupabaseClient();

              await supabase
                .from('0008-ap-universal-follow-up-join')
                .update({
                  status: 'cancelled',
                  completed_at: toLocalISOString(new Date()),
                })
                .eq('id', item.follow_up_id);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              setFollowUps((prev) =>
                prev.filter((fu) => fu.follow_up_id !== item.follow_up_id)
              );

              if (onItemActioned) {
                onItemActioned();
              }
            } catch (error) {
              console.error('Error dismissing:', error);
              Alert.alert('Error', 'Failed to dismiss. Please try again.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  }

  function toggleCollapsed() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCollapsed(!collapsed);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (followUps.length === 0) {
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
          disabled={true}
        >
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            🔔 Follow Up (0)
          </Text>
          <Text style={[styles.collapsibleArrow, { color: colors.textSecondary }]}>
            ▶
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fuelLevel === 1 && collapsed) {
    return (
      <View style={styles.collapsedContainer}>
        <TouchableOpacity
          style={styles.collapsedHeader}
          onPress={toggleCollapsed}
          activeOpacity={0.7}
        >
          <View style={styles.collapsedInfo}>
            <Text style={[styles.collapsedTitle, { color: colors.textSecondary }]}>
              Follow-Ups Waiting
            </Text>
            <Text style={[styles.collapsedCount, { color: colors.textSecondary }]}>
              {followUps.length} item{followUps.length !== 1 ? 's' : ''} need attention
            </Text>
          </View>
          <ChevronDown size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  const groups = groupItems();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          These are the items you requested follow up for today.
        </Text>

        {fuelLevel === 1 && (
          <TouchableOpacity style={styles.collapseButton} onPress={toggleCollapsed}>
            <ChevronUp size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {groups.tasks.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>
            Tasks & Events ({groups.tasks.length})
          </Text>
          {groups.tasks.map((item) => (
            <FollowUpItem
              key={item.follow_up_id}
              item={item}
              onTakeAction={handleTakeAction}
              onFileAway={handleFileAway}
              onDelay={handleDelay}
              onDismiss={handleDismiss}
              disabled={processing !== null}
            />
          ))}
        </View>
      )}

      {groups.ideas.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>
            Deposit Ideas ({groups.ideas.length})
          </Text>
          {groups.ideas.map((item) => (
            <FollowUpItem
              key={item.follow_up_id}
              item={item}
              onTakeAction={handleTakeAction}
              onFileAway={handleFileAway}
              onDelay={handleDelay}
              onDismiss={handleDismiss}
              disabled={processing !== null}
            />
          ))}
        </View>
      )}

      {groups.notes.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>
            Notes ({groups.notes.length})
          </Text>
          {groups.notes.map((item) => (
            <FollowUpItem
              key={item.follow_up_id}
              item={item}
              onTakeAction={handleTakeAction}
              onFileAway={handleFileAway}
              onDelay={handleDelay}
              onDismiss={handleDismiss}
              disabled={processing !== null}
            />
          ))}
        </View>
      )}

      <Modal
        visible={delayModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDelayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Delay Follow-Up
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              How many days would you like to delay this?
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={delayDays}
              onChangeText={setDelayDays}
              keyboardType="number-pad"
              placeholder="7"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setDelayModalVisible(false);
                  setDelayItem(null);
                  setDelayDays('7');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={confirmDelay}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsibleArrow: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsedContainer: {
    padding: 20,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
  },
  collapsedInfo: {
    flex: 1,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  collapsedCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  collapseButton: {
    padding: 4,
    marginLeft: 12,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});