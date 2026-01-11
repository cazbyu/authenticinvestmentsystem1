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
import { ChevronDown, ChevronUp, Target, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { DelegateItem, DelegationItemData } from './DelegateItem';
import { toLocalISOString } from '@/lib/dateUtils';

interface DelegationSectionProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onDelegationCompleted?: () => void;
}

export function DelegationSection({
  fuelLevel,
  userId,
  onDelegationCompleted,
}: DelegationSectionProps) {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<DelegationItemData[]>([]);
  const [collapsed, setCollapsed] = useState(fuelLevel === 1);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<DelegationItemData | null>(null);
  const [rescheduleDays, setRescheduleDays] = useState('3');

  useEffect(() => {
    loadDelegations();
  }, [userId]);

  async function loadDelegations() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('v_morning_spark_delegations')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });

      if (error) throw error;

      setDelegations((data || []) as DelegationItemData[]);
    } catch (error) {
      console.error('Error loading delegations:', error);
      Alert.alert('Error', 'Failed to load delegations. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckStatus(item: DelegationItemData) {
    Alert.alert(
      'Mark Complete',
      `Has ${item.delegate_name} completed "${item.task_title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Complete',
          style: 'default',
          onPress: async () => {
            try {
              setProcessing(item.delegation_id);

              const supabase = getSupabaseClient();

              await supabase
                .from('0008-ap-delegates')
                .update({
                  completed: true,
                  status: 'completed',
                })
                .eq('id', item.delegation_id);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              setDelegations((prev) =>
                prev.filter((d) => d.delegation_id !== item.delegation_id)
              );

              if (onDelegationCompleted) {
                onDelegationCompleted();
              }

              Alert.alert(
                'Success',
                'Delegation marked complete! Force multiplier bonus points earned.'
              );
            } catch (error) {
              console.error('Error marking complete:', error);
              Alert.alert('Error', 'Failed to mark complete. Please try again.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  }

  function handleSendReminder(item: DelegationItemData) {
    Alert.alert(
      'Coming Soon',
      'Send Reminder feature will allow you to notify your delegate via email or in-app notification.',
      [{ text: 'OK' }]
    );
  }

  function handleReschedule(item: DelegationItemData) {
    setRescheduleItem(item);
    setRescheduleModalVisible(true);
  }

  async function confirmReschedule() {
    if (!rescheduleItem) return;

    const days = parseInt(rescheduleDays, 10);
    if (isNaN(days) || days < 1) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days.');
      return;
    }

    try {
      setProcessing(rescheduleItem.delegation_id);
      setRescheduleModalVisible(false);

      const supabase = getSupabaseClient();
      const newDate = new Date(rescheduleItem.due_date);
      newDate.setDate(newDate.getDate() + days);

      await supabase
        .from('0008-ap-delegates')
        .update({
          due_date: toLocalISOString(newDate).split('T')[0],
        })
        .eq('id', rescheduleItem.delegation_id);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setDelegations((prev) =>
        prev.filter((d) => d.delegation_id !== rescheduleItem.delegation_id)
      );

      if (onDelegationCompleted) {
        onDelegationCompleted();
      }

      Alert.alert('Success', `Rescheduled for ${days} day${days > 1 ? 's' : ''} later!`);
    } catch (error) {
      console.error('Error rescheduling:', error);
      Alert.alert('Error', 'Failed to reschedule. Please try again.');
    } finally {
      setProcessing(null);
      setRescheduleItem(null);
      setRescheduleDays('3');
    }
  }

  async function handleCancel(item: DelegationItemData) {
    Alert.alert(
      'Cancel Delegation',
      `Are you sure you want to cancel this delegation to ${item.delegate_name}?`,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(item.delegation_id);

              const supabase = getSupabaseClient();

              await supabase
                .from('0008-ap-delegates')
                .update({
                  status: 'cancelled',
                })
                .eq('id', item.delegation_id);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              setDelegations((prev) =>
                prev.filter((d) => d.delegation_id !== item.delegation_id)
              );

              if (onDelegationCompleted) {
                onDelegationCompleted();
              }

              Alert.alert('Cancelled', 'Delegation has been cancelled.');
            } catch (error) {
              console.error('Error cancelling:', error);
              Alert.alert('Error', 'Failed to cancel. Please try again.');
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

  function getHeaderText(): string {
    if (fuelLevel === 3) {
      return 'Lead your team. Check these delegated items.';
    }
    return 'Delegated items due today';
  }

  function getHeaderIcon() {
    if (fuelLevel === 3) {
      return <Target size={24} color={colors.primary} />;
    }
    return <Users size={24} color={colors.primary} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (delegations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Users size={48} color={colors.textSecondary} opacity={0.5} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No delegated items due today.
        </Text>
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
              Delegations Waiting
            </Text>
            <Text style={[styles.collapsedCount, { color: colors.textSecondary }]}>
              {delegations.length} delegation{delegations.length !== 1 ? 's' : ''} due
            </Text>
          </View>
          <ChevronDown size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {getHeaderIcon()}
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.headerText,
                {
                  color: colors.text,
                  fontSize: fuelLevel === 3 ? 18 : 16,
                  fontWeight: fuelLevel === 3 ? '700' : '600',
                },
              ]}
            >
              {getHeaderText()}
            </Text>
            {fuelLevel === 3 && (
              <Text style={[styles.headerSubtext, { color: colors.textSecondary }]}>
                Leadership is multiplying yourself through others
              </Text>
            )}
          </View>
        </View>

        {fuelLevel === 1 && (
          <TouchableOpacity style={styles.collapseButton} onPress={toggleCollapsed}>
            <ChevronUp size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.list}>
        {delegations.map((item) => (
          <DelegateItem
            key={item.delegation_id}
            item={item}
            onCheckStatus={handleCheckStatus}
            onSendReminder={handleSendReminder}
            onReschedule={handleReschedule}
            onCancel={handleCancel}
            disabled={processing !== null}
          />
        ))}
      </View>

      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleModalVisible(false)}
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
              Reschedule Delegation
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              How many days would you like to push this forward?
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
              value={rescheduleDays}
              onChangeText={setRescheduleDays}
              keyboardType="number-pad"
              placeholder="3"
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
                  setRescheduleModalVisible(false);
                  setRescheduleItem(null);
                  setRescheduleDays('3');
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
                onPress={confirmReschedule}
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
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
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
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerText: {
    lineHeight: 24,
  },
  headerSubtext: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  collapseButton: {
    padding: 4,
    marginLeft: 12,
  },
  list: {
    gap: 0,
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
