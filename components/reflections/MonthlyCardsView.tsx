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
import {
  fetchMonthlyStatistics,
  MonthlyStatistics,
  getTotalItemsForMonth,
  invalidateMonthlyStatsCache,
} from '@/lib/monthlyHistoryData';
import { eventBus, EVENTS } from '@/lib/eventBus';

interface MonthlyCardsViewProps {
  onMonthPress: (year: number, month: number, monthYear: string) => void;
}

export default function MonthlyCardsView({ onMonthPress }: MonthlyCardsViewProps) {
  const { colors } = useTheme();
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  useEffect(() => {
    loadMonthlyData();

    const handleDataChange = () => {
      invalidateMonthlyStatsCache();
      loadMonthlyData(true);
    };

    eventBus.on(EVENTS.REFLECTION_CREATED, handleDataChange);
    eventBus.on(EVENTS.REFLECTION_UPDATED, handleDataChange);
    eventBus.on(EVENTS.REFLECTION_DELETED, handleDataChange);

    return () => {
      eventBus.off(EVENTS.REFLECTION_CREATED, handleDataChange);
      eventBus.off(EVENTS.REFLECTION_UPDATED, handleDataChange);
      eventBus.off(EVENTS.REFLECTION_DELETED, handleDataChange);
    };
  }, []);

  const loadMonthlyData = async (forceRefresh: boolean = false) => {
    try {
      setLoading(!forceRefresh);
      const data = await fetchMonthlyStatistics(forceRefresh);
      setMonthlyStats(data);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMonthlyData(true);
  };

  const renderMonthCard = ({ item }: { item: MonthlyStatistics }) => {
    const cardId = `${item.year}-${item.month}`;
    const isHovered = hoveredCardId === cardId;
    const totalItems = getTotalItemsForMonth(item);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        onPress={() => onMonthPress(item.year, item.month, item.monthYear)}
        onMouseEnter={() => setHoveredCardId(cardId)}
        onMouseLeave={() => setHoveredCardId(null)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={[styles.monthText, { color: colors.text }]}>
            {item.monthYear.trim()}
          </Text>
          <View style={styles.totalBadge}>
            <Text style={[styles.totalText, { color: colors.textSecondary }]}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>

        {isHovered && (
          <View
            style={[
              styles.tooltip,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.tooltipArrow} />
            <View style={styles.tooltipContent}>
              <Text style={[styles.tooltipTitle, { color: colors.text }]}>Monthly Summary</Text>
              <View style={styles.tooltipStats}>
                <TooltipRow label="Reflections" count={item.reflectionsCount} colors={colors} />
                <TooltipRow label="Tasks" count={item.tasksCount} colors={colors} />
                <TooltipRow label="Events" count={item.eventsCount} colors={colors} />
                <TooltipRow label="Deposit Ideas" count={item.depositIdeasCount} colors={colors} />
                <TooltipRow label="Withdrawals" count={item.withdrawalsCount} colors={colors} />
                {item.followUpItemsCount > 0 && (
                  <TooltipRow label="Follow Up Items" count={item.followUpItemsCount} colors={colors} />
                )}
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No history yet. Start creating reflections, tasks, and other items to build your history.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your history...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={monthlyStats}
        renderItem={renderMonthCard}
        keyExtractor={(item) => `${item.year}-${item.month}`}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
      />
    </View>
  );
}

interface TooltipRowProps {
  label: string;
  count: number;
  colors: any;
}

function TooltipRow({ label, count, colors }: TooltipRowProps) {
  return (
    <View style={styles.tooltipRow}>
      <Text style={[styles.tooltipLabel, { color: colors.textSecondary }]}>{label}:</Text>
      <Text style={[styles.tooltipValue, { color: colors.text }]}>{count}</Text>
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
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    flex: 1,
    maxWidth: '48%',
    minHeight: 120,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 24,
  },
  totalBadge: {
    alignSelf: 'flex-start',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tooltip: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: [{ translateX: -120 }, { translateY: -100 }],
    width: 240,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
  },
  tooltipContent: {
    padding: 16,
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  tooltipStats: {
    gap: 8,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '600',
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
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
