import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Image, TextInput, Platform } from 'react-native';
import { X, Calendar, CheckSquare, Edit, Trash2, Plus, Paperclip } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { Task } from './TaskCard';
import { describeRRule } from '@/lib/rruleUtils';
import { fetchAttachmentsForNotes, uploadNoteAttachment, saveNoteAttachmentMetadata } from '@/lib/noteAttachmentUtils';
import ImageViewerModal from '../reflections/ImageViewerModal';
import { Linking } from 'react-native';
import FollowThroughButtonBar from '../followThrough/FollowThroughButtonBar';
import AssociatedItemsList, { AssociatedItem } from '../followThrough/AssociatedItemsList';
import { fetchAssociatedItems } from '@/lib/followThroughUtils';
import TaskEventForm from './TaskEventForm';
import ParentItemInfo from '../followThrough/ParentItemInfo';
import * as DocumentPicker from 'expo-document-picker';

interface ActionDetailsModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onDelete: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onRefreshAssociatedItems?: () => void;
  onItemPress?: (item: AssociatedItem) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export function ActionDetailsModal({
  visible,
  task,
  onClose,
  onDelete,
  onEdit,
  onRefreshAssociatedItems,
  onItemPress
}: ActionDetailsModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [taskNotes, setTaskNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteAttachmentsMap, setNoteAttachmentsMap] = useState<Map<string, any[]>>(new Map());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [allAttachments, setAllAttachments] = useState<any[]>([]);
  const [associatedItems, setAssociatedItems] = useState<AssociatedItem[]>([]);
  const [loadingAssociatedItems, setLoadingAssociatedItems] = useState(false);
  const [followThroughFormVisible, setFollowThroughFormVisible] = useState(false);
  const [followThroughPreSelectedType, setFollowThroughPreSelectedType] = useState<'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection'>('task');
  const [roles, setRoles] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [addNoteModalVisible, setAddNoteModalVisible] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteAttachments, setNoteAttachments] = useState<any[]>([]);

  useEffect(() => {
    if (visible && task?.id) {
      fetchTaskNotes();
      loadAssociatedItems();
      fetchTaskMetadata();
      setIsEditMode(false);
    }
  }, [visible, task?.id]);

  useEffect(() => {
    const attachments: any[] = [];
    noteAttachmentsMap.forEach((noteAttachments) => {
      attachments.push(...noteAttachments);
    });
    setAllAttachments(attachments);
  }, [noteAttachmentsMap]);

  const fetchTaskNotes = async () => {
    if (!task?.id) return;
    setLoadingNotes(true);
    try {
      const supabase = getSupabaseClient();
      const parentType = task.type === 'event' ? 'event' : 'task';

      const { data, error } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('parent_id', task.id)
        .eq('parent_type', parentType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const notes = (data || [])
        .map((item: any) => item.note)
        .filter(Boolean)
        .sort((a: Note, b: Note) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setTaskNotes(notes);

      if (notes.length > 0) {
        const noteIds = notes.map((n: Note) => n.id);
        const attachmentsData = await fetchAttachmentsForNotes(noteIds);
        setNoteAttachmentsMap(attachmentsData);
      }
    } catch (error) {
      console.error('Error fetching task notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadAssociatedItems = async () => {
    if (!task?.id) return;
    setLoadingAssociatedItems(true);
    try {
      const items = await fetchAssociatedItems(task.id, 'task');
      setAssociatedItems(items);
    } catch (error) {
      console.error('Error loading associated items:', error);
    } finally {
      setLoadingAssociatedItems(false);
    }
  };

  const fetchTaskMetadata = async () => {
    if (!task?.id) return;
    setLoadingMetadata(true);
    try {
      const supabase = getSupabaseClient();
      const [rolesRes, domainsRes] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('role:0008-ap-roles(id, label, color)')
          .eq('parent_id', task.id)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('domain:0008-ap-domains(id, name)')
          .eq('parent_id', task.id)
          .eq('parent_type', 'task')
      ]);

      if (rolesRes.data) {
        setRoles(rolesRes.data.map((r: any) => r.role).filter(Boolean));
      }
      if (domainsRes.data) {
        setDomains(domainsRes.data.map((d: any) => d.domain).filter(Boolean));
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Action',
      'Are you sure you want to delete this action?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (task) {
              onDelete(task);
              onClose();
            }
          },
        },
      ]
    );
  };

  const handleFollowThroughPress = (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection') => {
    setFollowThroughPreSelectedType(type);
    setFollowThroughFormVisible(true);
  };

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
        const validFiles: any[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.size || 0;
          const fileName = asset.name;

          if (fileSize > MAX_FILE_SIZE) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: asset.mimeType || 'application/octet-stream',
              size: fileSize,
            });
          }
        });

        if (oversizedFiles.length > 0) {
          Alert.alert(
            'File Size Limit Exceeded',
            `The following files exceed the 10 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setNoteAttachments([...noteAttachments, ...validFiles]);
        }
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleRemoveNoteAttachment = (index: number) => {
    setNoteAttachments(noteAttachments.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file: any, userId: string): Promise<string | null> => {
    try {
      let fileData: any;
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      } else {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }

      const filePath = await uploadNoteAttachment(fileData, file.name, file.type, userId);
      return filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteText.trim() || !task?.id) return;

    setSavingNote(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Create the note
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: newNoteText.trim(),
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Link note to task/event
      const parentType = task.type === 'event' ? 'event' : 'task';
      const { error: noteJoinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: task.id,
          parent_type: parentType,
          note_id: noteData.id,
          user_id: user.id,
        });

      if (noteJoinError) throw noteJoinError;

      // Upload attachments if any
      if (noteAttachments.length > 0) {
        const uploadPromises = noteAttachments.map(async (file) => {
          const filePath = await uploadFileToStorage(file, user.id);
          if (filePath) {
            await saveNoteAttachmentMetadata(
              noteData.id,
              user.id,
              file.name,
              filePath,
              file.type,
              file.size
            );
          }
        });

        await Promise.all(uploadPromises);
      }

      // Refresh notes
      await fetchTaskNotes();

      // Close modal and reset
      setAddNoteModalVisible(false);
      setNewNoteText('');
      setNoteAttachments([]);

      Alert.alert('Success', 'Note added successfully!');
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const formatDateTime = (dateString: string | null, dateOnly = false): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';

    if (dateOnly) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '—';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const renderNoteWithLinks = (content: string) => {
    // Simple URL regex
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return (
      <Text style={styles.noteText}>
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            return (
              <Text
                key={index}
                style={styles.noteLink}
                onPress={() => Linking.openURL(part)}
              >
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  if (!task) return null;

  return (
    <>
      <Modal visible={visible && !followThroughFormVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {task.type === 'event' ? 'Event Details' : 'Task Details'}
            </Text>
            <View style={styles.headerActions}>
              {!isEditMode && (
                <TouchableOpacity
                  onPress={() => setIsEditMode(true)}
                  style={styles.headerButton}
                >
                  <Edit size={20} color="#3b82f6" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <X size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content}>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.titleRow}>
                {task.type === 'event' ? (
                  <Calendar size={24} color="#3b82f6" style={styles.titleIcon} />
                ) : (
                  <CheckSquare size={24} color="#3b82f6" style={styles.titleIcon} />
                )}
                <Text style={styles.title}>{task.title}</Text>
              </View>

              {/* Alignment Chips - Roles and Domains */}
              {(roles.length > 0 || domains.length > 0) && (
                <View style={styles.alignmentChips}>
                  {roles.map(role => (
                    <View key={role.id} style={[styles.chip, { backgroundColor: role.color || '#e0e7ff' }]}>
                      <Text style={styles.chipText}>{role.label}</Text>
                    </View>
                  ))}
                  {domains.map(domain => (
                    <View key={domain.id} style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                      <Text style={styles.chipText}>{domain.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Parent Info */}
              {task.parent_id && task.parent_type && (
                <View style={styles.parentInfoContainer}>
                  <ParentItemInfo
                    parentId={task.parent_id}
                    parentType={task.parent_type as any}
                    onPress={() => {
                      if (onItemPress) {
                        onItemPress({
                          id: task.parent_id!,
                          type: task.parent_type as any,
                          title: '',
                          date: '',
                        });
                      }
                    }}
                  />
                </View>
              )}
            </View>

            {/* Body - Notes */}
            <View style={styles.bodySection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Notes</Text>
                <TouchableOpacity
                  style={styles.addNoteButton}
                  onPress={() => setAddNoteModalVisible(true)}
                >
                  <Text style={styles.addNoteButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              {loadingNotes ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : taskNotes.length > 0 ? (
                <View style={styles.notesContainer}>
                  {taskNotes.map(note => (
                    <View key={note.id}>
                      {renderNoteWithLinks(note.content)}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No notes added</Text>
              )}
            </View>

            {/* Attachments Gallery */}
            {allAttachments.length > 0 && (
              <View style={styles.bodySection}>
                <Text style={styles.sectionLabel}>Attachments ({allAttachments.length})</Text>
                <View style={styles.attachmentsGallery}>
                  {allAttachments.map((file, idx) => {
                    const isImage = file.file_type?.startsWith('image/');
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.attachmentItem}
                        onPress={() => {
                          if (isImage) {
                            const imageAttachments = allAttachments.filter(f =>
                              f.file_type?.startsWith('image/')
                            );
                            const imageIndex = imageAttachments.findIndex(img => img.id === file.id);
                            setSelectedImages(imageAttachments);
                            setSelectedImageIndex(imageIndex >= 0 ? imageIndex : 0);
                            setImageViewerVisible(true);
                          } else {
                            Linking.openURL(file.public_url || file.uri);
                          }
                        }}
                      >
                        {isImage ? (
                          <Image
                            source={{ uri: file.public_url || file.uri }}
                            style={styles.attachmentImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.attachmentDocument}>
                            <Text style={styles.attachmentDocText}>📄</Text>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {file.file_name || file.name}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Follow Through Section */}
            <View style={styles.followThroughSection}>
              <Text style={styles.followThroughLabel}>Spark a Follow-Up Action:</Text>
              <FollowThroughButtonBar
                onPressTask={() => handleFollowThroughPress('task')}
                onPressEvent={() => handleFollowThroughPress('event')}
                onPressRose={() => handleFollowThroughPress('rose')}
                onPressThorn={() => handleFollowThroughPress('thorn')}
                onPressReflection={() => handleFollowThroughPress('reflection')}
                onPressDepositIdea={() => handleFollowThroughPress('depositIdea')}
              />
            </View>

            {/* Associated Items */}
            {associatedItems.length > 0 && (
              <View style={styles.bodySection}>
                <Text style={styles.sectionLabel}>Follow-Through Items</Text>
                <AssociatedItemsList
                  items={associatedItems}
                  onItemPress={onItemPress}
                  loading={loadingAssociatedItems}
                />
              </View>
            )}

            {/* Footer - Metadata */}
            <View style={styles.footerSection}>
              <View style={styles.metadataGrid}>
                {task.type === 'task' && task.due_date && (
                  <View style={styles.metadataItemWide}>
                    <View style={styles.metadataRow}>
                      <View style={styles.metadataHalf}>
                        <Text style={styles.metadataLabel}>Due Date</Text>
                        <Text style={styles.metadataValue}>{formatDateTime(task.due_date, true)}</Text>
                      </View>
                      <View style={styles.metadataHalf}>
                        <Text style={styles.metadataLabel}>Time Due</Text>
                        <Text style={styles.metadataValue}>
                          {task.is_all_day ? 'Anytime' : formatTime(task.due_time || task.start_time)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {task.type === 'event' && task.start_date && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Date</Text>
                    <Text style={styles.metadataValue}>
                      {formatDateTime(task.start_date, true)}
                      {task.end_date && task.end_date !== task.start_date ? ` — ${formatDateTime(task.end_date, true)}` : ''}
                    </Text>
                  </View>
                )}
                {task.type === 'event' && task.start_time && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Start Time</Text>
                    <Text style={styles.metadataValue}>{formatTime(task.start_time)}</Text>
                  </View>
                )}
                {task.type === 'event' && task.end_time && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>End Time</Text>
                    <Text style={styles.metadataValue}>{formatTime(task.end_time)}</Text>
                  </View>
                )}
                {task.status === 'completed' && task.completed_at && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Completed</Text>
                    <Text style={styles.metadataValue}>{formatDateTime(task.completed_at, true)}</Text>
                  </View>
                )}
                {task.recurrence_rule && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Recurrence</Text>
                    <Text style={styles.metadataValue}>{describeRRule(task.recurrence_rule)}</Text>
                  </View>
                )}
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>Priority</Text>
                  <Text style={styles.metadataValue}>
                    {task.is_urgent && task.is_important ? 'Urgent & Important' :
                     !task.is_urgent && task.is_important ? 'Important' :
                     task.is_urgent && !task.is_important ? 'Urgent' : 'Normal'}
                  </Text>
                </View>
              </View>

              {/* Delete Button */}
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <Trash2 size={16} color="#dc2626" />
                <Text style={styles.deleteText}>Delete Action</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Follow Through Form Modal */}
      {followThroughFormVisible && (
        <TaskEventForm
          visible={followThroughFormVisible}
          onClose={() => {
            setFollowThroughFormVisible(false);
            if (onRefreshAssociatedItems) {
              onRefreshAssociatedItems();
            }
            loadAssociatedItems();
          }}
          initialType={followThroughPreSelectedType}
          parentId={task.id}
          parentType="task"
        />
      )}

      {/* Edit Form Modal */}
      {isEditMode && (
        <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
          <TaskEventForm
            mode="edit"
            initialData={{
              ...task,
              type: task.type,
              roles: roles,
              domains: domains,
            }}
            onClose={() => {
              setIsEditMode(false);
            }}
            onSubmitSuccess={async () => {
              setIsEditMode(false);
              await fetchTaskNotes();
              await loadAssociatedItems();
              await fetchTaskMetadata();
              onRefreshAssociatedItems?.();
            }}
          />
        </Modal>
      )}

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />

      {/* Add Note Modal */}
      <Modal visible={addNoteModalVisible} transparent animationType="fade">
        <View style={styles.noteModalOverlay}>
          <View style={styles.noteModalContainer}>
            <View style={styles.noteModalHeader}>
              <Text style={styles.noteModalTitle}>Add Note</Text>
              <TouchableOpacity onPress={() => {
                setAddNoteModalVisible(false);
                setNewNoteText('');
                setNoteAttachments([]);
              }}>
                <X size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.noteModalContent}>
              <TextInput
                style={styles.noteInput}
                value={newNoteText}
                onChangeText={setNewNoteText}
                placeholder="Enter your note..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                autoFocus
              />

              {/* Single Attachment Button */}
              <View style={styles.attachmentButtonContainer}>
                <TouchableOpacity
                  style={styles.attachmentButton}
                  onPress={handlePickAttachment}
                >
                  <Paperclip size={18} color="#3b82f6" />
                  <Text style={styles.attachmentButtonText}>Add Attachment</Text>
                </TouchableOpacity>
              </View>

              {/* Attachments Preview */}
              {noteAttachments.length > 0 && (
                <View style={styles.attachmentsPreview}>
                  <Text style={styles.attachmentsLabel}>
                    Attachments ({noteAttachments.length})
                  </Text>
                  {noteAttachments.map((file, index) => (
                    <View key={index} style={styles.attachmentPreviewItem}>
                      <Text style={styles.attachmentFileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveNoteAttachment(index)}
                        style={styles.removeAttachmentButton}
                      >
                        <X size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.noteModalFooter}>
              <TouchableOpacity
                style={[styles.noteModalButton, styles.noteCancelButton]}
                onPress={() => {
                  setAddNoteModalVisible(false);
                  setNewNoteText('');
                  setNoteAttachments([]);
                }}
              >
                <Text style={styles.noteCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.noteModalButton,
                  styles.noteSaveButton,
                  (!newNoteText.trim() || savingNote) && styles.noteSaveButtonDisabled
                ]}
                onPress={handleSaveNote}
                disabled={!newNoteText.trim() || savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.noteSaveButtonText}>Save Note</Text>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleIcon: {
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    lineHeight: 32,
  },
  alignmentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  parentInfoContainer: {
    marginTop: 12,
  },
  bodySection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addNoteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addNoteButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  notesContainer: {
    gap: 12,
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  attachmentsGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentItem: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  attachmentDocument: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  attachmentDocText: {
    fontSize: 32,
  },
  attachmentName: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  followThroughSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  followThroughLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  footerSection: {
    padding: 20,
    backgroundColor: '#fafafa',
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metadataItem: {
    width: '48%',
  },
  metadataItemWide: {
    width: '100%',
  },
  metadataRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metadataHalf: {
    flex: 1,
  },
  metadataLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metadataValue: {
    fontSize: 14,
    color: '#4b5563',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  deleteText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  noteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noteModalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  noteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  noteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  noteInput: {
    padding: 20,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 120,
    textAlignVertical: 'top',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  noteModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
  },
  noteModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  noteCancelButton: {
    backgroundColor: '#f3f4f6',
  },
  noteCancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  noteSaveButton: {
    backgroundColor: '#3b82f6',
  },
  noteSaveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  noteSaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noteLink: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  noteModalContent: {
    maxHeight: 400,
  },
  attachmentButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  attachmentButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  attachmentsPreview: {
    padding: 20,
    gap: 8,
  },
  attachmentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  attachmentPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  attachmentFileName: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    marginRight: 8,
  },
  removeAttachmentButton: {
    padding: 4,
  },
});
