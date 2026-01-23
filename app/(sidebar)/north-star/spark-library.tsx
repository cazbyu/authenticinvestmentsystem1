import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ChevronDown, ChevronRight, MessageSquare, HelpCircle, Trash2 } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface SparkItem {
  id: string;
  content_type: 'quote' | 'question';
  content_text: string;
  attribution?: string;
  source_type: 'self' | 'coach' | 'system';
  coach_id?: string;
  domain?: string;
  created_at: string;
  last_shown_at?: string;
  times_shown: number;
  is_pinned: boolean;
}

interface MonthGroup {
  month: string;
  displayMonth: string;
  items: SparkItem[];
  expanded: boolean;
}

export default function SparkLibrary() {
  const [loading, setLoading] = useState(true);
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);

  useEffect(() => {
    loadSparkLibrary();
  }, []);

  const loadSparkLibrary = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('v_spark_library_by_month')
        .select('*')
        .eq('user_id', user.id)
        .order('archived_month', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading spark library:', error);
        return;
      }

      const grouped = groupByMonth(data || []);
      setMonthGroups(grouped);
    } catch (error) {
      console.error('Error in loadSparkLibrary:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByMonth = (items: any[]): MonthGroup[] => {
    const groups: { [key: string]: SparkItem[] } = {};

    items.forEach((item) => {
      const month = item.archived_month;
      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(item);
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((month) => ({
        month,
        displayMonth: formatMonthDisplay(month),
        items: groups[month],
        expanded: false,
      }));
  };

  const formatMonthDisplay = (month: string): string => {
    const year = month.substring(0, 4);
    const monthNum = parseInt(month.substring(4, 6), 10);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[monthNum - 1]} ${year}`;
  };

  const toggleMonth = (month: string) => {
    setMonthGroups((prev) =>
      prev.map((group) =>
        group.month === month
          ? { ...group, expanded: !group.expanded }
          : group
      )
    );
  };

  const handleDeleteItem = async (item: SparkItem) => {
    Alert.alert(
      'Delete Spark Item',
      `Are you sure you want to delete this ${item.content_type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const tableName = item.content_type === 'quote'
                ? '0008-ap-user-power-quotes'
                : '0008-ap-user-power-questions';

              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', item.id);

              if (error) throw error;

              await loadSparkLibrary();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleTogglePin = async (item: SparkItem) => {
    try {
      const supabase = getSupabaseClient();
      const tableName = item.content_type === 'quote'
        ? '0008-ap-user-power-quotes'
        : '0008-ap-user-power-questions';

      const { error } = await supabase
        .from(tableName)
        .update({ is_pinned: !item.is_pinned })
        .eq('id', item.id);

      if (error) throw error;

      await loadSparkLibrary();
    } catch (error) {
      console.error('Error toggling pin:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const renderMonthHeader = (group: MonthGroup) => (
    <TouchableOpacity
      style={styles.monthHeader}
      onPress={() => toggleMonth(group.month)}
    >
      <View style={styles.monthHeaderLeft}>
        {group.expanded ? (
          <ChevronDown size={20} color="#6b7280" />
        ) : (
          <ChevronRight size={20} color="#6b7280" />
        )}
        <Text style={styles.monthTitle}>{group.displayMonth}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{group.items.length}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSparkItem = (item: SparkItem) => (
    <View style={styles.sparkItem}>
      <View style={styles.sparkItemHeader}>
        <View style={styles.sparkItemType}>
          {item.content_type === 'quote' ? (
            <MessageSquare size={16} color="#0078d4" />
          ) : (
            <HelpCircle size={16} color="#16a34a" />
          )}
          <Text style={styles.sparkItemTypeText}>
            {item.content_type === 'quote' ? 'Quote' : 'Question'}
          </Text>
        </View>

        <View style={styles.sparkItemActions}>
          <TouchableOpacity
            onPress={() => handleTogglePin(item)}
            style={styles.iconButton}
          >
            <Text style={styles.pinIcon}>{item.is_pinned ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteItem(item)}
            style={styles.iconButton}
          >
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sparkItemText}>{item.content_text}</Text>

      {item.attribution && (
        <Text style={styles.sparkItemAttribution}>— {item.attribution}</Text>
      )}

      <View style={styles.sparkItemMeta}>
        {item.source_type === 'coach' && (
          <View style={styles.coachTag}>
            <Text style={styles.coachTagText}>From Coach</Text>
          </View>
        )}
        {item.domain && (
          <View style={styles.domainTag}>
            <Text style={styles.domainTagText}>{item.domain}</Text>
          </View>
        )}
        <Text style={styles.metaText}>
          Shown {item.times_shown} {item.times_shown === 1 ? 'time' : 'times'}
        </Text>
      </View>

      {item.last_shown_at && (
        <Text style={styles.lastShownText}>
          Last shown: {new Date(item.last_shown_at).toLocaleDateString()}
        </Text>
      )}
    </View>
  );

  const renderMonth = ({ item: group }: { item: MonthGroup }) => (
    <View style={styles.monthContainer}>
      {renderMonthHeader(group)}
      {group.expanded && (
        <View style={styles.monthContent}>
          {group.items.map((item) => (
            <View key={item.id}>{renderSparkItem(item)}</View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ed1c24" />
        <Text style={styles.loadingText}>Loading Spark Library...</Text>
      </View>
    );
  }

  if (monthGroups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MessageSquare size={64} color="#d1d5db" />
        <Text style={styles.emptyTitle}>No Archived Sparks Yet</Text>
        <Text style={styles.emptyText}>
          Quotes and questions you view will be automatically archived here by month.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={monthGroups}
        renderItem={renderMonth}
        keyExtractor={(item) => item.month}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  monthContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthHeader: {
    padding: 16,
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  monthContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sparkItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sparkItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sparkItemType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkItemTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  sparkItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  pinIcon: {
    fontSize: 16,
  },
  sparkItemText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
    marginBottom: 8,
  },
  sparkItemAttribution: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
    marginBottom: 12,
  },
  sparkItemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  coachTag: {
    backgroundColor: '#fef2f2',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coachTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  domainTag: {
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  domainTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    textTransform: 'capitalize',
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  lastShownText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
});
