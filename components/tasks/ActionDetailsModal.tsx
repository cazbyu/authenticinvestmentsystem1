import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, ActivityIndicator, Platform } from 'react-native';
import { X, Repeat, Save, Trash2, Paperclip, Image as ImageIcon, File, Plus, Bold, Italic, List, ListOrdered } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { Task } from './TaskCard';
import { describeRRule } from '@/lib/rruleUtils';
import { fetchAttachmentsForNotes, uploadNoteAttachment, saveNoteAttachmentMetadata } from '@/lib/noteAttachmentUtils';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';
import AttachmentBadge from '../attachments/AttachmentBadge';
import ImageViewerModal from '../reflections/ImageViewerModal';
import { Linking, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import FollowThroughButtonBar from '../followThrough/FollowThroughButtonBar';
import AssociatedItemsList, { AssociatedItem } from '../followThrough/AssociatedItemsList';
import { fetchAssociatedItems } from '@/lib/followThroughUtils';
import TaskEventForm from './TaskEventForm';

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

export function ActionDetailsModal({ visible, task, onClose, onDelete, onEdit, onRefreshAssociatedItems, onItemPress }: ActionDetailsModalProps) {
  const [taskNotes, setTaskNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteAttachmentsMap, setNoteAttachmentsMap] = useState<Map<string, any[]>>(new Map());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // New note input state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);

  // Follow-through state
  const [associatedItems, setAssociatedItems] = useState<AssociatedItem[]>([]);
  const [loadingAssociatedItems, setLoadingAssociatedItems] = useState(false);
  const [followThroughFormVisible, setFollowThroughFormVisible] = useState(false);
  const [followThroughPreSelectedType, setFollowThroughPreSelectedType] = useState<'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection'>('task');

  useEffect(() => {
    if (visible && task?.id) {
      fetchTaskNotes();
      loadAssociatedItems();
    }
  }, [visible, task?.id]);

  const fetchTaskNotes = async () => {
    if (!task?.id) return;

    setLoadingNotes(true);
    try {
      const supabase = getSupabaseClient();
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
        .eq('parent_type', 'task');

      if (error) throw error;

      const notes = data?.map(item => item.note).filter(Boolean) || [];
      setTaskNotes(notes);

      // Fetch attachments for all notes
      if (notes.length > 0) {
        const noteIds = notes.map(note => note.id);
        const attachmentsMap = await fetchAttachmentsForNotes(noteIds);
        setNoteAttachmentsMap(attachmentsMap);
      }
    } catch (error) {
      console.error('Error fetching task notes:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadAssociatedItems = async () => {
    if (!task?.id) return;

    setLoadingAssociatedItems(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const items = await fetchAssociatedItems(task.id, 'task', user.id);
      setAssociatedItems(items);
    } catch (error) {
      console.error('Error fetching associated items:', error);
    } finally {
      setLoadingAssociatedItems(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const validFiles: any[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.fileSize || 0;
          const fileName = asset.fileName || 'image.jpg';
          let mimeType = 'image/jpeg';
          if (asset.uri) {
            const lowerUri = asset.uri.toLowerCase();
            if (lowerUri.endsWith('.png')) mimeType = 'image/png';
            else if (lowerUri.endsWith('.gif')) mimeType = 'image/gif';
            else if (lowerUri.endsWith('.webp')) mimeType = 'image/webp';
            else if (lowerUri.endsWith('.heic')) mimeType = 'image/heic';
          }

          if (fileSize > MAX_FILE_SIZE) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: mimeType,
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
          setNewNoteAttachments([...newNoteAttachments, ...validFiles]);
        }
        setShowAttachmentPicker(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
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
          setNewNoteAttachments([...newNoteAttachments, ...validFiles]);
        }
        setShowAttachmentPicker(false);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSaveNote = async () => {
    console.log('[ActionDetailsModal] handleSaveNote called');
    if (!task?.id) {
      console.log('[ActionDetailsModal] No task ID, aborting');
      return;
    }
    if (!newNoteContent.trim() && newNoteAttachments.length === 0) {
      console.log('[ActionDetailsModal] No content or attachments, showing alert');
      Alert.alert('Error', 'Please add note content or attachments');
      return;
    }

    console.log('[ActionDetailsModal] Starting save process:', {
      taskId: task.id,
      contentLength: newNoteContent.length,
      attachmentsCount: newNoteAttachments.length
    });

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      console.log('[ActionDetailsModal] User authenticated:', user.id);

      // Create note
      console.log('[ActionDetailsModal] Creating note...');
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: newNoteContent.trim() || '',
        })
        .select()
        .single();

      if (noteError) {
        console.error('[ActionDetailsModal] Note creation error:', noteError);
        throw noteError;
      }
      console.log('[ActionDetailsModal] Note created:', noteData.id);

      // Link note to task
      console.log('[ActionDetailsModal] Linking note to task...');
      const { error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          user_id: user.id,
          parent_id: task.id,
          parent_type: 'task',
          note_id: noteData.id,
        });

      if (joinError) {
        console.error('[ActionDetailsModal] Join creation error:', joinError);
        throw joinError;
      }
      console.log('[ActionDetailsModal] Note linked to task successfully');

      // Upload attachments
      for (const file of newNoteAttachments) {
        try {
          console.log('[ActionDetailsModal] Uploading attachment:', file.name, file.type);
          let fileData: any;
          const response = await fetch(file.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
          fileData = await response.blob();
          console.log('[ActionDetailsModal] File blob created, size:', fileData.size);

          const filePath = await uploadNoteAttachment(fileData, file.name, file.type, user.id);
          if (!filePath) {
            throw new Error(`Failed to upload file: ${file.name}`);
          }
          console.log('[ActionDetailsModal] File uploaded to:', filePath);

          const attachmentId = await saveNoteAttachmentMetadata(noteData.id, user.id, file.name, filePath, file.type, file.size);
          if (!attachmentId) {
            throw new Error(`Failed to save metadata for file: ${file.name}`);
          }
          console.log('[ActionDetailsModal] Attachment metadata saved, id:', attachmentId);
        } catch (fileError) {
          console.error('[ActionDetailsModal] Error uploading file:', file.name, fileError);
          throw new Error(`Failed to upload ${file.name}: ${(fileError as Error).message}`);
        }
      }

      // Clear inputs
      console.log('[ActionDetailsModal] Clearing inputs and refreshing...');
      setNewNoteContent('');
      setNewNoteAttachments([]);
      setShowTextInput(false);

      // Refresh notes
      await fetchTaskNotes();
      console.log('[ActionDetailsModal] Note saved successfully, showing success message');
      Alert.alert('Success', 'Note saved successfully');
    } catch (error) {
      console.error('[ActionDetailsModal] Error saving note:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      console.log('[ActionDetailsModal] Save process complete, resetting saving state');
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!task) return;
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(task);
            onClose();
          },
        },
      ]
    );
  };

  const removeAttachment = (index: number) => {
    setNewNoteAttachments(newNoteAttachments.filter((_, i) => i !== index));
  };

  const handleOpenTaskEventForm = (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection') => {
    if (!task?.id) return;
    setFollowThroughPreSelectedType(type);
    setFollowThroughFormVisible(true);
  };

  const handleFollowThroughFormClose = () => {
    setFollowThroughFormVisible(false);
    loadAssociatedItems();
  };

  // Expose method to refresh associated items when called from parent
  useEffect(() => {
    if (onRefreshAssociatedItems && visible && task?.id) {
      loadAssociatedItems();
    }
  }, [onRefreshAssociatedItems, visible, task?.id]);

  const handleAssociatedItemPress = (item: AssociatedItem) => {
    console.log('Associated item pressed:', item);
    if (onItemPress) {
      onItemPress(item);
    }
  };

  const handleToggleTextInput = () => {
    setShowTextInput(!showTextInput);
  };

  const handleCancelInput = () => {
    setShowTextInput(false);
    setNewNoteContent('');
    setNewNoteAttachments([]);
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const start = selection.start;
    const end = selection.end;
    const selectedText = newNoteContent.substring(start, end);

    let newText: string;
    let newCursorPos: number;

    if (selectedText) {
      // Wrap selected text
      newText = newNoteContent.substring(0, start) + prefix + selectedText + suffix + newNoteContent.substring(end);
      newCursorPos = end + prefix.length + suffix.length;
    } else {
      // Insert at cursor
      newText = newNoteContent.substring(0, start) + prefix + suffix + newNoteContent.substring(end);
      newCursorPos = start + prefix.length;
    }

    setNewNoteContent(newText);

    // Set focus back to input
    setTimeout(() => {
      textInputRef.current?.focus();
      setSelection({ start: newCursorPos, end: newCursorPos });
    }, 10);
  };

  const handleBoldPress = () => {
    insertMarkdown('**', '**');
  };

  const handleItalicPress = () => {
    insertMarkdown('*', '*');
  };

  const handleBulletListPress = () => {
    const start = selection.start;
    const beforeCursor = newNoteContent.substring(0, start);
    const afterCursor = newNoteContent.substring(start);

    // Check if we're at the start of a line
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const isStartOfLine = lastNewline === beforeCursor.length - 1 || beforeCursor.length === 0;

    if (isStartOfLine) {
      insertMarkdown('- ');
    } else {
      insertMarkdown('\n- ');
    }
  };

  const handleNumberedListPress = () => {
    const start = selection.start;
    const beforeCursor = newNoteContent.substring(0, start);
    const afterCursor = newNoteContent.substring(start);

    // Check if we're at the start of a line
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const isStartOfLine = lastNewline === beforeCursor.length - 1 || beforeCursor.length === 0;

    if (isStartOfLine) {
      insertMarkdown('1. ');
    } else {
      insertMarkdown('\n1. ');
    }
  };

  const handleEdit = () => {
    if (!task || !onEdit) return;
    onEdit(task);
    onClose();
  };

  const getModalTitle = () => {
    if (!task) return 'Action Details';
    // Check if it's an event (has start_time and end_time)
    if (task.start_time && task.end_time) {
      return 'Event Details';
    }
    return 'Task Details';
  };

  const formatDateTime = (dateTime, isDateOnly = false) => {
    if (!dateTime) return 'Not set';

    if (isDateOnly) {
      // For date-only strings (YYYY-MM-DD), parse as local date to avoid timezone shifts
      const [year, month, day] = dateTime.split('T')[0].split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      // For datetime strings with timezone info, use normal parsing
      return new Date(dateTime).toLocaleString();
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not set';

    // Handle HH:MM:SS format (time-only from database)
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

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <View style={styles.detailHeaderContent}>
            <Text style={styles.detailTitle}>{getModalTitle()}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>
          {onEdit && (
            <View style={styles.editButtonContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEdit}
                activeOpacity={0.7}
              >
                <Edit size={14} color="#ffffff" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <ScrollView style={styles.detailContent}>
          <Text style={styles.detailTaskTitle}>{task.title}</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>{formatDateTime(task.due_date, true)}</Text>
          </View>
          {task.start_time && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Start Time:</Text>
              <Text style={styles.detailValue}>{formatTime(task.start_time)}</Text>
            </View>
          )}
          {task.end_time && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>End Time:</Text>
              <Text style={styles.detailValue}>{formatTime(task.end_time)}</Text>
            </View>
          )}
          {task.recurrence_rule && (
            <View style={styles.detailSection}>
              <View style={styles.recurrenceHeader}>
                <Repeat size={16} color="#6b7280" />
                <Text style={styles.detailLabel}>Recurrence:</Text>
              </View>
              <Text style={styles.detailValue}>{describeRRule(task.recurrence_rule)}</Text>
              {task.recurrence_end_date && (
                <Text style={styles.detailValue}>
                  Until {formatDateTime(task.recurrence_end_date, true)}
                </Text>
              )}
            </View>
          )}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Priority:</Text>
            <Text style={styles.detailValue}>
              {task.is_urgent && task.is_important ? 'Urgent & Important' :
               !task.is_urgent && task.is_important ? 'Important' :
               task.is_urgent && !task.is_important ? 'Urgent' : 'Normal'}
            </Text>
          </View>
          {task.roles?.length > 0 && (
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
          {task.domains?.length > 0 && (
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
          {/* Goals Section */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Goals:</Text>
            {task.goals?.length > 0 ? (
              <View style={styles.detailTagContainer}>
                {task.goals.map(goal => (
                  <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                    <Text style={styles.tagText}>{goal.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.detailValue}>None</Text>
            )}
          </View>
          {/* Notes Section - Always Visible */}
          <View style={styles.detailSection}>
            <View style={styles.notesHeaderRow}>
              <View style={styles.notesHeaderLeft}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <TouchableOpacity
                  style={styles.squareIconButton}
                  onPress={handleToggleTextInput}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color="#0078d4" />
                </TouchableOpacity>
              </View>
            </View>
            {loadingNotes ? (
              <Text style={styles.detailValue}>Loading notes...</Text>
            ) : (
              <>
                {taskNotes.length > 0 && (
                  <View style={styles.notesContainer}>
                    {taskNotes.map((note, index) => {
                      const noteAttachments = noteAttachmentsMap.get(note.id) || [];
                      const hasContent = note.content && note.content.trim();
                      const hasAttachments = noteAttachments.length > 0;

                      // Only show notes that have content or attachments
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
                              {noteAttachments.length > 4 && (
                                <View style={styles.moreAttachmentsIndicator}>
                                  <Text style={styles.moreAttachmentsText}>+{noteAttachments.length - 4}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                      );
                    })}
                  </View>
                )}

                {/* Conditional Text Input */}
                {showTextInput && (
                  <>
                    <View style={styles.textInputContainer}>
                      <TextInput
                        ref={textInputRef}
                        style={styles.noteInput}
                        multiline
                        placeholder="Share a success, joy or meaningful moment you want to celebrate . . ."
                        value={newNoteContent}
                        onChangeText={setNewNoteContent}
                        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
                        placeholderTextColor="#9ca3af"
                        autoFocus
                      />
                    </View>
                    {/* Formatting Toolbar */}
                    <View style={styles.toolbarContainer}>
                      <View style={styles.toolbarButtonsRow}>
                        <TouchableOpacity
                          style={styles.toolbarButton}
                          onPress={handleBoldPress}
                          activeOpacity={0.7}
                        >
                          <Bold size={18} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.toolbarButton}
                          onPress={handleItalicPress}
                          activeOpacity={0.7}
                        >
                          <Italic size={18} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.toolbarButton}
                          onPress={handleBulletListPress}
                          activeOpacity={0.7}
                        >
                          <List size={18} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.toolbarButton}
                          onPress={handleNumberedListPress}
                          activeOpacity={0.7}
                        >
                          <ListOrdered size={18} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.toolbarButton}
                          onPress={handlePickDocument}
                          activeOpacity={0.7}
                        >
                          <Paperclip size={18} color="#6b7280" />
                          {newNoteAttachments.length > 0 && (
                            <View style={styles.toolbarAttachmentBadge}>
                              <Text style={styles.attachmentBadgeText}>{newNoteAttachments.length}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.toolbarText}>Markdown supported</Text>
                    </View>
                  </>
                )}

                {/* Attachment Previews */}
                {newNoteAttachments.length > 0 && (
                  <View style={styles.attachmentPreviewContainer}>
                    <Text style={styles.attachmentPreviewLabel}>Attachments ({newNoteAttachments.length})</Text>
                    <View style={styles.attachmentPreviewGrid}>
                      {newNoteAttachments.map((file, index) => (
                        <View key={index} style={styles.attachmentPreviewItem}>
                          {file.type?.startsWith('image/') ? (
                            <Image
                              source={{ uri: file.uri }}
                              style={styles.previewThumbnail}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.previewDocumentThumbnail}>
                              <File size={24} color="#6b7280" />
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.removeAttachmentButton}
                            onPress={() => removeAttachment(index)}
                          >
                            <X size={12} color="#ffffff" />
                          </TouchableOpacity>
                          <Text style={styles.previewFileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Save/Cancel Buttons */}
                {(showTextInput || newNoteAttachments.length > 0) && (
                  <View style={styles.noteActionsRow}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelInput}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.saveNoteButton,
                        (saving || (!newNoteContent.trim() && newNoteAttachments.length === 0)) && styles.saveNoteButtonDisabled
                      ]}
                      onPress={handleSaveNote}
                      disabled={saving || (!newNoteContent.trim() && newNoteAttachments.length === 0)}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.saveNoteButtonText}>Save Note</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Follow Through Actions or Thoughts */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Follow Through Actions or Thoughts:</Text>

            <FollowThroughButtonBar
              onPressTask={() => handleOpenTaskEventForm('task')}
              onPressEvent={() => handleOpenTaskEventForm('event')}
              onPressRose={() => handleOpenTaskEventForm('rose')}
              onPressThorn={() => handleOpenTaskEventForm('thorn')}
              onPressReflection={() => handleOpenTaskEventForm('reflection')}
              onPressDepositIdea={() => handleOpenTaskEventForm('depositIdea')}
            />

            <AssociatedItemsList
              items={associatedItems}
              loading={loadingAssociatedItems}
              onItemPress={handleAssociatedItemPress}
              emptyMessage="No associated actions or thoughts yet"
            />
          </View>

          {task.delegates?.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Delegated To:</Text>
              <View style={styles.detailTagContainer}>
                {task.delegates.map(delegate => (
                  <View key={delegate.id} style={[styles.tag, styles.delegateTag]}>
                    <Text style={styles.tagText}>{delegate.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.detailActions}>
          <TouchableOpacity
            style={[
              styles.detailButton,
              styles.saveButton,
              (saving || (!newNoteContent.trim() && newNoteAttachments.length === 0)) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveNote}
            disabled={saving || (!newNoteContent.trim() && newNoteAttachments.length === 0)}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Save size={16} color="#ffffff" />
                <Text style={styles.detailButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.detailButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Trash2 size={16} color="#ffffff" />
            <Text style={styles.detailButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />

      {/* Follow-through TaskEventForm Modal */}
      <Modal visible={followThroughFormVisible} animationType="slide" presentationStyle="fullScreen">
        <TaskEventForm
          mode="create"
          onSubmitSuccess={handleFollowThroughFormClose}
          onClose={() => setFollowThroughFormVisible(false)}
          preSelectedType={followThroughPreSelectedType}
          parentId={task?.id}
          parentType="task"
        />
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  detailContainer: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  detailHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff'
  },
  detailHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  editButtonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#0078d4',
    borderRadius: 6,
    gap: 6,
    width: 80,
    height: 30,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  detailContentContainer: {
    flex: 1,
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
  detailSection: {
    marginBottom: 16
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
  goalTag: {
    backgroundColor: '#bfdbfe'
  },
  delegateTag: {
    backgroundColor: '#d1fae5'
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151'
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  squareIconButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  attachmentBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: 8,
  },
  textInputContainer: {
    marginTop: 12,
  },
  noteItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  noteContent: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  noteAttachmentsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  attachmentsHeader: {
    marginBottom: 8,
  },
  attachmentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentThumbnailWrapper: {
    width: 70,
    alignItems: 'center',
    gap: 4,
  },
  thumbnailImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  documentThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailFileName: {
    fontSize: 9,
    textAlign: 'center',
    width: '100%',
    color: '#6b7280',
  },
  moreAttachmentsIndicator: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAttachmentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  recurrenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 6
  },
  saveButton: {
    backgroundColor: '#0078d4'
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.5,
  },
  deleteButton: {
    backgroundColor: '#dc2626'
  },
  detailButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  noteInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 0,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    color: '#1f2937',
    textAlignVertical: 'top',
  },
  noteActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  saveNoteButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  saveNoteButtonDisabled: {
    opacity: 0.6,
  },
  saveNoteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  attachmentPreviewContainer: {
    marginTop: 12,
  },
  attachmentPreviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  attachmentPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentPreviewItem: {
    width: 80,
    alignItems: 'center',
    position: 'relative',
  },
  previewThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  previewDocumentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFileName: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
  },
  toolbarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -8,
  },
  toolbarButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  toolbarAttachmentBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
