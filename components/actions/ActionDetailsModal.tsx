import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput } from 'react-native';
import { X, Plus, Paperclip, Save, Calendar, CheckSquare, Flower2, AlertTriangle, Lightbulb, BookText } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { Task } from '../tasks/TaskCard';
import { describeRRule } from '@/lib/rruleUtils';
import { fetchAttachmentsForNotes } from '@/lib/noteAttachmentUtils';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';
import AttachmentBadge from '../attachments/AttachmentBadge';
import ImageViewerModal from '../reflections/ImageViewerModal';
import { Linking, Image } from 'react-native';
import Tooltip from '../common/Tooltip';
import * as DocumentPicker from 'expo-document-picker';

interface ActionDetailsModalProps {
  visible: boolean;
  item: Task | Reflection | null;  // Can be task, event, or reflection
  itemType: 'task' | 'event' | 'reflection';
  onClose: () => void;
  onUpdate?: (item: any) => void;
  onDelegate?: (item: any) => void;
  onCancel?: (item: any) => void;
  onCreateChild?: (parentId: string, parentType: string, childType: string) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface Reflection {
  id: string;
  content: string;
  reflection_type: string;
  daily_rose?: boolean;
  daily_thorn?: boolean;
  date?: string;
  created_at: string;
  completed_at?: string;
}

interface ChildItem {
  id: string;
  title: string;
  type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection';
  date: string;
  icon: any;
  iconColor: string;
}

export function ActionDetailsModal({
  visible,
  item,
  itemType,
  onClose,
  onUpdate,
  onDelegate,
  onCancel,
  onCreateChild
}: ActionDetailsModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteAttachmentsMap, setNoteAttachmentsMap] = useState<Map<string, any[]>>(new Map());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [childItems, setChildItems] = useState<ChildItem[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  // Note input state
  const [showNewNoteInput, setShowNewNoteInput] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState<any[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (visible && item?.id) {
      fetchNotes();
      fetchChildItems();
    } else {
      // Reset state when modal closes
      setShowNewNoteInput(false);
      setNewNoteContent('');
      setNewNoteAttachments([]);
    }
  }, [visible, item?.id]);

  const fetchNotes = async () => {
    if (!item?.id) return;

    setLoadingNotes(true);
    try {
      const supabase = getSupabaseClient();
      const parentType = itemType === 'event' ? 'task' : itemType;

      const { data, error } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('parent_id', item.id)
        .eq('parent_type', parentType);

      if (error) throw error;

      const fetchedNotes = data?.map(item => item.note).filter(Boolean) || [];
      setNotes(fetchedNotes);

      if (fetchedNotes.length > 0) {
        const noteIds = fetchedNotes.map(note => note.id);
        const attachmentsMap = await fetchAttachmentsForNotes(noteIds);
        setNoteAttachmentsMap(attachmentsMap);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchChildItems = async () => {
    if (!item?.id) return;

    setLoadingChildren(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const parentType = itemType === 'event' ? 'task' : itemType;
      const children: ChildItem[] = [];

      // Fetch child tasks/events
      const { data: childTasks, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('id, title, type, due_date, completed_at')
        .eq('user_id', user.id)
        .eq('parent_id', item.id)
        .eq('parent_type', parentType)
        .order('due_date', { ascending: false });

      if (!tasksError && childTasks) {
        children.push(...childTasks.map(t => ({
          id: t.id,
          title: t.title,
          type: t.type === 'event' ? 'event' : 'task' as 'task' | 'event',
          date: t.due_date || t.completed_at,
          icon: t.type === 'event' ? Calendar : CheckSquare,
          iconColor: t.type === 'event' ? '#0078d4' : '#16a34a'
        })));
      }

      // Fetch child reflections
      const { data: childReflections, error: reflectionsError } = await supabase
        .from('0008-ap-reflections')
        .select('id, content, reflection_type, daily_rose, daily_thorn, date, created_at')
        .eq('user_id', user.id)
        .eq('parent_id', item.id)
        .eq('parent_type', parentType)
        .order('created_at', { ascending: false });

      if (!reflectionsError && childReflections) {
        children.push(...childReflections.map(r => {
          let type: 'rose' | 'thorn' | 'depositIdea' | 'reflection' = 'reflection';
          let icon = BookText;
          let iconColor = '#9333ea';

          if (r.daily_rose) {
            type = 'rose';
            icon = Flower2;
            iconColor = '#dc2626';
          } else if (r.daily_thorn) {
            type = 'thorn';
            icon = AlertTriangle;
            iconColor = '#f59e0b';
          } else if (r.reflection_type === 'deposit_idea') {
            type = 'depositIdea';
            icon = Lightbulb;
            iconColor = '#fbbf24';
          }

          return {
            id: r.id,
            title: r.content.substring(0, 60),
            type,
            date: r.date || r.created_at,
            icon,
            iconColor
          };
        }));
      }

      // Sort all children by date (most recent first)
      children.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setChildItems(children);
    } catch (error) {
      console.error('Error fetching child items:', error);
    } finally {
      setLoadingChildren(false);
    }
  };

  const handleAddAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true
      });

      if (!result.canceled && result.assets) {
        setNewNoteAttachments(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteContent.trim() && newNoteAttachments.length === 0) {
      Alert.alert('Error', 'Please add note content or attachments');
      return;
    }

    setSavingNote(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parentType = itemType === 'event' ? 'task' : itemType;

      // Create note
      const { data: note, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: newNoteContent.trim(),
          note_type: 'general'
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Link note to parent
      const { error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          user_id: user.id,
          note_id: note.id,
          parent_id: item!.id,
          parent_type: parentType
        });

      if (joinError) throw joinError;

      // Upload attachments if any
      if (newNoteAttachments.length > 0) {
        for (const file of newNoteAttachments) {
          const fileExt = file.name.split('.').pop();
          const filePath = `${user.id}/notes/${note.id}/${Date.now()}.${fileExt}`;

          const response = await fetch(file.uri);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from('note-attachments')
            .upload(filePath, blob, {
              contentType: file.mimeType,
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Create attachment record
          const { error: attachmentError } = await supabase
            .from('0008-ap-note-attachments')
            .insert({
              note_id: note.id,
              user_id: user.id,
              file_name: file.name,
              file_path: filePath,
              file_type: file.mimeType,
              file_size: file.size
            });

          if (attachmentError) throw attachmentError;
        }
      }

      // Reset form and refresh notes
      setNewNoteContent('');
      setNewNoteAttachments([]);
      setShowNewNoteInput(false);
      fetchNotes();

      Alert.alert('Success', 'Note saved successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleCreateChildAction = (childType: string) => {
    if (onCreateChild && item) {
      const parentType = itemType === 'event' ? 'task' : itemType;
      onCreateChild(item.id, parentType, childType);
    }
  };

  const formatDateTime = (dateTime, isDateOnly = false) => {
    if (!dateTime) return 'Not set';

    if (isDateOnly) {
      const [year, month, day] = dateTime.split('T')[0].split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      return new Date(dateTime).toLocaleString();
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not set';

    const timeParts = timeString.split(':');
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = timeParts[1];
      const isPM = hours >= 12;
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${isPM ? 'PM' : 'AM'}`;
    }

    return timeString;
  };

  if (!item) return null;

  const isTask = itemType === 'task' || itemType === 'event';
  const task = isTask ? (item as Task) : null;
  const isEvent = itemType === 'event';
  const isCompleted = task?.status === 'completed';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>
            {isEvent ? 'Event Details' : 'Task Details'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailContent}>
          <Text style={styles.detailTaskTitle}>
            {isTask ? task?.title : (item as Reflection).content}
          </Text>

          {isTask && (
            <>
              <View style={styles.detailRow}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Due Date{isEvent ? '/Time' : ''}:</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(task?.due_date, true)}
                    {isEvent && task?.start_time && (
                      <Text style={styles.timeInline}>
                        {' '}({formatTime(task.start_time)}
                        {task.end_time && ` - ${formatTime(task.end_time)}`})
                      </Text>
                    )}
                  </Text>
                </View>

                {isCompleted && task?.completed_at && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Completed Date:</Text>
                    <Text style={styles.detailValue}>
                      {formatDateTime(task.completed_at, true)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Priority:</Text>
                <Text style={styles.detailValue}>
                  {task?.is_urgent && task?.is_important ? 'Urgent & Important' :
                   !task?.is_urgent && task?.is_important ? 'Important' :
                   task?.is_urgent && !task?.is_important ? 'Urgent' : 'Normal'}
                </Text>
              </View>

              {task?.roles?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Roles:</Text>
                  <View style={styles.detailTagContainer}>
                    {task.roles.map(role => (
                      <View key={role.id} style={[styles.tag, styles.roleTag]}>
                        <Text style={styles.tagText}>{role.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {task?.domains?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Domains:</Text>
                  <View style={styles.detailTagContainer}>
                    {task.domains.map(domain => (
                      <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                        <Text style={styles.tagText}>{domain.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Notes Section */}
          <View style={styles.detailSection}>
            <View style={styles.notesHeader}>
              <Text style={styles.detailLabel}>Notes</Text>
              <View style={styles.notesActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setShowNewNoteInput(!showNewNoteInput)}
                >
                  <Plus size={20} color="#0078d4" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleAddAttachment}
                >
                  <Paperclip size={20} color="#0078d4" />
                </TouchableOpacity>
              </View>
            </View>

            {showNewNoteInput && (
              <View style={styles.newNoteContainer}>
                <TextInput
                  style={styles.newNoteInput}
                  placeholder="Add a note..."
                  multiline
                  value={newNoteContent}
                  onChangeText={setNewNoteContent}
                />
                {newNoteAttachments.length > 0 && (
                  <View style={styles.newNoteAttachments}>
                    {newNoteAttachments.map((file, idx) => (
                      <View key={idx} style={styles.attachmentChip}>
                        <Text style={styles.attachmentChipText} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setNewNoteAttachments(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X size={14} color="#6b7280" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.saveButton, savingNote && styles.saveButtonDisabled]}
                  onPress={handleSaveNote}
                  disabled={savingNote}
                >
                  <Save size={16} color="#ffffff" />
                  <Text style={styles.saveButtonText}>
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {notes.length > 0 && (
              <View style={styles.notesContainer}>
                {notes.map((note) => {
                  const noteAttachments = noteAttachmentsMap.get(note.id) || [];
                  const hasContent = note.content && note.content.trim();
                  const hasAttachments = noteAttachments.length > 0;

                  if (!hasContent && !hasAttachments) return null;

                  return (
                    <View key={note.id} style={styles.noteItem}>
                      {hasContent && (
                        <Text style={styles.noteContent}>{note.content}</Text>
                      )}
                      <Text style={styles.noteDate}>
                        {new Date(note.created_at).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })} ({new Date(note.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })})
                      </Text>
                      {hasAttachments && (
                        <View style={styles.noteAttachmentsContainer}>
                          <View style={styles.attachmentsHeader}>
                            <AttachmentBadge count={noteAttachments.length} size="small" />
                          </View>
                          <View style={styles.attachmentsGrid}>
                            {noteAttachments.slice(0, 4).map((file, idx) => {
                              const isImage = file.file_type?.startsWith('image/');
                              return (
                                <TouchableOpacity
                                  key={idx}
                                  style={styles.attachmentThumbnailWrapper}
                                  onPress={() => {
                                    if (isImage) {
                                      const imageAttachments = noteAttachments.filter(f => f.file_type?.startsWith('image/'));
                                      const imageIndex = imageAttachments.findIndex(img => img.id === file.id);
                                      setSelectedImages(imageAttachments);
                                      setSelectedImageIndex(imageIndex >= 0 ? imageIndex : 0);
                                      setImageViewerVisible(true);
                                    } else {
                                      Linking.openURL(file.public_url || file.uri);
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  {isImage ? (
                                    <Image
                                      source={{ uri: file.public_url || file.uri }}
                                      style={styles.thumbnailImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View style={styles.documentThumbnail}>
                                      <AttachmentThumbnail
                                        uri={file.public_url || file.uri}
                                        fileType={file.file_type || file.type}
                                        fileName={file.file_name || file.name}
                                        size="small"
                                      />
                                    </View>
                                  )}
                                  <Text style={styles.thumbnailFileName} numberOfLines={1}>
                                    {file.file_name || file.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Associated Actions and Reflections */}
          {childItems.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Associated Actions and Reflections</Text>
              <View style={styles.childItemsList}>
                {childItems.map((child, index) => {
                  const Icon = child.icon;
                  return (
                    <View
                      key={child.id}
                      style={[
                        styles.childItem,
                        index % 2 === 0 ? styles.childItemEven : styles.childItemOdd
                      ]}
                    >
                      <Icon size={16} color={child.iconColor} />
                      <Text style={styles.childItemTitle} numberOfLines={1}>
                        {child.title}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Actions Bar */}
          <View style={styles.actionsSection}>
            <Text style={styles.detailLabel}>Actions</Text>
            <View style={styles.actionsBar}>
              <Tooltip content="Create Task">
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleCreateChildAction('task')}
                >
                  <CheckSquare size={24} color="#16a34a" />
                </TouchableOpacity>
              </Tooltip>

              <Tooltip content="Create Event">
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleCreateChildAction('event')}
                >
                  <Calendar size={24} color="#0078d4" />
                </TouchableOpacity>
              </Tooltip>

              <Tooltip content="Add Rose">
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleCreateChildAction('rose')}
                >
                  <Flower2 size={24} color="#dc2626" />
                </TouchableOpacity>
              </Tooltip>

              <Tooltip content="Add Thorn">
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleCreateChildAction('thorn')}
                >
                  <AlertTriangle size={24} color="#f59e0b" />
                </TouchableOpacity>
              </Tooltip>

              <Tooltip content="Add Reflection">
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleCreateChildAction('reflection')}
                >
                  <BookText size={24} color="#9333ea" />
                </TouchableOpacity>
              </Tooltip>

              <Tooltip content="Deposit Idea">
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleCreateChildAction('depositIdea')}
                >
                  <Lightbulb size={24} color="#fbbf24" />
                </TouchableOpacity>
              </Tooltip>
            </View>
          </View>
        </ScrollView>

        {isTask && (
          <View style={styles.detailActions}>
            {onUpdate && (
              <TouchableOpacity
                style={[styles.detailButton, styles.updateButton]}
                onPress={() => {
                  onClose();
                  setTimeout(() => onUpdate(task!), 150);
                }}
              >
                <Text style={styles.detailButtonText}>Update</Text>
              </TouchableOpacity>
            )}
            {onDelegate && (
              <TouchableOpacity
                style={[styles.detailButton, styles.delegateButton]}
                onPress={() => onDelegate(task!)}
              >
                <Text style={styles.detailButtonText}>Delegate</Text>
              </TouchableOpacity>
            )}
            {onCancel && (
              <TouchableOpacity
                style={[styles.detailButton, styles.cancelButton]}
                onPress={() => onCancel(task!)}
              >
                <Text style={styles.detailButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <ImageViewerModal
        visible={imageViewerVisible}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  detailContainer: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff'
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  detailContent: {
    padding: 16
  },
  detailTaskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16
  },
  detailSection: {
    marginBottom: 16,
    flex: 1
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4
  },
  detailValue: {
    fontSize: 16,
    color: '#1f2937'
  },
  timeInline: {
    fontSize: 14,
    color: '#6b7280'
  },
  detailTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  roleTag: {
    backgroundColor: '#fce7f3'
  },
  domainTag: {
    backgroundColor: '#fed7aa'
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151'
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  notesActions: {
    flexDirection: 'row',
    gap: 8
  },
  iconButton: {
    padding: 4
  },
  newNoteContainer: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  newNoteInput: {
    minHeight: 80,
    fontSize: 14,
    color: '#1f2937',
    textAlignVertical: 'top'
  },
  newNoteAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    maxWidth: 150
  },
  attachmentChipText: {
    fontSize: 12,
    color: '#374151',
    flex: 1
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6
  },
  saveButtonDisabled: {
    opacity: 0.5
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  notesContainer: {
    marginTop: 8
  },
  noteItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4'
  },
  noteContent: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 4
  },
  noteDate: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic'
  },
  noteAttachmentsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  attachmentsHeader: {
    marginBottom: 8
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  attachmentThumbnailWrapper: {
    width: 70,
    alignItems: 'center',
    gap: 4
  },
  thumbnailImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f3f4f6'
  },
  documentThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  thumbnailFileName: {
    fontSize: 9,
    textAlign: 'center',
    width: '100%',
    color: '#6b7280'
  },
  childItemsList: {
    marginTop: 8
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8
  },
  childItemEven: {
    backgroundColor: '#ffffff'
  },
  childItemOdd: {
    backgroundColor: '#f8fafc'
  },
  childItemTitle: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937'
  },
  actionsSection: {
    marginTop: 24,
    marginBottom: 16
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  actionIcon: {
    padding: 8
  },
  detailActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff'
  },
  detailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6
  },
  updateButton: {
    backgroundColor: '#0078d4'
  },
  delegateButton: {
    backgroundColor: '#6b7280'
  },
  cancelButton: {
    backgroundColor: '#dc2626'
  },
  detailButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  }
});
