import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { X, Paperclip, Calendar as CalendarIcon } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate } from '@/lib/dateUtils';
import {
  saveReflection,
  updateReflection,
  archiveReflection,
  ReflectionWithRelations,
} from '@/lib/reflectionUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

interface Role {
  id: string;
  label: string;
  color?: string;
}

interface Domain {
  id: string;
  name: string;
  color?: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
}

interface JournalFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialData?: ReflectionWithRelations;
  onClose: () => void;
  onSaveSuccess?: () => void;
  onActionSelected?: (action: ActionType, data: ActionData) => void;
}

type ActionType = 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'followUp';

interface ActionData {
  notes: string;
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedKeyRelationshipIds: string[];
}

export default function JournalForm({
  visible,
  mode,
  initialData,
  onClose,
  onSaveSuccess,
  onActionSelected,
}: JournalFormProps) {
  const { colors, isDarkMode } = useTheme();

  const [content, setContent] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [filteredKeyRelationships, setFilteredKeyRelationships] = useState<KeyRelationship[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showFollowUpCalendar, setShowFollowUpCalendar] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchData();
      if (mode === 'edit' && initialData) {
        populateFormWithInitialData();
      } else {
        resetForm();
      }
    }
  }, [visible, mode, initialData]);

  useEffect(() => {
    // Filter key relationships based on selected roles
    if (selectedRoleIds.length > 0) {
      const filtered = keyRelationships.filter((kr) =>
        selectedRoleIds.includes(kr.role_id)
      );
      setFilteredKeyRelationships(filtered);
    } else {
      setFilteredKeyRelationships([]);
    }
  }, [selectedRoleIds, keyRelationships]);

  const populateFormWithInitialData = () => {
    if (!initialData) return;

    setContent(initialData.content || '');
    setSelectedRoleIds(initialData.roles?.map((r) => r.id) || []);
    setSelectedDomainIds(initialData.domains?.map((d) => d.id) || []);
    setSelectedKeyRelationshipIds(
      initialData.keyRelationships?.map((kr) => kr.id) || []
    );
    setFollowUpDate(initialData.follow_up_date || null);
  };

  const resetForm = () => {
    setContent('');
    setSelectedRoleIds([]);
    setSelectedDomainIds([]);
    setSelectedKeyRelationshipIds([]);
    setFollowUpDate(null);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [rolesData, domainsData, keyRelsData] = await Promise.all([
        supabase
          .from('0008-ap-roles')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true }),
        supabase
          .from('0008-ap-domains')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('0008-ap-key-relationships')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ]);

      if (rolesData.data) setRoles(rolesData.data);
      if (domainsData.data) setDomains(domainsData.data);
      if (keyRelsData.data) setKeyRelationships(keyRelsData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Required', 'Please write your reflection before saving.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (mode === 'edit' && initialData) {
        const success = await updateReflection(
          initialData.id,
          user.id,
          content,
          selectedRoleIds,
          selectedDomainIds,
          selectedKeyRelationshipIds,
          !!followUpDate,
          followUpDate || undefined
        );

        if (success) {
          Alert.alert('Success', 'Reflection updated successfully');
          eventBus.emit(EVENTS.REFLECTION_UPDATED);
          onSaveSuccess?.();
          onClose();
        } else {
          throw new Error('Failed to update reflection');
        }
      } else {
        const reflectionId = await saveReflection(
          user.id,
          content,
          selectedRoleIds,
          selectedDomainIds,
          selectedKeyRelationshipIds,
          'daily',
          !!followUpDate,
          followUpDate || undefined
        );

        if (reflectionId) {
          Alert.alert('Success', 'Reflection saved successfully');
          eventBus.emit(EVENTS.REFLECTION_CREATED);
          onSaveSuccess?.();
          onClose();
        } else {
          throw new Error('Failed to save reflection');
        }
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
      Alert.alert('Error', 'Failed to save reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;

    Alert.alert(
      'Delete Reflection',
      'Are you sure you want to delete this reflection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const supabase = getSupabaseClient();
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) throw new Error('User not authenticated');

              const success = await archiveReflection(initialData.id, user.id);

              if (success) {
                Alert.alert('Success', 'Reflection deleted successfully');
                eventBus.emit(EVENTS.REFLECTION_DELETED);
                onSaveSuccess?.();
                onClose();
              } else {
                throw new Error('Failed to delete reflection');
              }
            } catch (error) {
              console.error('Error deleting reflection:', error);
              Alert.alert('Error', 'Failed to delete reflection. Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleActionButton = (action: ActionType) => {
    if (!content.trim()) {
      Alert.alert('Required', 'Please write your reflection before proceeding.');
      return;
    }

    if (action === 'followUp') {
      setShowFollowUpCalendar(true);
    } else {
      const actionData: ActionData = {
        notes: content,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
      };
      onActionSelected?.(action, actionData);
      onClose();
    }
  };

  const handleFollowUpDateSelect = async (dateString: string) => {
    setFollowUpDate(dateString);
    setShowFollowUpCalendar(false);

    // Save reflection with follow-up date
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const reflectionId = await saveReflection(
        user.id,
        content,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
        'daily',
        true,
        dateString
      );

      if (reflectionId) {
        Alert.alert('Success', 'Reflection saved with follow-up date');
        eventBus.emit(EVENTS.REFLECTION_CREATED);
        onSaveSuccess?.();
        onClose();
      } else {
        throw new Error('Failed to save reflection');
      }
    } catch (error) {
      console.error('Error saving reflection with follow-up:', error);
      Alert.alert('Error', 'Failed to save reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleDomain = (domainId: string) => {
    setSelectedDomainIds((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId]
    );
  };

  const toggleKeyRelationship = (krId: string) => {
    setSelectedKeyRelationshipIds((prev) =>
      prev.includes(krId) ? prev.filter((id) => id !== krId) : [...prev, krId]
    );
  };

  const styles = getStyles(colors, isDarkMode);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'edit' ? 'Edit Reflection' : 'New Reflection'}
          </Text>
          <View style={styles.headerRight}>
            {mode === 'edit' && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
            {mode === 'create' && <View style={{ width: 60 }} />}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Reflection Content */}
            <View style={styles.section}>
              <Text style={styles.label}>Reflection</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Write your reflection..."
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Roles */}
            {roles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Roles</Text>
                <View style={styles.checkboxList}>
                  {roles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={styles.checkboxRow}
                      onPress={() => toggleRole(role.id)}
                    >
                      <View
                        style={[
                          styles.checkboxSquare,
                          { borderColor: colors.border },
                          selectedRoleIds.includes(role.id) && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        {selectedRoleIds.includes(role.id) && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Domains */}
            {domains.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Domains</Text>
                <View style={styles.checkboxList}>
                  {domains.map((domain) => (
                    <TouchableOpacity
                      key={domain.id}
                      style={styles.checkboxRow}
                      onPress={() => toggleDomain(domain.id)}
                    >
                      <View
                        style={[
                          styles.checkboxSquare,
                          { borderColor: colors.border },
                          selectedDomainIds.includes(domain.id) && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        {selectedDomainIds.includes(domain.id) && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                        {domain.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Key Relationships */}
            {filteredKeyRelationships.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Key Relationships</Text>
                <View style={styles.checkboxList}>
                  {filteredKeyRelationships.map((kr) => (
                    <TouchableOpacity
                      key={kr.id}
                      style={styles.checkboxRow}
                      onPress={() => toggleKeyRelationship(kr.id)}
                    >
                      <View
                        style={[
                          styles.checkboxSquare,
                          { borderColor: colors.border },
                          selectedKeyRelationshipIds.includes(kr.id) && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        {selectedKeyRelationshipIds.includes(kr.id) && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                        {kr.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Actions */}
            {mode === 'create' && (
              <View style={styles.section}>
                <Text style={styles.label}>Actions</Text>
                <Text style={styles.helperText}>
                  Do you want to take any of the following actions on this reflection?
                </Text>
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleActionButton('task')}
                  >
                    <Text style={styles.actionButtonText}>Create a Task</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleActionButton('event')}
                  >
                    <Text style={styles.actionButtonText}>Create an Event</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleActionButton('depositIdea')}
                  >
                    <Text style={styles.actionButtonText}>Create a Deposit Idea</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleActionButton('withdrawal')}
                  >
                    <Text style={styles.actionButtonText}>Create a Withdrawal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleActionButton('followUp')}
                  >
                    <Text style={styles.actionButtonText}>Follow Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {mode === 'edit' ? 'Update' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Follow-Up Calendar Modal */}
        <Modal
          visible={showFollowUpCalendar}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFollowUpCalendar(false)}
        >
          <View style={styles.calendarModalOverlay}>
            <View style={styles.calendarModalContent}>
              <View style={styles.calendarModalHeader}>
                <Text style={styles.calendarModalTitle}>Select Follow-Up Date</Text>
                <TouchableOpacity onPress={() => setShowFollowUpCalendar(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Calendar
                current={formatLocalDate(new Date())}
                minDate={formatLocalDate(new Date())}
                onDayPress={(day) => handleFollowUpDateSelect(day.dateString)}
                theme={{
                  backgroundColor: colors.surface,
                  calendarBackground: colors.surface,
                  textSectionTitleColor: colors.text,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: colors.primary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textSecondary,
                  monthTextColor: colors.text,
                  arrowColor: colors.primary,
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    closeButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    deleteButton: {
      padding: 8,
    },
    deleteText: {
      color: colors.error,
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    textArea: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      minHeight: 150,
      fontSize: 16,
      color: colors.text,
    },
    checkboxGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    checkbox: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxText: {
      fontSize: 14,
      color: colors.text,
    },
    checkboxTextSelected: {
      color: '#ffffff',
      fontWeight: '600',
    },
    actionButtonsContainer: {
      gap: 12,
    },
    actionButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    calendarModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarModalContent: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      width: '90%',
      maxWidth: 400,
    },
    calendarModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    calendarModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
  });
