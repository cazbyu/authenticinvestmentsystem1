import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Flower, AlertTriangle, FileText, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';
import { ReflectFilter } from './ReflectFilterButtons';
import DailyViewModal from '@/components/reflections/DailyViewModal';
import { fetchDatesByRange, DateWithContent, ItemDetail } from '@/lib/monthlyHistoryData';
import { getWeekStart, getWeekEnd } from '@/lib/dateUtils';

interface ReflectionTableViewProps {
  filter: ReflectFilter;
  period: TimePeriod;
  userId: string;
  onReflectionPress?: (reflection: any) => void;
}

async function getDateRange(
  period: TimePeriod,
  userId: string
): Promise<{ start: Date; end: Date }> {
  const now = new Date();
  const supabase = getSupabaseClient();

  switch (period) {
    case 'today':
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return { start: todayStart, end: todayEnd };

    case 'week':
      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('week_start_day')
        .eq('id', userId)
        .single();

      const weekStartDay = (userData?.week_start_day || 'sunday') as 'sunday' | 'monday';
      const weekStart = getWeekStart(now, weekStartDay);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = getWeekEnd(now, weekStartDay);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };

    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 29);
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
  const [dates, setDates] = useState<DateWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadDateRangeData();
  }, [filter, period, userId]);

  const loadDateRangeData = async () => {
    try {
      setLoading(true);
      const { start, end } = await getDateRange(period, userId);
      const data = await fetchDatesByRange(start, end);

      const filteredData = data.map((dateItem) => {
        if (filter === 'all') {
          return dateItem;
        }

        const filteredDetails = dateItem.itemDetails.filter((item) => {
          if (filter === 'depositIdea') {
            return false;
          }
          if (filter === 'rose') {
            return item.type === 'rose';
          }
          if (filter === 'thorn') {
            return item.type === 'thorn';
          }
          if (filter === 'reflection') {
            return item.type === 'reflection';
          }
          return true;
        });

        return {
          ...dateItem,
          itemDetails: filteredDetails,
        };
      });

      setDates(filteredData);
    } catch (error) {
      console.error('Error loading date range data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getIconForItemType = (type: ItemDetail['type']) => {
    const iconProps = { size: 14 };

    switch (type) {
      case 'rose':
        return <Flower {...iconProps} color="#16a34a" />;
      case 'thorn':
        return <AlertTriangle {...iconProps} color="#f59e0b" />;
      case 'note':
        return <FileText {...iconProps} color="#0078d4" />;
      case 'reflection':
        return <BookOpen {...iconProps} color="#8b5cf6" />;
      default:
        return <FileText {...iconProps} color="#0078d4" />;
    }
  };

  const renderItemDetails = (items: ItemDetail[]) => {
    if (!items || items.length === 0) {
      return (
        <Text style={[styles.emptyDateText, { color: colors.textSecondary }]}>
          No reflections today
        </Text>
      );
    }

    return items.map((item, index) => (
      <View key={index} style={styles.itemRow}>
        <View style={styles.iconContainer}>{getIconForItemType(item.type)}</View>
        <Text style={[styles.itemText, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    ));
  };

  const handleDatePress = (dateString: string) => {
    const normalizedDate = dateString.split('T')[0];
    setSelectedDate(normalizedDate);
  };

  const handleCloseDailyView = () => {
    setSelectedDate(null);
  };

  const renderDateRow = ({ item }: { item: DateWithContent }) => {
    const hasItems = item.itemDetails && item.itemDetails.length > 0;

    return (
      <TouchableOpacity
        style={[
          styles.dateRow,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => handleDatePress(item.itemDate)}
        activeOpacity={0.7}
      >
        <View style={styles.dateColumn}>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {formatDate(item.itemDate)}
          </Text>
        </View>
        <View style={styles.contentColumn}>
          <View style={styles.itemsContainer}>{renderItemDetails(item.itemDetails)}</View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No dates in selected period
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
        data={dates}
        renderItem={renderDateRow}
        keyExtractor={(item) => item.itemDate}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={dates.length === 0 ? styles.emptyList : undefined}
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
    width: 120,
  },
  headerContent: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  dateColumn: {
    width: 120,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  itemsContainer: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 14,
    flex: 1,
  },
  emptyDateText: {
    fontSize: 14,
    fontStyle: 'italic',
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
