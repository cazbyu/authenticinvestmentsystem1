import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { X, ChevronDown, ChevronUp, Trash2, Paperclip } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { toLocalISOString, formatLocalDate } from '@/lib/dateUtils';
import { 
  uploadNoteAttachment, 
  saveNoteAttachmentMetadata, 
  fetchAttachmentsForNotes,
  NoteAttachment 
} from '@/lib/noteAttachmentUtils';
import * as DocumentPicker from 'expo-document-picker';

// Interfaces
interface Role {
  id: string;
  title: string;
}

interface Domain {
  id: string;
  name: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id?: string;
}

interface Note {
  id: string;
  content?: string;
  note_text?: string;
  created_at: string;
  attachments?: NoteAttachment[];
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

interface SelectedFile {
  uri: string;
  name: string;
  type: string;
  size: number;
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
  const { colors } = useTheme();
  
  // Form state - use empty defaults, will be set in useEffect
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState<SelectedFile[]>([]);
  
  // Selection state
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);
  
  // Available options
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [availableDomains, setAvailableDomains] = useState<Domain[]>([]);
  const [availableKeyRelationships, setAvailableKeyRelationships] = useState<KeyRelationship[]>([]);
  const [previousNotes, setPreviousNotes] = useState<Note[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Collapsible sections
  const [domainsExpanded, setDomainsExpanded] = useState(true);
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const [keyRelationshipsExpanded, setKeyRelationshipsExpanded] = useState(false);

  // Load data function using useCallback
  const loadData = useCallback(async () => {
    if (!goal) return;
    
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch available roles - column is 'label' not 'title'
      const { data: rolesData } = await supabase
        .from('0008-ap-roles')
        .select('id, label')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('label');
      
      // Map to expected format
      setAvailableRoles((rolesData || []).map(r => ({ id: r.id, title: r.label })));

      // Fetch available domains (wellness zones) - no user_id filter, they're global
      const { data: domainsData } = await supabase
        .from('0008-ap-domains')
        .select('id, name')
        .order('name');
      
      setAvailableDomains(domainsData || []);

      // Fetch available key relationships - they have role_id for filtering
      const { data: keyRelData } = await supabase
        .from('0008-ap-key-relationships')
        .select('id, name, role_id')
        .eq('user_id', user.id)
        .order('name');
      
      setAvailableKeyRelationships(keyRelData || []);

      // Determine parent_type based on goal type
      // 12-week goals use 'goal', custom goals use 'custom_goal'
      const parentType = goal.goal_type === '12week' ? 'goal' : 'custom_goal';

      // Fetch current role associations from universal-roles-join
      const { data: roleJoins, error: roleErr } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('role_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);
      
      if (roleErr) console.error('[EditGoalModal] Role fetch error:', roleErr);
      const currentRoleIds = roleJoins?.map(j => j.role_id).filter(Boolean) || [];
      setSelectedRoleIds(currentRoleIds);
      console.log('[EditGoalModal] Current roles:', currentRoleIds);

      // Fetch current domain associations from universal-domains-join
      const { data: domainJoins, error: domainErr } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('domain_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);
      
      if (domainErr) console.error('[EditGoalModal] Domain fetch error:', domainErr);
      const currentDomainIds = domainJoins?.map(j => j.domain_id).filter(Boolean) || [];
      setSelectedDomainIds(currentDomainIds);
      console.log('[EditGoalModal] Current domains:', currentDomainIds);

      // Fetch current key relationship associations from universal-key-relationships-join
      const { data: keyRelJoins, error: krErr } = await supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('key_relationship_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);
      
      if (krErr) console.error('[EditGoalModal] KR fetch error:', krErr);
      const currentKeyRelIds = keyRelJoins?.map(j => j.key_relationship_id).filter(Boolean) || [];
      setSelectedKeyRelationshipIds(currentKeyRelIds);
      console.log('[EditGoalModal] Current key relationships:', currentKeyRelIds);

      // Fetch existing notes for this goal (using same parentType)
      const { data: noteJoins } = await supabase
        .from('0008-ap-universal-notes-join')
        .select('note_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);

      const noteIds = noteJoins?.map(j => j.note_id).filter(Boolean) || [];
      
      if (noteIds.length > 0) {
        const { data: notesData } = await supabase
          .from('0008-ap-notes')
          .select('id, content, note_text, created_at')
          .in('id', noteIds)
          .order('created_at', { ascending: false });
        
        // Fetch attachments for all notes
        const notesWithAttachments: Note[] = notesData || [];
        if (notesWithAttachments.length > 0) {
          const attachmentsMap = await fetchAttachmentsForNotes(noteIds);
          notesWithAttachments.forEach(note => {
            note.attachments = attachmentsMap.get(note.id) || [];
          });
        }
        
        setPreviousNotes(notesWithAttachments);
        console.log('[EditGoalModal] Previous notes with attachments:', notesWithAttachments.length);
      } else {
        setPreviousNotes([]);
      }

      // Auto-expand sections that have selections
      if (currentDomainIds.length > 0) setDomainsExpanded(true);
      if (currentRoleIds.length > 0) setRolesExpanded(true);
      if (currentKeyRelIds.length > 0) setKeyRelationshipsExpanded(true);

    } catch (error) {
      console.error('[EditGoalModal] Error loading data:', error);
      Alert.alert('Error', 'Failed to load goal data');
    } finally {
      setLoading(false);
    }
  }, [goal?.id, goal?.goal_type]);

  // Reset and load data when modal opens
  useEffect(() => {
    if (visible && goal) {
      console.log('[EditGoalModal] Modal opened for goal:', goal.id, goal.title);
      setTitle(goal.title || '');
      setDescription(goal.description || '');
      setNewNoteText('');
      setNewNoteAttachments([]);
      loadData();
    }
  }, [visible, goal?.id, loadData]);

  // Early return if no goal - MUST be after all hooks
  if (!goal) {
    return null;
  }

  // Toggle handlers
  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const toggleDomain = (domainId: string) => {
    setSelectedDomainIds(prev => 
      prev.includes(domainId) 
        ? prev.filter(id => id !== domainId)
        : [...prev, domainId]
    );
  };

  const toggleKeyRelationship = (keyRelId: string) => {
    setSelectedKeyRelationshipIds(prev => 
      prev.includes(keyRelId) 
        ? prev.filter(id => id !== keyRelId)
        : [...prev, keyRelId]
    );
  };

  // File picker for attachments
  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const files: SelectedFile[] = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      }));

      // Check file sizes (5MB limit)
      const oversizedFiles = files.filter(f => f.size > 5 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        Alert.alert('File Too Large', 'Files must be under 5MB each');
        return;
      }

      setNewNoteAttachments(prev => [...prev, ...files]);
      console.log('[EditGoalModal] Added attachments:', files.length);
    } catch (error) {
      console.error('[EditGoalModal] Error picking file:', error);
      Alert.alert('Error', 'Failed to select file');
    }
  };

  const removeAttachment = (index: number) => {
    setNewNoteAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Save handler
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Goal title is required');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine table based on goal type
      const tableName = goal.goal_type === '12week' ? '0008-ap-goals-12wk' : '0008-ap-goals-custom';
      // Parent type for universal join tables: 'goal' for 12-week, 'custom_goal' for custom
      const parentType = goal.goal_type === '12week' ? 'goal' : 'custom_goal';

      // 1. Update the goal itself
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          title: title.trim(),
          description: description.trim() || null,
          updated_at: toLocalISOString(new Date()),
        })
        .eq('id', goal.id);

      if (updateError) throw updateError;
      console.log('[EditGoalModal] Goal updated successfully');

      // 2. Sync role associations via universal-roles-join
      const { data: currentRoleJoins } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('id, role_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);

      const currentRoleIdSet = new Set(currentRoleJoins?.map(j => j.role_id) || []);
      const newRoleIdSet = new Set(selectedRoleIds);

      // Delete removed roles
      const rolesToRemove = currentRoleJoins?.filter(j => !newRoleIdSet.has(j.role_id)) || [];
      if (rolesToRemove.length > 0) {
        await supabase
          .from('0008-ap-universal-roles-join')
          .delete()
          .in('id', rolesToRemove.map(j => j.id));
        console.log('[EditGoalModal] Removed roles:', rolesToRemove.length);
      }

      // Add new roles
      const rolesToAdd = selectedRoleIds.filter(id => !currentRoleIdSet.has(id));
      if (rolesToAdd.length > 0) {
        await supabase
          .from('0008-ap-universal-roles-join')
          .insert(rolesToAdd.map(roleId => ({
            parent_id: goal.id,
            parent_type: parentType,
            role_id: roleId,
            user_id: user.id,
          })));
        console.log('[EditGoalModal] Added roles:', rolesToAdd.length);
      }

      // 3. Sync domain associations via universal-domains-join
      const { data: currentDomainJoins } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('id, domain_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);

      const currentDomainIdSet = new Set(currentDomainJoins?.map(j => j.domain_id) || []);
      const newDomainIdSet = new Set(selectedDomainIds);

      // Delete removed domains
      const domainsToRemove = currentDomainJoins?.filter(j => !newDomainIdSet.has(j.domain_id)) || [];
      if (domainsToRemove.length > 0) {
        await supabase
          .from('0008-ap-universal-domains-join')
          .delete()
          .in('id', domainsToRemove.map(j => j.id));
        console.log('[EditGoalModal] Removed domains:', domainsToRemove.length);
      }

      // Add new domains
      const domainsToAdd = selectedDomainIds.filter(id => !currentDomainIdSet.has(id));
      if (domainsToAdd.length > 0) {
        await supabase
          .from('0008-ap-universal-domains-join')
          .insert(domainsToAdd.map(domainId => ({
            parent_id: goal.id,
            parent_type: parentType,
            domain_id: domainId,
            user_id: user.id,
          })));
        console.log('[EditGoalModal] Added domains:', domainsToAdd.length);
      }

      // 4. Sync key relationship associations via universal-key-relationships-join
      const { data: currentKeyRelJoins } = await supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('id, key_relationship_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);

      const currentKeyRelIdSet = new Set(currentKeyRelJoins?.map(j => j.key_relationship_id) || []);
      const newKeyRelIdSet = new Set(selectedKeyRelationshipIds);

      // Delete removed key relationships
      const keyRelsToRemove = currentKeyRelJoins?.filter(j => !newKeyRelIdSet.has(j.key_relationship_id)) || [];
      if (keyRelsToRemove.length > 0) {
        await supabase
          .from('0008-ap-universal-key-relationships-join')
          .delete()
          .in('id', keyRelsToRemove.map(j => j.id));
        console.log('[EditGoalModal] Removed key relationships:', keyRelsToRemove.length);
      }

      // Add new key relationships
      const keyRelsToAdd = selectedKeyRelationshipIds.filter(id => !currentKeyRelIdSet.has(id));
      if (keyRelsToAdd.length > 0) {
        await supabase
          .from('0008-ap-universal-key-relationships-join')
          .insert(keyRelsToAdd.map(keyRelId => ({
            parent_id: goal.id,
            parent_type: parentType,
            key_relationship_id: keyRelId,
            user_id: user.id,
          })));
        console.log('[EditGoalModal] Added key relationships:', keyRelsToAdd.length);
      }

      // 5. Add new note with attachments if provided
      if (newNoteText.trim() || newNoteAttachments.length > 0) {
        // Create the note in 0008-ap-notes
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: newNoteText.trim() || 'Attached files',
          })
          .select()
          .single();

        if (noteError) throw noteError;
        console.log('[EditGoalModal] Note created:', noteData.id);

        // Link note to goal via universal join (use same parentType)
        const { error: joinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            note_id: noteData.id,
            parent_id: goal.id,
            parent_type: parentType,
            user_id: user.id,
          });

        if (joinError) throw joinError;
        console.log('[EditGoalModal] Note linked to goal');

        // Upload attachments to storage and save metadata
        if (newNoteAttachments.length > 0) {
          for (const file of newNoteAttachments) {
            try {
              // Fetch file data
              let fileData: Blob;
              if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                fileData = await response.blob();
              } else {
                const response = await fetch(file.uri);
                fileData = await response.blob();
              }

              // Upload to storage
              const filePath = await uploadNoteAttachment(
                fileData,
                file.name,
                file.type,
                user.id
              );

              if (filePath) {
                // Save metadata to 0008-ap-note-attachments
                await saveNoteAttachmentMetadata(
                  noteData.id,
                  user.id,
                  file.name,
                  filePath,
                  file.type,
                  file.size
                );
                console.log('[EditGoalModal] Attachment saved:', file.name);
              }
            } catch (attachError) {
              console.error('[EditGoalModal] Error uploading attachment:', attachError);
            }
          }
        }
      }

      // Emit event for other components to refresh
      eventBus.emit(EVENTS.GOAL_UPDATED, { goalId: goal.id, goalType: goal.goal_type });

      onUpdate();
      onClose();
      Alert.alert('Success', 'Goal updated successfully');

    } catch (error) {
      console.error('[EditGoalModal] Error saving:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    try {
      await deleteGoal(goal.id, goal.goal_type);
      eventBus.emit(EVENTS.GOAL_DELETED, { goalId: goal.id, goalType: goal.goal_type });
      setShowDeleteConfirm(false);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('[EditGoalModal] Error deleting goal:', error);
      Alert.alert('Error', 'Failed to cancel goal');
    }
  };

  // Filter key relationships by selected roles
  const filteredKeyRelationships = availableKeyRelationships.filter(kr => 
    !kr.role_id || selectedRoleIds.includes(kr.role_id)
  );

  // Render collapsible section header
  const renderSectionHeader = (
    title: string,
    count: number,
    expanded: boolean,
    onToggle: () => void
  ) => (
    <TouchableOpacity 
      style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
      onPress={onToggle}
    >
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      {expanded ? (
        <ChevronUp size={20} color={colors.textSecondary} />
      ) : (
        <ChevronDown size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  // Render 2-column toggle grid
  const renderToggleGrid = (
    items: Array<{ id: string; title?: string; name?: string }>,
    selectedIds: string[],
    onToggle: (id: string) => void
  ) => (
    <View style={styles.toggleGrid}>
      {items.map(item => (
        <View key={item.id} style={styles.toggleItem}>
          <Text 
            style={[styles.toggleLabel, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.title || item.name}
          </Text>
          <Switch
            value={selectedIds.includes(item.id)}
            onValueChange={() => onToggle(item.id)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Goal</Text>
            <TouchableOpacity 
              onPress={handleSave} 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Goal Type Badge */}
            <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                {goal.goal_type === '12week' ? '12-Week Goal' : 'Custom Goal'}
              </Text>
            </View>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Goal title"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Wellness Zones Section */}
            {renderSectionHeader(
              'Wellness Zones',
              selectedDomainIds.length,
              domainsExpanded,
              () => setDomainsExpanded(!domainsExpanded)
            )}
            {domainsExpanded && renderToggleGrid(
              availableDomains,
              selectedDomainIds,
              toggleDomain
            )}

            {/* Roles Section */}
            {renderSectionHeader(
              'Roles',
              selectedRoleIds.length,
              rolesExpanded,
              () => setRolesExpanded(!rolesExpanded)
            )}
            {rolesExpanded && renderToggleGrid(
              availableRoles,
              selectedRoleIds,
              toggleRole
            )}

            {/* Key Relationships Section (only if roles selected) */}
            {selectedRoleIds.length > 0 && filteredKeyRelationships.length > 0 && (
              <>
                {renderSectionHeader(
                  'Key Relationships',
                  selectedKeyRelationshipIds.length,
                  keyRelationshipsExpanded,
                  () => setKeyRelationshipsExpanded(!keyRelationshipsExpanded)
                )}
                {keyRelationshipsExpanded && renderToggleGrid(
                  filteredKeyRelationships,
                  selectedKeyRelationshipIds,
                  toggleKeyRelationship
                )}
              </>
            )}

            {/* Previous Notes Section */}
            {previousNotes.length > 0 && (
              <View style={styles.previousNotesSection}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Previous Notes ({previousNotes.length})
                </Text>
                {previousNotes.map(note => (
                  <View 
                    key={note.id} 
                    style={[styles.previousNote, { borderLeftColor: colors.primary }]}
                  >
                    <Text style={[styles.previousNoteText, { color: colors.text }]}>
                      {note.content || note.note_text}
                    </Text>
                    
                    {/* Show previous attachments */}
                    {note.attachments && note.attachments.length > 0 && (
                      <View style={styles.previousAttachments}>
                        {note.attachments.map((attachment) => {
                          const isImage = attachment.file_type?.startsWith('image/');
                          return (
                            <TouchableOpacity
                              key={attachment.id}
                              style={styles.previousAttachmentItem}
                              onPress={() => {
                                if (attachment.public_url) {
                                  Linking.openURL(attachment.public_url);
                                }
                              }}
                            >
                              {isImage && attachment.public_url ? (
                                <Image
                                  source={{ uri: attachment.public_url }}
                                  style={styles.attachmentThumbnail}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={[styles.attachmentDocIcon, { backgroundColor: colors.border }]}>
                                  <Paperclip size={14} color={colors.textSecondary} />
                                </View>
                              )}
                              <Text 
                                style={[styles.previousAttachmentName, { color: colors.primary }]}
                                numberOfLines={1}
                              >
                                {attachment.file_name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                    
                    <Text style={[styles.previousNoteDate, { color: colors.textSecondary }]}>
                      {formatLocalDate(note.created_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Add New Note Section */}
            <View style={styles.newNoteSection}>
              <View style={styles.noteSectionHeader}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Add New Note</Text>
                <TouchableOpacity
                  onPress={handlePickAttachment}
                  style={styles.attachmentIconButton}
                >
                  <Paperclip size={20} color={colors.primary} />
                  {newNoteAttachments.length > 0 && (
                    <View style={[styles.attachmentBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.attachmentBadgeText}>{newNoteAttachments.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                value={newNoteText}
                onChangeText={setNewNoteText}
                placeholder="Write a new note for this goal..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />

              {/* Attachment Preview */}
              {newNoteAttachments.length > 0 && (
                <View style={styles.attachmentsPreview}>
                  <Text style={[styles.attachmentsLabel, { color: colors.textSecondary }]}>
                    Attachments ({newNoteAttachments.length})
                  </Text>
                  {newNoteAttachments.map((file, index) => (
                    <View 
                      key={index} 
                      style={[styles.attachmentItem, { borderColor: colors.border }]}
                    >
                      <Paperclip size={16} color={colors.textSecondary} />
                      <Text 
                        style={[styles.attachmentName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                      <Text style={[styles.attachmentSize, { color: colors.textSecondary }]}>
                        {(file.size / 1024).toFixed(1)} KB
                      </Text>
                      <TouchableOpacity 
                        onPress={() => removeAttachment(index)}
                        style={styles.removeAttachmentButton}
                      >
                        <X size={16} color={colors.error || '#ef4444'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              style={[styles.deleteButton, { borderColor: '#ef4444' }]}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={18} color="#ef4444" />
              <Text style={styles.deleteButtonText}>Cancel Goal</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.surface }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Cancel Goal?</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              This will archive the goal and hide it from your active goals. This action can be undone later.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, { borderColor: colors.border }]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={[styles.confirmButtonText, { color: colors.text }]}>Keep Goal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={handleDelete}
              >
                <Text style={[styles.confirmButtonText, { color: '#ffffff' }]}>Cancel Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 12,
  },
  toggleItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingRight: 16,
  },
  toggleLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  previousNotesSection: {
    marginTop: 24,
  },
  previousNote: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  previousNoteText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  previousNoteDate: {
    fontSize: 12,
  },
  newNoteSection: {
    marginTop: 24,
  },
  noteSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attachmentIconButton: {
    padding: 8,
    position: 'relative',
  },
  attachmentBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 12,
  },
  attachmentButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previousAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  previousAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 4,
  },
  attachmentThumbnail: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  attachmentDocIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousAttachmentName: {
    fontSize: 12,
    maxWidth: 120,
  },
  attachmentsPreview: {
    marginTop: 12,
  },
  attachmentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 8,
    gap: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
  },
  attachmentSize: {
    fontSize: 12,
  },
  removeAttachmentButton: {
    padding: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 32,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmDeleteButton: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EditGoalModal;