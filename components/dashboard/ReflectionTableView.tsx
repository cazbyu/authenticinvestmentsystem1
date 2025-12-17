import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Lightbulb, BookOpen, Flower2, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';
import { ReflectFilter } from './ReflectFilterButtons';
import DailyViewModal from '@/components/reflections/DailyViewModal';

interface ReflectionItem {
  id: string;
  date: string;
  title: string;
  type: 'depositIdea' | 'rose' | 'thorn' | 'reflection';
}

interface ReflectionTableViewProps {
  filter: ReflectFilter;
  period: TimePeriod;
  userId: string;
  onReflectionPress?: (reflection: any) => void;
}

function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();

  switch (period) {
    case 'today':
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return { start: todayStart, end: todayEnd };

    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };

    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 27);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: monthStart, end: monthEnd };
  }
}

export function ReflectionTableView({
  filter,
  period,
  userId,
  onReflectionPress,
}: ReflectionTableViewProps) {
  const { colors } = useTheme();
  const [items, setItems] = useState<ReflectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadReflectionItems();
  }, [filter, period, userId]);

  const loadReflectionItems = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { start, end } = getDateRange(period);
      const startStr = start.toISOString();
      const endStr = end.toISOString();
      const allItems: ReflectionItem[] = [];

      if (filter === 'all' || filter === 'depositIdea') {
        const { data: depositIdeas } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .eq('is_active', true)
          .eq('archived', false)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        if (depositIdeas) {
          allItems.push(
            ...depositIdeas.map((item) => ({
              id: item.id,
              date: item.created_at,
              title: item.title,
              type: 'depositIdea' as const,
            }))
          );
        }
      }

      if (filter === 'all' || filter === 'rose') {
        const { data: roses } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at, reflection_title')
          .eq('user_id', userId)
          .eq('daily_rose', true)
          .eq('archived', false)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        if (roses) {
          allItems.push(
            ...roses.map((item) => ({
              id: item.id,
              date: item.created_at,
              title: item.reflection_title || item.content.substring(0, 50) + '...',
              type: 'rose' as const,
            }))
          );
        }
      }

      if (filter === 'all' || filter === 'thorn') {
        const { data: thorns } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at, reflection_title')
          .eq('user_id', userId)
          .eq('daily_thorn', true)
          .eq('archived', false)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        if (thorns) {
          allItems.push(
            ...thorns.map((item) => ({
              id: item.id,
              date: item.created_at,
              title: item.reflection_title || item.content.substring(0, 50) + '...',
              type: 'thorn' as const,
            }))
          );
        }
      }

      if (filter === 'all' || filter === 'reflection') {
        const { data: reflections } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at, reflection_title')
          .eq('user_id', userId)
          .eq('daily_rose', false)
          .eq('daily_thorn', false)
          .eq('archived', false)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        if (reflections) {
          allItems.push(
            ...reflections.map((item) => ({
              id: item.id,
              date: item.created_at,
              title: item.reflection_title || item.content.substring(0, 50) + '...',
              type: 'reflection' as const,
            }))
          );
        }
      }

      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(allItems);
    } catch (error) {
      console.error('Error loading reflection items:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getIconForType = (type: ReflectionItem['type']) => {
    switch (type) {
      case 'depositIdea':
        return <Lightbulb size={18} color="#f59e0b" />;
      case 'rose':
        return <Flower2 size={18} color="#ec4899" />;
      case 'thorn':
        return <AlertTriangle size={18} color="#ef4444" />;
      case 'reflection':
        return <BookOpen size={18} color="#8b5cf6" />;
    }
  };

  const handleItemPress = (item: ReflectionItem) => {
    const itemDate = new Date(item.date);
    const dateStr = itemDate.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  };

  const handleCloseDailyView = () => {
    setSelectedDate(null);
  };

  const renderItem = ({ item }: { item: ReflectionItem }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.dateColumn}>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.contentColumn}>
        <View style={styles.itemContent}>
          {getIconForType(item.type)}
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No reflections or daily items found
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerDate, { color: colors.text }]}>Date</Text>
        <Text style={[styles.headerContent, { color: colors.text }]}>
          Reflections & Daily Items
        </Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
      />

      {selectedDate && (
        <DailyViewModal
          visible={true}
          selectedDate={selectedDate}
          onClose={handleCloseDailyView}
          onReflectionPress={onReflectionPress}
          onNotePress={() => {}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
  },
  headerDate: {
    fontSize: 14,
    fontWeight: '600',
    width: 100,
  },
  headerContent: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dateColumn: {
    justifyContent: 'center',
    width: 100,
  },
  dateText: {
    fontSize: 13,
  },
  contentColumn: {
    flex: 1,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleText: {
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
});
