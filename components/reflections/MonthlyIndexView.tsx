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
import { fetchMonthlyDates, DateWithContent } from '@/lib/monthlyHistoryData';
import { ChevronLeft } from 'lucide-react-native';

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

  const renderDateRow = ({ item }: { item: DateWithContent }) => {
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
          <Text style={[styles.contentText, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.contentSummary}
          </Text>
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
