import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { X, Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

interface Role {
  id: string;
  label: string;
  color?: string;
}

interface Domain {
  id: string;
  name: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
}

interface Note {
  id?: string;
  content: string;
  created_at: string;
}

interface GoalData {
  id: string;
  title: string;
  description?: string;
  goal_type: '12week' | 'custom';
  status?: string;
  roles?: Role[];
  domains?: Domain[];
  keyRelationships?: KeyRelationship[];
  notes?: Note[];
}

interface EditGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
  goal: GoalData | null;
  deleteGoal: (goalId: string, goalType: '12week' | 'custom') => Promise<void>;
}

export function EditGoalModal({
  visible,
  onClose,
  onUpdate,
  goal,
  deleteGoal,
}: EditGoalModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

  // Multi-select states
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  // Options data
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);

  // Collapsible section states
  const [domainsExpanded, setDomainsExpanded] = useState(false);
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const [keyRelationshipsExpanded, setKeyRelationshipsExpanded] = useState(false);

  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  useEffect(() => {
    if (visible && goal) {
      loadGoalData();
      fetchOptions();
    } else if (!visible) {
      // Reset state when modal closes
      resetState();
    }
  }, [visible, goal]);

  const resetState = () => {
    setTitle('');
    setDescription('');
    setNewNoteText('');
    setSelectedRoleIds([]);
    setSelectedDomainIds([]);
    setSelectedKeyRelationshipIds([]);
    setAllRoles([]);
    setAllDomains([]);
    setAllKeyRelationships([]);
    setDomainsExpanded(false);
    setRolesExpanded(false);
    setKeyRelationshipsExpanded(false);
    setLoading(true);
    setSaving(false);
  };

  const loadGoalData = () => {
    if (!goal) return;

    console.log('[EditGoalModal] Loading goal data:', {
      id: goal.id,
      title: goal.title,
      goal_type: goal.goal_type,
      roles: goal.roles,
      domains: goal.domains,
      keyRelationships: goal.keyRelationships,
      notes: goal.notes,
    });

    setTitle(goal.title);
    setDescription(goal.description || '');

    // Load existing associations
    const roleIds = goal.roles?.map(r => r.id) || [];
    const domainIds = goal.domains?.map(d => d.id) || [];
    const krIds = goal.keyRelationships?.map(kr => kr.id) || [];

    console.log('[EditGoalModal] Setting selected IDs:', {
      roleIds,
      domainIds,
      krIds,
    });

    setSelectedRoleIds(roleIds);
    setSelectedDomainIds(domainIds);
    setSelectedKeyRelationshipIds(krIds);

    // Auto-expand sections with selections
    if (roleIds.length > 0) setRolesExpanded(true);
    if (domainIds.length > 0) setDomainsExpanded(true);
    if (krIds.length > 0) setKeyRelationshipsExpanded(true);
  };

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData },
      ] = await Promise.all([
        supabase
          .from('0008-ap-roles')
          .select('id, label, color')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('label'),
        supabase
          .from('0008-ap-domains')
          .select('id, name')
          .order('name'),
        supabase
          .from('0008-ap-key-relationships')
          .select('id, name, role_id')
          .eq('user_id', user.id)
          .order('name'),
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(krData || []);
    } catch (error) {
      console.error('[EditGoalModal] Error fetching options:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to load options.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (
    field: 'roles' | 'domains' | 'keyRelationships',
    id: string
  ) => {
    let setter: React.Dispatch<React.SetStateAction<string[]>>;
    let currentSelection: string[];

    switch (field) {
      case 'roles':
        setter = setSelectedRoleIds;
        currentSelection = selectedRoleIds;
        break;
      case 'domains':
        setter = setSelectedDomainIds;
        currentSelection = selectedDomainIds;
        break;
      case 'keyRelationships':
        setter = setSelectedKeyRelationshipIds;
        currentSelection = selectedKeyRelationshipIds;
        break;
      default:
        return;
    }

    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter(itemId => itemId !== id)
      : [...currentSelection, id];
    setter(newSelection);
  };

  const handleSave = async () => {
    if (!goal || !title.trim()) {
      Alert.alert('Error', 'Goal title cannot be empty.');
      return;
    }

    console.log('[EditGoalModal] Saving goal:', {
      id: goal.id,
      title: title.trim(),
      goal_type: goal.goal_type,
      selectedRoleIds,
      selectedDomainIds,
      selectedKeyRelationshipIds,
    });

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // 1. Update main goal data
      const tableName =
        goal.goal_type === '12week'
          ? '0008-ap-goals-12wk'
          : '0008-ap-goals-custom';
      console.log('[EditGoalModal] Updating table:', tableName);

      const { error: goalUpdateError } = await supabase
        .from(tableName)
        .update({
          title: title.trim(),
          description: description.trim() || null,
          updated_at: toLocalISOString(new Date()),
        })
        .eq('id', goal.id);

      if (goalUpdateError) {
        console.error('[EditGoalModal] Goal update error:', goalUpdateError);
        throw goalUpdateError;
      }
      console.log('[EditGoalModal] Goal updated successfully');

      // 2. Handle Joins (Roles, Domains, Key Relationships)
      const updateJoins = async (
        joinTableName: string,
        childIdField: string,
        currentLinkedIds: string[],
        newLinkedIds: string[]
      ) => {
        const toAdd = newLinkedIds.filter(id => !currentLinkedIds.includes(id));
        const toRemove = currentLinkedIds.filter(id => !newLinkedIds.includes(id));

        console.log('[EditGoalModal] Updating joins for', joinTableName, ':', {
          toAdd: toAdd.length,
          toRemove: toRemove.length,
        });

        if (toRemove.length > 0) {
          const { error } = await supabase
            .from(joinTableName)
            .delete()
            .eq('parent_id', goal.id)
            .in(childIdField, toRemove);
          if (error) throw error;
        }

        if (toAdd.length > 0) {
          const parentType =
            goal.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal';
          const inserts = toAdd.map(id => ({
            parent_id: goal.id,
            parent_type: parentType,
            [childIdField]: id,
            user_id: user.id,
          }));
          const { error } = await supabase.from(joinTableName).insert(inserts);
          if (error) throw error;
        }
      };

      // Fetch current joins for comparison
      const parentType =
        goal.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal';
      console.log(
        '[EditGoalModal] Fetching current joins with parent_type:',
        parentType
      );

      const [
        { data: currentRolesJoins },
        { data: currentDomainsJoins },
        { data: currentKRsJoins },
      ] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('role_id')
          .eq('parent_id', goal.id)
          .eq('parent_type', parentType),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('domain_id')
          .eq('parent_id', goal.id)
          .eq('parent_type', parentType),
        supabase
          .from('0008-ap-universal-key-relationships-join')
          .select('key_relationship_id')
          .eq('parent_id', goal.id)
          .eq('parent_type', parentType),
      ]);

      const currentRoleIds = currentRolesJoins?.map(j => j.role_id) || [];
      const currentDomainIds = currentDomainsJoins?.map(j => j.domain_id) || [];
      const currentKRIds =
        currentKRsJoins?.map(j => j.key_relationship_id) || [];

      await Promise.all([
        updateJoins(
          '0008-ap-universal-roles-join',
          'role_id',
          currentRoleIds,
          selectedRoleIds
        ),
        updateJoins(
          '0008-ap-universal-domains-join',
          'domain_id',
          currentDomainIds,
          selectedDomainIds
        ),
        updateJoins(
          '0008-ap-universal-key-relationships-join',
          'key_relationship_id',
          currentKRIds,
          selectedKeyRelationshipIds
        ),
      ]);

      // 3. Add new note if provided
      if (newNoteText.trim()) {
        console.log('[EditGoalModal] Adding new note');
        const { data: newNote, error: newNoteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: newNoteText.trim() })
          .select('id')
          .single();
        if (newNoteError) throw newNoteError;

        const noteParentType =
          goal.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal';
        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            parent_id: goal.id,
            parent_type: noteParentType,
            note_id: newNote.id,
            user_id: user.id,
          });
        if (noteJoinError) throw noteJoinError;
      }

      console.log('[EditGoalModal] Goal save completed successfully');

      // Emit event for other components to refresh
      eventBus.emit(EVENTS.GOAL_UPDATED, {
        goalId: goal.id,
        goalType: goal.goal_type,
      });

      Alert.alert('Success', 'Goal updated successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('[EditGoalModal] Error saving goal:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    console.log('[EditGoalModal] Delete button clicked, goal:', goal?.id);
    if (!goal) return;
    setShowConfirmDeleteModal(true);
  };

  const confirmDelete = async () => {
    console.log('[EditGoalModal] Delete confirmed, starting deletion process...');
    if (!goal) return;

    try {
      setSaving(true);
      setShowConfirmDeleteModal(false);

      // Use the soft delete function passed as prop
      await deleteGoal(goal.id, goal.goal_type);
      console.log('[EditGoalModal] Goal soft deleted successfully');

      // Emit event for other components to refresh
      eventBus.emit(EVENTS.GOAL_DELETED, {
        goalId: goal.id,
        goalType: goal.goal_type,
      });

      Alert.alert('Success', 'Goal cancelled successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('[EditGoalModal] Error deleting goal:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to cancel goal.');
    } finally {
      setSaving(false);
    }
  };

  // Get selected counts for section headers
  const getSelectedCount = (type: 'roles' | 'domains' | 'keyRelationships') => {
    switch (type) {
      case 'roles':
        return selectedRoleIds.length;
      case 'domains':
        return selectedDomainIds.length;
      case 'keyRelationships':
        return selectedKeyRelationshipIds.length;
      default:
        return 0;
    }
  };

  // Filter key relationships based on selected roles
  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
    selectedRoleIds.includes(kr.role_id)
  );

  if (!goal) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Goal</Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!title.trim() || saving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0078d4" />
                <Text style={styles.loadingText}>Loading data...</Text>
              </View>
            ) : (
              <View style={styles.form}>
                {/* Goal Type Badge */}
                <View style={styles.typeBadgeContainer}>
                  <View
                    style={[
                      styles.typeBadge,
                      goal.goal_type === '12week' && { backgroundColor: '#dbeafe' },
                      goal.goal_type === 'custom' && { backgroundColor: '#f3e8ff' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        goal.goal_type === '12week' && { color: '#1e40af' },
                        goal.goal_type === 'custom' && { color: '#7c3aed' },
                      ]}
                    >
                      {goal.goal_type === '12week' ? '12-Week Goal' : 'Custom Goal'}
                    </Text>
                  </View>
                </View>

                {/* Goal Title */}
                <View style={styles.field}>
                  <Text style={styles.label}>Goal Title *</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter goal title"
                    placeholderTextColor="#9ca3af"
                    maxLength={100}
                  />
                </View>

                {/* Goal Description */}
                <View style={styles.field}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe your goal and why it matters..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                  />
                </View>

                {/* Wellness Zones - Collapsible */}
                <View style={styles.collapsibleSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setDomainsExpanded(!domainsExpanded)}
                  >
                    <View style={styles.collapsibleHeaderLeft}>
                      <Text style={styles.collapsibleLabel}>Wellness Zones</Text>
                      {getSelectedCount('domains') > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>
                            {getSelectedCount('domains')}
                          </Text>
                        </View>
                      )}
                    </View>
                    {domainsExpanded ? (
                      <ChevronUp size={20} color="#6b7280" />
                    ) : (
                      <ChevronDown size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>

                  {domainsExpanded && (
                    <View style={styles.collapsibleContent}>
                      <View style={styles.toggleGrid}>
                        {allDomains.map(domain => {
                          const isSelected = selectedDomainIds.includes(domain.id);
                          return (
                            <View key={domain.id} style={styles.toggleGridItem}>
                              <Text style={styles.toggleLabel} numberOfLines={1}>
                                {domain.name}
                              </Text>
                              <Switch
                                value={isSelected}
                                onValueChange={() =>
                                  handleToggleSelect('domains', domain.id)
                                }
                                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                                thumbColor="#ffffff"
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* Roles - Collapsible */}
                <View style={styles.collapsibleSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setRolesExpanded(!rolesExpanded)}
                  >
                    <View style={styles.collapsibleHeaderLeft}>
                      <Text style={styles.collapsibleLabel}>Roles</Text>
                      {getSelectedCount('roles') > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>
                            {getSelectedCount('roles')}
                          </Text>
                        </View>
                      )}
                    </View>
                    {rolesExpanded ? (
                      <ChevronUp size={20} color="#6b7280" />
                    ) : (
                      <ChevronDown size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>

                  {rolesExpanded && (
                    <View style={styles.collapsibleContent}>
                      <View style={styles.toggleGrid}>
                        {allRoles.map(role => {
                          const isSelected = selectedRoleIds.includes(role.id);
                          return (
                            <View key={role.id} style={styles.toggleGridItem}>
                              <Text style={styles.toggleLabel} numberOfLines={1}>
                                {role.label}
                              </Text>
                              <Switch
                                value={isSelected}
                                onValueChange={() =>
                                  handleToggleSelect('roles', role.id)
                                }
                                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                                thumbColor="#ffffff"
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* Key Relationships - Collapsible (filtered by selected roles) */}
                {filteredKeyRelationships.length > 0 && (
                  <View style={styles.collapsibleSection}>
                    <TouchableOpacity
                      style={styles.collapsibleHeader}
                      onPress={() =>
                        setKeyRelationshipsExpanded(!keyRelationshipsExpanded)
                      }
                    >
                      <View style={styles.collapsibleHeaderLeft}>
                        <Text style={styles.collapsibleLabel}>Key Relationships</Text>
                        {getSelectedCount('keyRelationships') > 0 && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>
                              {getSelectedCount('keyRelationships')}
                            </Text>
                          </View>
                        )}
                      </View>
                      {keyRelationshipsExpanded ? (
                        <ChevronUp size={20} color="#6b7280" />
                      ) : (
                        <ChevronDown size={20} color="#6b7280" />
                      )}
                    </TouchableOpacity>

                    {keyRelationshipsExpanded && (
                      <View style={styles.collapsibleContent}>
                        <View style={styles.toggleGrid}>
                          {filteredKeyRelationships.map(kr => {
                            const isSelected = selectedKeyRelationshipIds.includes(
                              kr.id
                            );
                            return (
                              <View key={kr.id} style={styles.toggleGridItem}>
                                <Text style={styles.toggleLabel} numberOfLines={1}>
                                  {kr.name}
                                </Text>
                                <Switch
                                  value={isSelected}
                                  onValueChange={() =>
                                    handleToggleSelect('keyRelationships', kr.id)
                                  }
                                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                                  thumbColor="#ffffff"
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Existing Notes - Read Only Display */}
                {goal.notes && goal.notes.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Previous Notes</Text>
                    <View style={styles.existingNotesContainer}>
                      {goal.notes.map((note, index) => (
                        <View key={note.id || index} style={styles.existingNoteItem}>
                          <Text style={styles.existingNoteContent}>
                            {note.content}
                          </Text>
                          <Text style={styles.existingNoteDate}>
                            {new Date(note.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Add New Note */}
                <View style={styles.field}>
                  <Text style={styles.label}>Add New Note</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={newNoteText}
                    onChangeText={setNewNoteText}
                    placeholder="Write a new note for this goal..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                  />
                </View>

                {/* Delete Button */}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={saving}
                >
                  <Trash2 size={18} color="#dc2626" />
                  <Text style={styles.deleteButtonText}>Cancel Goal</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal
        visible={showConfirmDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDeleteModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmTitle}>Cancel Goal</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to cancel this goal? This will mark it as
              cancelled and remove it from your active goals. This action cannot be
              undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setShowConfirmDeleteModal(false)}
                disabled={saving}
              >
                <Text style={styles.confirmCancelButtonText}>Keep Goal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  saving && styles.confirmDeleteButtonDisabled,
                ]}
                onPress={confirmDelete}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Cancel Goal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    padding: 16,
  },
  typeBadgeContainer: {
    marginBottom: 20,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  // Collapsible Section Styles
  collapsibleSection: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  countBadge: {
    backgroundColor: '#0078d4',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  collapsibleContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  // 2-Column Toggle Grid
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  toggleGridItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  // Existing Notes
  existingNotesContainer: {
    gap: 8,
  },
  existingNoteItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  existingNoteContent: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  existingNoteDate: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // Delete Button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 32,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  // Confirmation Modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmCancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmDeleteButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmDeleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditGoalModal;