import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchMonthlyDates, DateWithContent, ItemDetail } from '@/lib/monthlyHistoryData';
import { ChevronLeft, Flower, XOctagon, FileText, BookOpen } from 'lucide-react-native';

interface MonthlyIndexViewProps {
  year: number;
  month: number;
  monthYear: string;
  onBackPress: () => void;
  onDatePress: (date: string) => void;
}

export default function MonthlyIndexView({
  year,
  month,
  monthYear,
  onBackPress,
  onDatePress,
}: MonthlyIndexViewProps) {
  const { colors } = useTheme();
  const [dates, setDates] = useState<DateWithContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyDates();
  }, [year, month]);

  const loadMonthlyDates = async () => {
    try {
      setLoading(true);
      // Daily history rows come straight from get_month_dates_with_items so
      // they share filtering with the monthly summaries.
      const data = await fetchMonthlyDates(year, month);
      setDates(data);
    } catch (error) {
      console.error('Error loading monthly dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Parse YYYY-MM-DD format without timezone shifts
    // When you do `new Date("2025-11-01")`, it creates a Date at midnight UTC
    // which can shift to the previous day in western timezones.
    // Instead, parse the components and create a Date in local time.
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
        return <XOctagon {...iconProps} color="#f59e0b" />;
      case 'task':
        return <FileText {...iconProps} color="#0078d4" />;
      case 'event':
        return <FileText {...iconProps} color="#10b981" />;
      case 'depositIdea':
        return <FileText {...iconProps} color="#8b5cf6" />;
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
      return null;
    }

    return items.map((item, index) => (
      <View key={index} style={styles.itemRow}>
        <View style={styles.iconContainer}>
          {getIconForItemType(item.type)}
        </View>
        <Text style={[styles.itemText, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    ));
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
        onPress={() => onDatePress(item.itemDate)}
        activeOpacity={0.7}
      >
        <View style={styles.dateColumn}>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {formatDate(item.itemDate)}
          </Text>
        </View>
        <View style={styles.contentColumn}>
          {hasItems ? (
            <View style={styles.itemsContainer}>
              {renderItemDetails(item.itemDetails)}
            </View>
          ) : (
            <Text style={[styles.contentText, { color: colors.textSecondary }]}>
              No reflections or daily items with notes
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No items recorded for {monthYear}.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {monthYear}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Click a date to view details
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.tableContainer}>
          <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.dateColumn}>
              <Text style={[styles.tableHeaderText, { color: colors.text }]}>Date</Text>
            </View>
            <View style={styles.contentColumn}>
              <Text style={[styles.tableHeaderText, { color: colors.text }]}>
                Reflections & Daily Items
              </Text>
            </View>
          </View>

          <FlatList
            data={dates}
            renderItem={renderDateRow}
            keyExtractor={(item) => item.itemDate}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
          />
        </View>
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
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateColumn: {
    width: 120,
    justifyContent: 'center',
  },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  dateRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
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
  listContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
