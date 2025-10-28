import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { ReflectionWithRelations } from '@/lib/reflectionUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

interface ReflectionHistoryViewProps {
  onReflectionPress?: (reflection: ReflectionWithRelations) => void;
}

export default function ReflectionHistoryView({ onReflectionPress }: ReflectionHistoryViewProps) {
  const { colors } = useTheme();
  const [reflections, setReflections] = useState<ReflectionWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchReflections();

    const handleReflectionChange = () => {
      setPage(1);
      setHasMore(true);
      fetchReflections(true);
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

  const fetchReflections = async (reset: boolean = false) => {
    if (!hasMore && !reset) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const currentPage = reset ? 1 : page;
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('0008-ap-reflections')
        .select('*')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        // Fetch related data for each reflection
        const reflectionsWithRelations = await Promise.all(
          data.map(async (reflection) => {
            const [rolesData, domainsData, keyRelsData, notesData] = await Promise.all([
              fetchReflectionRoles(reflection.id),
              fetchReflectionDomains(reflection.id),
              fetchReflectionKeyRelationships(reflection.id),
              fetchReflectionNotes(reflection.id, reflection.date, user.id),
            ]);

            return {
              ...reflection,
              roles: rolesData,
              domains: domainsData,
              keyRelationships: keyRelsData,
              notes: notesData,
            };
          })
        );

        if (reset) {
          setReflections(reflectionsWithRelations);
        } else {
          setReflections((prev) => [...prev, ...reflectionsWithRelations]);
        }

        setHasMore(data.length === PAGE_SIZE);
        if (!reset) {
          setPage(currentPage + 1);
        } else {
          setPage(2);
        }
      }
    } catch (error) {
      console.error('Error fetching reflections:', error);
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

  const fetchReflectionNotes = async (
    reflectionId: string,
    reflectionDate?: string,
    userId?: string
  ): Promise<Array<{ id: string; content: string; created_at: string; parent_type?: string }>> => {
    try {
      const supabase = getSupabaseClient();

      // First, try to fetch notes directly linked to the reflection
      const { data: directNotes, error: directError } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          parent_type,
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId);

      if (directError) throw directError;

      let notes = directNotes?.map((item: any) => ({
        ...item.note,
        parent_type: item.parent_type
      })).filter((note: any) => note !== null && note.id) || [];

      // If we have a reflection date, also fetch notes from tasks/items completed on that date
      if (reflectionDate && userId) {
        const { data: dateBasedNotes, error: dateError } = await supabase.rpc(
          'get_notes_for_reflection_date',
          {
            p_user_id: userId,
            p_date: reflectionDate
          }
        );

        if (!dateError && dateBasedNotes) {
          notes = [...notes, ...dateBasedNotes];
        }
      }

      // Remove duplicates by note id
      const uniqueNotes = Array.from(
        new Map(notes.map((note: any) => [note.id, note])).values()
      );

      return uniqueNotes;
    } catch (error) {
      console.error('Error fetching reflection notes:', error);
      return [];
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchReflections(true);
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

  const renderReflection = ({ item }: { item: ReflectionWithRelations }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onReflectionPress?.(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {formatDateTime(item.date, item.created_at)}
        </Text>
        <View style={[styles.tagBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.tagBadgeText}>Reflection</Text>
        </View>
      </View>
      <Text style={[styles.contentPreview, { color: colors.textSecondary }]} numberOfLines={2}>
        {truncateContent(item.content)}
      </Text>
      {item.notes && item.notes.length > 0 && (
        <View style={styles.notesSection}>
          <Text style={[styles.notesSectionTitle, { color: colors.text }]}>
            Notes ({item.notes.length})
          </Text>
          {item.notes.slice(0, 2).map((note) => (
            <View key={note.id} style={[styles.notePreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.noteItemHeader}>
                <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {truncateContent(note.content, 60)}
                </Text>
                {note.parent_type && (
                  <View style={[
                    styles.noteTypeBadge,
                    {
                      backgroundColor:
                        note.parent_type === 'event' ? '#10b981' :
                        note.parent_type === 'task' ? '#0078d4' :
                        note.parent_type === 'depositIdea' ? '#8b5cf6' :
                        note.parent_type === 'withdrawal' ? '#f59e0b' :
                        colors.primary
                    }
                  ]}>
                    <Text style={styles.noteTypeBadgeText}>
                      {note.parent_type === 'event' ? 'Event' :
                       note.parent_type === 'task' ? 'Task' :
                       note.parent_type === 'depositIdea' ? 'Deposit Idea' :
                       note.parent_type === 'withdrawal' ? 'Withdrawal' :
                       note.parent_type}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
          {item.notes.length > 2 && (
            <Text style={[styles.moreNotesText, { color: colors.textSecondary }]}>
              +{item.notes.length - 2} more {item.notes.length - 2 === 1 ? 'note' : 'notes'}
            </Text>
          )}
        </View>
      )}
      {(item.roles && item.roles.length > 0) || (item.domains && item.domains.length > 0) ? (
        <View style={styles.tagsRow}>
          {item.roles?.slice(0, 2).map((role) => (
            <View key={`role-${role.id}`} style={[styles.tag, { backgroundColor: colors.background }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>
                {role.label}
              </Text>
            </View>
          ))}
          {item.domains?.slice(0, 2).map((domain) => (
            <View key={`domain-${domain.id}`} style={[styles.tag, { backgroundColor: colors.background }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>
                {domain.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
        data={reflections}
        renderItem={renderReflection}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        onEndReached={() => fetchReflections()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
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
});
