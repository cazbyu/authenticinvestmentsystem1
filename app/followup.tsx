import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchReflectionById, ReflectionWithRelations } from '@/lib/reflectionUtils';
import { fetchPendingReflectionFollowUps, FollowUpItem, markFollowUpDone } from '@/lib/followUpUtils'; // whatever file name you used
import { eventBus, EVENTS } from '@/lib/eventBus';
import { useRouter } from 'expo-router';
import { Calendar, Check } from 'lucide-react-native';

type FollowUpWithReflection = {
  followUp: FollowUpItem;
  reflection: ReflectionWithRelations;
};

export default function FollowUpScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [followUps, setFollowUps] = useState<Array<{ followUp: FollowUpItem; reflection: ReflectionWithRelations | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchReflections();

    const handleReflectionChange = () => {
      fetchReflections();
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

  const fetchReflections = async () => {
  setLoading(true);
  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1) Get pending follow-ups for reflections from the universal table
    const followUps = await fetchPendingReflectionFollowUps(user.id);

    // 2) For each follow-up row, fetch the associated reflection with relations
    const itemsWithReflections: FollowUpWithReflection[] = [];

    for (const fu of followUps) {
      const reflection = await fetchReflectionById(fu.parent_id);
      if (reflection) {
        itemsWithReflections.push({ followUp: fu, reflection });
      }
    }

    setItems(itemsWithReflections);
  } catch (error) {
    console.error('Error fetching follow-up reflections:', error);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const onRefresh = () => {
    setRefreshing(true);
    fetchReflections();
  };

  const formatFollowUpDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatOriginalDate = (dateString: string, createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleReflectionPress = (reflection: ReflectionWithRelations) => {
    router.push('/reflections' as any);
  };

  const handleMarkComplete = (followUpId: string) => {
  Alert.alert(
    'Mark as Complete',
    'Do you want to clear the follow-up for this item?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const success = await markFollowUpDone(followUpId, user.id);
            if (!success) throw new Error('Failed to update follow-up');

            await fetchReflections();
            eventBus.emit(EVENTS.REFLECTION_UPDATED);
            Alert.alert('Success', 'Follow-up marked as complete');
          } catch (error) {
            console.error('Error marking follow-up complete:', error);
            Alert.alert('Error', 'Failed to update follow-up');
          }
        },
      },
    ]
  );
};

  const renderFollowUp = ({
  item,
}: {
  item: FollowUpWithReflection;
}) => {
  const { followUp, reflection } = item;
  const isOverdue = followUp.follow_up_date
    ? new Date(followUp.follow_up_date) < new Date()
    : false;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isOverdue && { borderLeftColor: colors.warning, borderLeftWidth: 4 },
      ]}
      onPress={() => handleReflectionPress(reflection)}
    >
      <View className={styles.cardHeader}>
        <View style={styles.dateContainer}>
          <Calendar size={16} color={colors.primary} />
          <Text
            style={[
              styles.followUpDate,
              { color: isOverdue ? colors.warning : colors.primary },
            ]}
          >
            {followUp.follow_up_date
              ? formatFollowUpDate(followUp.follow_up_date)
              : 'No date'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.completeButton, { backgroundColor: colors.success }]}
          onPress={() => handleMarkComplete(followUp.id)}
        >
          <Check size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <Text
        style={[styles.contentPreview, { color: colors.text }]}
        numberOfLines={3}
      >
        {truncateContent(reflection.content)}
      </Text>

      <View style={styles.metaRow}>
        <Text style={[styles.originalDate, { color: colors.textSecondary }]}>
          Created: {formatOriginalDate(reflection.date, reflection.created_at)}
        </Text>
        {isOverdue && (
          <View
            style={[styles.overdueTag, { backgroundColor: colors.warning }]}
          >
            <Text style={styles.overdueText}>Overdue</Text>
          </View>
        )}
      </View>

      {(reflection.roles && reflection.roles.length > 0) ||
      (reflection.domains && reflection.domains.length > 0) ? (
        <View style={styles.tagsRow}>
          {reflection.roles?.slice(0, 2).map((role) => (
            <View
              key={role.id}
              style={[styles.tag, { backgroundColor: colors.background }]}
            >
              <Text
                style={[styles.tagText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {role.label}
              </Text>
            </View>
          ))}
          {reflection.domains?.slice(0, 2).map((domain) => (
            <View
              key={domain.id}
              style={[styles.tag, { backgroundColor: colors.background }]}
            >
              <Text
                style={[styles.tagText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {domain.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No follow-up reflections scheduled.
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
        Create a reflection with a follow-up date from the Reflections tab.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Follow Up" />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reflections}
          renderItem={renderReflection}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followUpDate: {
    fontSize: 15,
    fontWeight: '700',
  },
  completeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentPreview: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalDate: {
    fontSize: 13,
  },
  overdueTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overdueText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
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
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
