import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, ActivityIndicator, Platform, Image, Linking } from 'react-native';
import { X, Play, Save, Trash2, Image as ImageIcon, File } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchAttachmentsForNotes, uploadNoteAttachment, saveNoteAttachmentMetadata } from '@/lib/noteAttachmentUtils';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';
import AttachmentBadge from '../attachments/AttachmentBadge';
import ImageViewerModal from '../reflections/ImageViewerModal';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import FollowThroughButtonBar from '../followThrough/FollowThroughButtonBar';
import AssociatedItemsList, { AssociatedItem } from '../followThrough/AssociatedItemsList';
import { fetchAssociatedItems, determineParentType } from '@/lib/followThroughUtils';

interface DepositIdea {
  id: string;
  title: string;
  is_active?: boolean;
  created_at?: string;
  activated_at?: string;
  archived?: boolean;
  follow_up?: boolean;
  activated_task_id?: string;
  roles?: Array<{id: string; label: string}>;
  domains?: Array<{id: string; name: string}>;
  goals?: Array<{id: string; title: string}>;
  keyRelationships?: Array<{id: string; name: string}>;
  has_notes?: boolean;
}

interface DepositIdeaDetailModalProps {
  visible: boolean;
  depositIdea: DepositIdea | null;
  onClose: () => void;
  onDelete: (depositIdea: DepositIdea) => void;
  onActivate: (depositIdea: DepositIdea) => void;
  onOpenFollowThrough?: (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection', parentId: string, parentType: string) => void;
  onRefreshAssociatedItems?: () => void;
}

export function DepositIdeaDetailModal({
  visible,
  depositIdea,
  onClose,
  onDelete,
  onActivate,
  onOpenFollowThrough,
  onRefreshAssociatedItems
}: DepositIdeaDetailModalProps) {
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteAttachmentsMap, setNoteAttachmentsMap] = useState<Map<string, any[]>>(new Map());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // New note input state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Follow-through state
  const [associatedItems, setAssociatedItems] = useState<AssociatedItem[]>([]);
  const [loadingAssociatedItems, setLoadingAssociatedItems] = useState(false);

  useEffect(() => {
    if (visible && depositIdea?.id) {
      fetchNotes();
      loadAssociatedItems();
    }
  }, [visible, depositIdea?.id]);

  const fetchNotes = async () => {
    if (!depositIdea?.id) return;

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
        .eq('parent_id', depositIdea.id)
        .eq('parent_type', 'depositIdea');

      if (error) throw error;

      const notesList = data?.map(item => item.note).filter(Boolean) || [];
      setNotes(notesList);

      // Fetch attachments for all notes
      if (notesList.length > 0) {
        const noteIds = notesList.map(note => note.id);
        const attachmentsMap = await fetchAttachmentsForNotes(noteIds);
        setNoteAttachmentsMap(attachmentsMap);
      }
    } catch (error) {
      console.error('Error fetching deposit idea notes:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadAssociatedItems = async () => {
    if (!depositIdea?.id) return;

    setLoadingAssociatedItems(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const items = await fetchAssociatedItems(depositIdea.id, 'depositIdea', user.id);
      setAssociatedItems(items);
    } catch (error) {
      console.error('Error fetching associated items:', error);
    } finally {
      setLoadingAssociatedItems(false);
    }
  };

  const handleOpenTaskEventForm = (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection') => {
    if (!depositIdea?.id || !onOpenFollowThrough) return;
    onOpenFollowThrough(type, depositIdea.id, 'depositIdea');
  };

  // Expose method to refresh associated items when called from parent
  useEffect(() => {
    if (onRefreshAssociatedItems && visible && depositIdea?.id) {
      loadAssociatedItems();
    }
  }, [onRefreshAssociatedItems, visible, depositIdea?.id]);

  const handleAssociatedItemPress = (item: AssociatedItem) => {
    console.log('Associated item pressed:', item);
  };

  const handleActivate = () => {
    try {
      onActivate(depositIdea);
      onClose();
    } catch (error) {
      console.error('Error in activation:', error);
    }
  };

  const handleDelete = () => {
    if (!depositIdea) return;
    Alert.alert(
      'Delete Deposit Idea',
      'Are you sure you want to delete this deposit idea?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(depositIdea);
            onClose();
          },
        },
      ]
    );
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
            `The following files exceed the 5 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setNewNoteAttachments([...newNoteAttachments, ...validFiles]);
        }
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
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
            `The following files exceed the 5 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setNewNoteAttachments([...newNoteAttachments, ...validFiles]);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSaveNote = async () => {
    if (!depositIdea?.id) return;
    if (!newNoteContent.trim() && newNoteAttachments.length === 0) {
      Alert.alert('Error', 'Please add note content or attachments');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Create note
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: newNoteContent.trim() || '',
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Link note to deposit idea
      const { error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: depositIdea.id,
          parent_type: 'depositIdea',
          note_id: noteData.id,
        });

      if (joinError) throw joinError;

      // Upload attachments
      for (const file of newNoteAttachments) {
        let fileData: any;
        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          fileData = await response.blob();
        } else {
          const response = await fetch(file.uri);
          fileData = await response.blob();
        }

        const filePath = await uploadNoteAttachment(fileData, file.name, file.type, user.id);
        if (filePath) {
          await saveNoteAttachmentMetadata(noteData.id, user.id, file.name, filePath, file.type, file.size);
        }
      }

      // Clear inputs
      setNewNoteContent('');
      setNewNoteAttachments([]);

      // Refresh notes
      await fetchNotes();
      Alert.alert('Success', 'Note saved successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeAttachment = (index: number) => {
    setNewNoteAttachments(newNoteAttachments.filter((_, i) => i !== index));
  };

  const formatDateTime = (dateTime) => dateTime ? new Date(dateTime).toLocaleString() : 'Not set';

  if (!depositIdea) return null;
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Deposit Idea Details</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          <Text style={styles.ideaTitle}>{depositIdea.title}</Text>
          
          <View style={styles.section}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>
              {depositIdea.activated_at ? 'Activated' : depositIdea.is_active ? 'Active' : 'Archived'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Created:</Text>
            <Text style={styles.value}>{formatDateTime(depositIdea.created_at)}</Text>
          </View>

          {depositIdea.activated_at && (
            <View style={styles.section}>
              <Text style={styles.label}>Activated:</Text>
              <Text style={styles.value}>{formatDateTime(depositIdea.activated_at)}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Follow-up Goal:</Text>
            <Text style={styles.value}>{depositIdea.follow_up ? 'Yes' : 'No'}</Text>
          </View>

          {depositIdea.roles?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Roles:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.roles.map(role => (
                  <View key={role.id} style={[styles.tag, styles.roleTag]}>
                    <Text style={styles.tagText}>{role.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {depositIdea.domains?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Domains:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.domains.map(domain => (
                  <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                    <Text style={styles.tagText}>{domain.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {depositIdea.goals?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Goals:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.goals.map(goal => (
                  <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                    <Text style={styles.tagText}>{goal.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {depositIdea.keyRelationships?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Key Relationships:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.keyRelationships.map(kr => (
                  <View key={kr.id} style={[styles.tag, styles.krTag]}>
                    <Text style={styles.tagText}>{kr.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {notes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Notes:</Text>
              {loadingNotes ? (
                <Text style={styles.value}>Loading notes...</Text>
              ) : (
                <View style={styles.notesContainer}>
                  {notes.map((note, index) => {
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
            </View>
          )}
          {/* Add New Note Section */}
          <View style={styles.addNoteSection}>
            <Text style={styles.addNoteSectionTitle}>Add a Note</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="Add a note or reflection..."
              value={newNoteContent}
              onChangeText={setNewNoteContent}
              placeholderTextColor="#9ca3af"
            />

            {/* Attachment Buttons */}
            <View style={styles.attachmentButtonsRow}>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={handlePickImage}
              >
                <ImageIcon size={16} color="#0078d4" />
                <Text style={styles.attachmentButtonText}>Add Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={handlePickDocument}
              >
                <File size={16} color="#0078d4" />
                <Text style={styles.attachmentButtonText}>Add Document</Text>
              </TouchableOpacity>
            </View>

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
          </View>

          {/* Follow Through Actions or Thoughts */}
          <View style={styles.section}>
            <Text style={styles.label}>Follow Through Actions or Thoughts:</Text>

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
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.activateButton]}
            onPress={handleActivate}
          >
            <Play size={16} color="#ffffff" />
            <Text style={styles.buttonText}>Activate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveNote}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Save size={16} color="#ffffff" />
                <Text style={styles.buttonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Trash2 size={16} color="#ffffff" />
            <Text style={styles.buttonText}>Delete</Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937' 
  },
  contentContainer: {
    flex: 1, 
  },
  content: {
    padding: 16 
  },
  ideaTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1f2937', 
    marginBottom: 20 
  },
  section: { 
    marginBottom: 16 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#6b7280', 
    marginBottom: 4 
  },
  value: { 
    fontSize: 16, 
    color: '#1f2937' 
  },
  tagContainer: { 
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
  krTag: { 
    backgroundColor: '#e0f2fe' 
  },
  tagText: { 
    fontSize: 10, 
    fontWeight: '500', 
    color: '#374151' 
  },
  notesContainer: {
    marginTop: 8,
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
  actions: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6
  },
  activateButton: {
    backgroundColor: '#16a34a'
  },
  saveButton: {
    backgroundColor: '#0078d4'
  },
  deleteButton: {
    backgroundColor: '#dc2626'
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  addNoteSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addNoteSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    color: '#1f2937',
    textAlignVertical: 'top',
  },
  attachmentButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 6,
  },
  attachmentButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0078d4',
  },
  attachmentPreviewContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
});