import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Users, Calendar, MessageSquare, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';

interface Delegate {
  id: string;
  name: string;
  email?: string;
}

interface DelegateModalProps {
  visible: boolean;
  task: {
    id: string;
    title: string;
  } | null;
  userId: string;
  onClose: () => void;
  onDelegate: (taskId: string, delegateId: string, dueDate: string | null, notes: string) => Promise<void>;
}

export function DelegateModal({
  visible,
  task,
  userId,
  onClose,
  onDelegate,
}: DelegateModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [selectedDelegate, setSelectedDelegate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewDelegateForm, setShowNewDelegateForm] = useState(false);
  const [newDelegateName, setNewDelegateName] = useState('');
  const [newDelegateEmail, setNewDelegateEmail] = useState('');

  useEffect(() => {
    if (visible) {
      loadDelegates();
      resetForm();
    }
  }, [visible, userId]);

  async function loadDelegates() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-delegates')
        .select('id, name, email')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;

      setDelegates(data || []);
    } catch (error) {
      console.error('Error loading delegates:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedDelegate(null);
    setDueDate(null);
    setNotes('');
    setShowNewDelegateForm(false);
    setNewDelegateName('');
    setNewDelegateEmail('');
  }

  async function handleCreateDelegate() {
    if (!newDelegateName.trim()) return;

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-delegates')
        .insert({
          user_id: userId,
          name: newDelegateName.trim(),
          email: newDelegateEmail.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setDelegates((prev) => [...prev, data]);
      setSelectedDelegate(data.id);
      setShowNewDelegateForm(false);
      setNewDelegateName('');
      setNewDelegateEmail('');
    } catch (error) {
      console.error('Error creating delegate:', error);
    }
  }

  async function handleSave() {
    if (!task || !selectedDelegate) return;

    try {
      setSaving(true);
      await onDelegate(
        task.id,
        selectedDelegate,
        dueDate ? dateToString(dueDate) : null,
        notes
      );
      onClose();
    } catch (error) {
      console.error('Error delegating task:', error);
    } finally {
      setSaving(false);
    }
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function dateToString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function adjustDate(days: number) {
    const baseDate = dueDate || new Date();
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + days);
    setDueDate(newDate);
  }

  if (!task) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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
              Delegate Task
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              disabled={saving}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={[styles.taskTitle, { color: colors.text }]}>
              {task.title}
            </Text>

            <View style={styles.section}>
              <View style={styles.sectionLabel}>
                <Users size={18} color={colors.textSecondary} />
                <Text style={[styles.sectionLabelText, { color: colors.textSecondary }]}>
                  Delegate To
                </Text>
              </View>

              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  {delegates.map((delegate) => (
                    <TouchableOpacity
                      key={delegate.id}
                      style={[
                        styles.delegateOption,
                        {
                          backgroundColor: colors.surface,
                          borderColor:
                            selectedDelegate === delegate.id
                              ? colors.primary
                              : colors.border,
                          borderWidth: selectedDelegate === delegate.id ? 2 : 1,
                        },
                      ]}
                      onPress={() => setSelectedDelegate(delegate.id)}
                    >
                      <View style={styles.delegateInfo}>
                        <Text style={[styles.delegateName, { color: colors.text }]}>
                          {delegate.name}
                        </Text>
                        {delegate.email && (
                          <Text style={[styles.delegateEmail, { color: colors.textSecondary }]}>
                            {delegate.email}
                          </Text>
                        )}
                      </View>
                      {selectedDelegate === delegate.id && (
                        <View
                          style={[
                            styles.selectedIndicator,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  ))}

                  {!showNewDelegateForm ? (
                    <TouchableOpacity
                      style={[
                        styles.addDelegateButton,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => setShowNewDelegateForm(true)}
                    >
                      <Plus size={20} color={colors.primary} />
                      <Text style={[styles.addDelegateText, { color: colors.primary }]}>
                        Add New Delegate
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.newDelegateForm, { backgroundColor: colors.surface }]}>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
                          },
                        ]}
                        placeholder="Name *"
                        placeholderTextColor={colors.textSecondary}
                        value={newDelegateName}
                        onChangeText={setNewDelegateName}
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
                          },
                        ]}
                        placeholder="Email (optional)"
                        placeholderTextColor={colors.textSecondary}
                        value={newDelegateEmail}
                        onChangeText={setNewDelegateEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                      <View style={styles.formButtons}>
                        <TouchableOpacity
                          style={[styles.formButton, { backgroundColor: colors.border }]}
                          onPress={() => {
                            setShowNewDelegateForm(false);
                            setNewDelegateName('');
                            setNewDelegateEmail('');
                          }}
                        >
                          <Text style={[styles.formButtonText, { color: colors.text }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.formButton,
                            { backgroundColor: colors.primary },
                          ]}
                          onPress={handleCreateDelegate}
                          disabled={!newDelegateName.trim()}
                        >
                          <Text style={styles.formButtonTextPrimary}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionLabel}>
                <Calendar size={18} color={colors.textSecondary} />
                <Text style={[styles.sectionLabelText, { color: colors.textSecondary }]}>
                  Due Date (Optional)
                </Text>
              </View>

              <View style={styles.dateControl}>
                <TouchableOpacity
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustDate(-1)}
                  disabled={!dueDate}
                >
                  <Text
                    style={[
                      styles.adjustButtonText,
                      { color: dueDate ? colors.text : colors.border },
                    ]}
                  >
                    -
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateDisplay,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    if (!dueDate) {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setDueDate(tomorrow);
                    }
                  }}
                >
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {dueDate ? formatDate(dueDate) : 'Set Date'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustDate(1)}
                  disabled={!dueDate}
                >
                  <Text
                    style={[
                      styles.adjustButtonText,
                      { color: dueDate ? colors.text : colors.border },
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>

                {dueDate && (
                  <TouchableOpacity
                    onPress={() => setDueDate(null)}
                    style={styles.clearDateButton}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionLabel}>
                <MessageSquare size={18} color={colors.textSecondary} />
                <Text style={[styles.sectionLabelText, { color: colors.textSecondary }]}>
                  Notes (Optional)
                </Text>
              </View>

              <TextInput
                style={[
                  styles.notesInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
                  },
                ]}
                placeholder="Add any context or instructions..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.surface }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.delegateButton,
                {
                  backgroundColor: selectedDelegate ? colors.primary : colors.border,
                },
              ]}
              onPress={handleSave}
              disabled={!selectedDelegate || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.delegateButtonText}>Delegate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 500,
    maxHeight: '90%',
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
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  delegateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  delegateInfo: {
    flex: 1,
  },
  delegateName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  delegateEmail: {
    fontSize: 13,
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  addDelegateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addDelegateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  newDelegateForm: {
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  formButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  formButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adjustButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  dateDisplay: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearDateButton: {
    padding: 8,
  },
  notesInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 100,
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
  delegateButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  delegateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
