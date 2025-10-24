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
            const [rolesData, domainsData, keyRelsData] = await Promise.all([
              fetchReflectionRoles(reflection.id),
              fetchReflectionDomains(reflection.id),
              fetchReflectionKeyRelationships(reflection.id),
            ]);

            return {
              ...reflection,
              roles: rolesData,
              domains: domainsData,
              keyRelationships: keyRelsData,
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
