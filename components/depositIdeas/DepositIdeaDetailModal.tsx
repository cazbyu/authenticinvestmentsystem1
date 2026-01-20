import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import { X, Play, Edit, Trash2 } from 'lucide-react-native';
import Autolink from 'react-native-autolink';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchAttachmentsForNotes } from '@/lib/noteAttachmentUtils';
import ImageViewerModal from '../reflections/ImageViewerModal';
import FollowThroughButtonBar from '../followThrough/FollowThroughButtonBar';
import AssociatedItemsList, { AssociatedItem } from '../followThrough/AssociatedItemsList';
import { fetchAssociatedItems } from '@/lib/followThroughUtils';
import TaskEventForm from '../tasks/TaskEventForm';
import ParentItemInfo from '../followThrough/ParentItemInfo';

const depositIdeaImage = require('@/assets/images/deposit-idea.png');

interface DepositIdea {
  id: string;
  title: string;
  is_active?: boolean;
  created_at?: string;
  activated_at?: string;
  archived?: boolean;
  follow_up?: boolean;
  activated_task_id?: string;
  parent_id?: string;
  parent_type?: string;
  roles?: Array<{id: string; label: string; color?: string}>;
  domains?: Array<{id: string; name: string; color?: string}>;
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
  onEdit?: (depositIdea: DepositIdea) => void;
  onRefreshAssociatedItems?: () => void;
  onItemPress?: (item: AssociatedItem) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export function DepositIdeaDetailModal({
  visible,
  depositIdea,
  onClose,
  onDelete,
  onActivate,
  onEdit,
  onRefreshAssociatedItems,
  onItemPress
}: DepositIdeaDetailModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
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

  useEffect(() => {
    if (visible && depositIdea?.id) {
      fetchNotes();
      loadAssociatedItems();
      setIsEditMode(false);
    }
  }, [visible, depositIdea?.id]);

  useEffect(() => {
    const attachments: any[] = [];
    noteAttachmentsMap.forEach((noteAttachments) => {
      attachments.push(...noteAttachments);
    });
    setAllAttachments(attachments);
  }, [noteAttachmentsMap]);

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
        .eq('parent_type', 'depositIdea')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedNotes = (data || [])
        .map((item: any) => item.note)
        .filter(Boolean)
        .sort((a: Note, b: Note) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setNotes(fetchedNotes);

      if (fetchedNotes.length > 0) {
        const noteIds = fetchedNotes.map((n: Note) => n.id);
        const attachmentsData = await fetchAttachmentsForNotes(noteIds);
        setNoteAttachmentsMap(attachmentsData);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadAssociatedItems = async () => {
    if (!depositIdea?.id) return;
    setLoadingAssociatedItems(true);
    try {
      const items = await fetchAssociatedItems(depositIdea.id, 'depositIdea');
      setAssociatedItems(items);
    } catch (error) {
      console.error('Error loading associated items:', error);
    } finally {
      setLoadingAssociatedItems(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Deposit Idea',
      'Are you sure you want to delete this deposit idea?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (depositIdea) {
              onDelete(depositIdea);
              onClose();
            }
          },
        },
      ]
    );
  };

  const handleActivate = () => {
    if (depositIdea) {
      onActivate(depositIdea);
    }
  };

  const handleFollowThroughPress = (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection') => {
    setFollowThroughPreSelectedType(type);
    setFollowThroughFormVisible(true);
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!depositIdea) return null;

  return (
    <>
      <Modal visible={visible && !followThroughFormVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Deposit Idea</Text>
            <View style={styles.headerActions}>
              {!isEditMode && !depositIdea.is_active && (
                <TouchableOpacity
                  onPress={handleActivate}
                  style={styles.activateButton}
                >
                  <Play size={18} color="#fff" fill="#fff" />
                  <Text style={styles.activateButtonText}>Activate</Text>
                </TouchableOpacity>
              )}
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
                <Image source={depositIdeaImage} style={styles.titleImage} resizeMode="contain" />
                <View style={styles.titleContent}>
                  <Text style={styles.title}>{depositIdea.title}</Text>
                  <Text style={styles.subtitle}>Future Idea</Text>
                </View>
              </View>

              {/* Status Badge */}
              {depositIdea.is_active && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>✓ Activated</Text>
                </View>
              )}

              {/* Alignment Chips - Roles, Domains, Key Relationships */}
              {((depositIdea.roles && depositIdea.roles.length > 0) ||
                (depositIdea.domains && depositIdea.domains.length > 0) ||
                (depositIdea.keyRelationships && depositIdea.keyRelationships.length > 0)) && (
                <View style={styles.alignmentChips}>
                  {depositIdea.roles?.map(role => (
                    <View key={role.id} style={[styles.chip, { backgroundColor: role.color || '#e0e7ff' }]}>
                      <Text style={styles.chipText}>{role.label}</Text>
                    </View>
                  ))}
                  {depositIdea.domains?.map(domain => (
                    <View key={domain.id} style={[styles.chip, { backgroundColor: domain.color || '#dbeafe' }]}>
                      <Text style={styles.chipText}>{domain.name}</Text>
                    </View>
                  ))}
                  {depositIdea.keyRelationships?.map(kr => (
                    <View key={kr.id} style={[styles.chip, { backgroundColor: '#fef3c7' }]}>
                      <Text style={styles.chipText}>{kr.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Parent Info */}
              {depositIdea.parent_id && depositIdea.parent_type && (
                <View style={styles.parentInfoContainer}>
                  <ParentItemInfo
                    parentId={depositIdea.parent_id}
                    parentType={depositIdea.parent_type as any}
                    onPress={() => {
                      if (onItemPress) {
                        onItemPress({
                          id: depositIdea.parent_id!,
                          type: depositIdea.parent_type as any,
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
              <Text style={styles.sectionLabel}>Notes</Text>
              {loadingNotes ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : notes.length > 0 ? (
                <View style={styles.notesContainer}>
                  {notes.map(note => (
                    <Autolink
                      key={note.id}
                      text={note.content}
                      linkStyle={{ color: '#3b82f6', textDecorationLine: 'underline' }}
                      onPress={(url) => Linking.openURL(url)}
                      style={styles.noteText}
                    />
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
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>Date Created</Text>
                  <Text style={styles.metadataValue}>{formatDateTime(depositIdea.created_at || null)}</Text>
                </View>
                {depositIdea.activated_at && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Activated On</Text>
                    <Text style={styles.metadataValue}>{formatDateTime(depositIdea.activated_at)}</Text>
                  </View>
                )}
                {depositIdea.follow_up && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Follow-Up</Text>
                    <Text style={styles.metadataValue}>Yes</Text>
                  </View>
                )}
              </View>

              {/* Delete Button */}
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <Trash2 size={16} color="#dc2626" />
                <Text style={styles.deleteText}>Delete Deposit Idea</Text>
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
          parentId={depositIdea.id}
          parentType="depositIdea"
        />
      )}

      {/* Edit Form Modal */}
      {isEditMode && depositIdea && (
        <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
          <TaskEventForm
            mode="edit"
            initialData={{
              ...depositIdea,
              type: 'depositIdea',
              roles: depositIdea.roles || [],
              domains: depositIdea.domains || [],
              goals: depositIdea.goals || [],
              keyRelationships: depositIdea.keyRelationships || [],
            }}
            onClose={() => {
              setIsEditMode(false);
            }}
            onSubmitSuccess={async () => {
              setIsEditMode(false);
              await fetchNotes();
              await loadAssociatedItems();
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
    alignItems: 'center',
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleImage: {
    width: 32,
    height: 32,
    marginRight: 12,
    marginTop: 2,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    lineHeight: 32,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065f46',
  },
  alignmentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
});
