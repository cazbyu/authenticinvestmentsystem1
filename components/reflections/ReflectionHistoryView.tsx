import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { ReflectionWithRelations, ReflectionAttachment, fetchAttachmentsForReflections } from '@/lib/reflectionUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';
import ImageViewerModal from './ImageViewerModal';
import AttachmentBadge from '../attachments/AttachmentBadge';

interface ReflectionHistoryViewProps {
  onReflectionPress?: (reflection: ReflectionWithRelations) => void;
}

type TimelineItemType = 'reflection' | 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'note';

interface ParentItemData {
  id: string;
  title?: string;
  completed_at?: string;
  archived?: boolean;
  is_urgent?: boolean;
  is_important?: boolean;
  type?: string;
}

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  created_at: string;
  content?: string;
  date?: string;
  parent_type?: string;
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  attachments?: ReflectionAttachment[];
  parentItem?: ParentItemData;
  isActive?: boolean;
  priorityColor?: string;
}

export default function ReflectionHistoryView({ onReflectionPress }: ReflectionHistoryViewProps) {
  const { colors } = useTheme();
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ReflectionAttachment[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchTimelineData();

    const handleReflectionChange = () => {
      setPage(1);
      setHasMore(true);
      fetchTimelineData(true);
    };

    eventBus.on(EVENTS.REFLECTION_CREATED, handleReflectionChange);
    eventBus.on(EVENTS.REFLECTION_UPDATED, handleReflectionChange);
    eventBus.on(EVENTS.REFLECTION_DELETED, handleReflectionChange);

    return () => {
      eventBus.off(EVENTS.REFLECTION_CREATED, handleReflectionChange);
      eventBus.off(EVENTS.REFLECTION_UPDATED, handleReflectionChange);
      eventBus.off(EVENTS.REFLECTION_DELETED, handleReflectionChange);
    };
  }, []);

  const fetchTimelineData = async (reset: boolean = false) => {
    if (!hasMore && !reset) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all reflections
      const { data: reflectionsData, error: reflectionsError } = await supabase
        .from('0008-ap-reflections')
        .select('*')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (reflectionsError) throw reflectionsError;

      // Fetch attachments for all reflections in batch
      const reflectionIds = reflectionsData?.map((r) => r.id) || [];
      const attachmentsMap = await fetchAttachmentsForReflections(reflectionIds);

      // Fetch related data for each reflection
      const reflectionsWithRelations: TimelineItem[] = reflectionsData
        ? await Promise.all(
            reflectionsData.map(async (reflection) => {
              const [rolesData, domainsData, keyRelsData] = await Promise.all([
                fetchReflectionRoles(reflection.id),
                fetchReflectionDomains(reflection.id),
                fetchReflectionKeyRelationships(reflection.id),
              ]);

              const attachments = attachmentsMap.get(reflection.id) || [];

              return {
                ...reflection,
                type: 'reflection' as TimelineItemType,
                roles: rolesData,
                domains: domainsData,
                keyRelationships: keyRelsData,
                attachments,
              };
            })
          )
        : [];

      // Fetch all notes for the user
      const { data: notesData, error: notesError } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          parent_id,
          parent_type,
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (notesError) throw notesError;

      // Get unique parent IDs by type
      const taskParentIds = notesData?.filter((n: any) => n.parent_type === 'task').map((n: any) => n.parent_id) || [];
      const depositIdeaIds = notesData?.filter((n: any) => n.parent_type === 'depositIdea').map((n: any) => n.parent_id) || [];
      const withdrawalIds = notesData?.filter((n: any) => n.parent_type === 'withdrawal').map((n: any) => n.parent_id) || [];

      // Fetch parent item data
      const parentItemsMap = new Map<string, ParentItemData>();

      if (taskParentIds.length > 0) {
        const { data: tasksData } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, completed_at, is_urgent, is_important, type')
          .in('id', taskParentIds);
        tasksData?.forEach((task: any) => {
          parentItemsMap.set(task.id, task);
        });
      }

      if (depositIdeaIds.length > 0) {
        const { data: depositIdeasData } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, archived')
          .in('id', depositIdeaIds);
        depositIdeasData?.forEach((di: any) => {
          parentItemsMap.set(di.id, di);
        });
      }

      if (withdrawalIds.length > 0) {
        const { data: withdrawalsData } = await supabase
          .from('0008-ap-withdrawals')
          .select('id, title')
          .in('id', withdrawalIds);
        withdrawalsData?.forEach((w: any) => {
          parentItemsMap.set(w.id, { ...w, completed_at: new Date().toISOString() });
        });
      }

      // Transform notes into timeline items with parent item data
      const notesAsTimelineItems: TimelineItem[] = notesData
        ? notesData
            .filter((item: any) => item.note && item.note.id)
            .map((item: any) => {
              const parentItem = parentItemsMap.get(item.parent_id);
              let type = item.parent_type || 'note';

              // If parent is a task, determine if it's task or event
              if (item.parent_type === 'task' && parentItem?.type) {
                type = parentItem.type;
              }

              // Determine if item is active
              let isActive = false;
              let priorityColor = undefined;

              if (parentItem) {
                if (item.parent_type === 'task') {
                  isActive = !parentItem.completed_at;
                  if (isActive) {
                    // Calculate priority color
                    if (parentItem.is_urgent && parentItem.is_important) {
                      priorityColor = '#ef4444';
                    } else if (!parentItem.is_urgent && parentItem.is_important) {
                      priorityColor = '#10b981';
                    } else if (parentItem.is_urgent && !parentItem.is_important) {
                      priorityColor = '#f59e0b';
                    } else {
                      priorityColor = '#6b7280';
                    }
                  }
                } else if (item.parent_type === 'depositIdea') {
                  isActive = !parentItem.archived;
                  if (isActive) priorityColor = '#8b5cf6';
                }
              }

              return {
                id: item.note.id,
                type: type as TimelineItemType,
                content: item.note.content,
                created_at: item.note.created_at,
                parent_type: item.parent_type,
                parentItem,
                isActive,
                priorityColor,
              };
            })
        : [];

      // Merge and sort by created_at
      const combinedItems = [...reflectionsWithRelations, ...notesAsTimelineItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Apply pagination
      const currentPage = reset ? 1 : page;
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const paginatedItems = combinedItems.slice(from, to);

      if (reset) {
        setTimelineItems(paginatedItems);
      } else {
        setTimelineItems((prev) => [...prev, ...paginatedItems]);
      }

      setHasMore(to < combinedItems.length);
      if (!reset) {
        setPage(currentPage + 1);
      } else {
        setPage(2);
      }
    } catch (error) {
      console.error('Error fetching timeline data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchReflectionRoles = async (reflectionId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('role_id, 0008-ap-roles(id, label, color)')
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId);

      if (error) throw error;
      if (!data) return [];

      return data
        .map((item: any) => item['0008-ap-roles'])
        .filter((role: any) => role !== null);
    } catch (error) {
      console.error('Error fetching reflection roles:', error);
      return [];
    }
  };

  const fetchReflectionDomains = async (reflectionId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('domain_id, 0008-ap-domains(id, name)')
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId);

      if (error) throw error;
      if (!data) return [];

      return data
        .map((item: any) => item['0008-ap-domains'])
        .filter((domain: any) => domain !== null);
    } catch (error) {
      console.error('Error fetching reflection domains:', error);
      return [];
    }
  };

  const fetchReflectionKeyRelationships = async (reflectionId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('key_relationship_id, 0008-ap-key-relationships(id, name)')
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId);

      if (error) throw error;
      if (!data) return [];

      return data
        .map((item: any) => item['0008-ap-key-relationships'])
        .filter((kr: any) => kr !== null);
    } catch (error) {
      console.error('Error fetching reflection key relationships:', error);
      return [];
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchTimelineData(true);
  };

  const formatDateTime = (dateString: string, createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getItemTypeBadgeColor = (type: TimelineItemType) => {
    switch (type) {
      case 'event':
        return '#10b981';
      case 'task':
        return '#0078d4';
      case 'depositIdea':
        return '#8b5cf6';
      case 'withdrawal':
        return '#f59e0b';
      case 'reflection':
        return colors.primary;
      default:
        return colors.primary;
    }
  };

  const getItemTypeLabel = (type: TimelineItemType) => {
    switch (type) {
      case 'event':
        return 'Event';
      case 'task':
        return 'Task';
      case 'depositIdea':
        return 'Deposit Idea';
      case 'withdrawal':
        return 'Withdrawal';
      case 'reflection':
        return 'Reflection';
      default:
        return 'Note';
    }
  };

  const renderTimelineItem = ({ item }: { item: TimelineItem }) => {
    if (item.type === 'reflection') {
      return renderReflectionCard(item);
    }
    return renderNoteCard(item);
  };

  const handleImagePress = (images: ReflectionAttachment[], index: number) => {
    setSelectedImages(images);
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
  };

  const renderReflectionCard = (item: TimelineItem) => {
    const imageAttachments = item.attachments?.filter((att) => att.file_type.startsWith('image/')) || [];

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        onPress={() => onReflectionPress?.(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {formatDateTime(item.date || '', item.created_at)}
            </Text>
            {item.attachments && item.attachments.length > 0 && (
              <AttachmentBadge count={item.attachments.length} size="small" />
            )}
          </View>
          <View style={[styles.tagBadge, { backgroundColor: getItemTypeBadgeColor(item.type) }]}>
            <Text style={styles.tagBadgeText}>{getItemTypeLabel(item.type)}</Text>
          </View>
        </View>
        <Text style={[styles.contentPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {truncateContent(item.content || '')}
        </Text>

        {imageAttachments.length > 0 && (
          <View style={styles.imagePreviewContainer}>
            {imageAttachments.slice(0, 4).map((attachment, index) => (
              <TouchableOpacity
                key={attachment.id}
                onPress={(e) => {
                  e.stopPropagation();
                  handleImagePress(imageAttachments, index);
                }}
                style={styles.imageThumbnail}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: attachment.public_url }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
            {imageAttachments.length > 4 && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleImagePress(imageAttachments, 4);
                }}
                style={[styles.imageThumbnail, styles.moreImagesThumbnail]}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: imageAttachments[4].public_url }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
                <View style={styles.moreImagesOverlay}>
                  <Text style={styles.moreImagesText}>+{imageAttachments.length - 4}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.metadataContainer}>
          {item.roles && item.roles.length > 0 && (
            <View style={styles.metadataRow}>
              <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Roles:</Text>
              <View style={styles.tagsRow}>
                {item.roles.slice(0, 3).map((role) => (
                  <View key={`role-${role.id}`} style={[styles.tag, styles.roleTag]}>
                    <Text style={styles.tagText} numberOfLines={1}>
                      {role.label}
                    </Text>
                  </View>
                ))}
                {item.roles.length > 3 && (
                  <View style={[styles.tag, styles.moreTag]}>
                    <Text style={styles.tagText}>+{item.roles.length - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {item.domains && item.domains.length > 0 && (
            <View style={styles.metadataRow}>
              <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Domains:</Text>
              <View style={styles.tagsRow}>
                {item.domains.slice(0, 3).map((domain) => (
                  <View key={`domain-${domain.id}`} style={[styles.tag, styles.domainTag]}>
                    <Text style={styles.tagText} numberOfLines={1}>
                      {domain.name}
                    </Text>
                  </View>
                ))}
                {item.domains.length > 3 && (
                  <View style={[styles.tag, styles.moreTag]}>
                    <Text style={styles.tagText}>+{item.domains.length - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderNoteCard = (item: TimelineItem) => (
    <TouchableOpacity
      style={[
        styles.card,
        styles.noteCard,
        {
          backgroundColor: item.isActive ? '#f3f4f6' : colors.surface,
          borderColor: item.isActive && item.priorityColor ? item.priorityColor : colors.border,
          borderLeftColor: item.isActive && item.priorityColor ? item.priorityColor : getItemTypeBadgeColor(item.type),
          borderWidth: item.isActive ? 2 : 1,
        },
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {new Date(item.created_at).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </Text>
        <View style={[styles.tagBadge, { backgroundColor: getItemTypeBadgeColor(item.type) }]}>
          <Text style={styles.tagBadgeText}>{getItemTypeLabel(item.type)}</Text>
        </View>
      </View>
      <Text style={[styles.contentPreview, { color: colors.textSecondary }]} numberOfLines={3}>
        {item.content || ''}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No reflections yet. Create your first reflection using the Journal button.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading || refreshing) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={timelineItems}
        renderItem={renderTimelineItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        onEndReached={() => fetchTimelineData()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
      />

      <ImageViewerModal
        visible={imageViewerVisible}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteCard: {
    minHeight: 80,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  contentPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  metadataContainer: {
    marginTop: 8,
    gap: 6,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataLabel: {
    fontSize: 10,
    fontWeight: '600',
    minWidth: 50,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleTag: {
    backgroundColor: '#fce7f3',
    borderColor: '#f3e8ff',
  },
  domainTag: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  moreTag: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  tagText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#374151',
  },
  notesSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  notesSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  notePreview: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#0078d4',
  },
  noteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  noteTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  noteTypeBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
  },
  moreNotesText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  imageThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesThumbnail: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
