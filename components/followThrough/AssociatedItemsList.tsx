import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { FileText, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate } from '@/lib/dateUtils';

export type SortOption = 'creation' | 'dueDate' | 'type';

export interface AssociatedItem {
  id: string;
  title: string;
  type: 'task' | 'event' | 'rose' | 'thorn' | 'reflection' | 'depositIdea';
  created_at: string;
  due_date?: string;
  start_date?: string;
  has_notes: boolean;
  status?: string;
  completed_at?: string;
}

interface AssociatedItemsListProps {
  items: AssociatedItem[];
  loading: boolean;
  onItemPress: (item: AssociatedItem) => void;
  emptyMessage?: string;
}

const TYPE_LABELS = {
  task: 'Task',
  event: 'Event',
  rose: 'Rose',
  thorn: 'Thorn',
  reflection: 'Reflection',
  depositIdea: 'Idea',
};

const TYPE_COLORS = {
  task: '#3b82f6',
  event: '#8b5cf6',
  rose: '#10b981',
  thorn: '#ef4444',
  reflection: '#6366f1',
  depositIdea: '#f59e0b',
};

const TYPE_ORDER = ['task', 'event', 'rose', 'thorn', 'reflection', 'depositIdea'];

export default function AssociatedItemsList({
  items,
  loading,
  onItemPress,
  emptyMessage = 'No associated items yet',
}: AssociatedItemsListProps) {
  const { colors, isDarkMode } = useTheme();
  const [sortBy, setSortBy] = useState<SortOption>('creation');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const getSortedItems = () => {
    const sorted = [...items];

    switch (sortBy) {
      case 'creation':
        return sorted.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      case 'dueDate':
        return sorted.sort((a, b) => {
          const dateA = a.due_date || a.start_date || a.created_at;
          const dateB = b.due_date || b.start_date || b.created_at;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

      case 'type':
        return sorted.sort((a, b) => {
          const typeIndexA = TYPE_ORDER.indexOf(a.type);
          const typeIndexB = TYPE_ORDER.indexOf(b.type);
          if (typeIndexA !== typeIndexB) {
            return typeIndexA - typeIndexB;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      default:
        return sorted;
    }
  };

  const getItemDate = (item: AssociatedItem) => {
    const date = item.due_date || item.start_date || item.created_at;
    return formatLocalDate(new Date(date));
  };

  const formatItemTitle = (item: AssociatedItem) => {
    const isTaskOrEvent = item.type === 'task' || item.type === 'event';
    const isActive = isTaskOrEvent && item.status !== 'completed' && !item.completed_at;

    if (isActive) {
      return `${item.title} (active)`;
    }
    return item.title;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const sortedItems = getSortedItems();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Associated Actions, Reflections & Ideas
        </Text>
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: colors.card }]}
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <Text style={[styles.sortButtonText, { color: colors.text }]}>
            Sort: {sortBy === 'creation' ? 'Creation Date' : sortBy === 'dueDate' ? 'Due Date' : 'Type'}
          </Text>
          <ChevronDown size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      {showSortMenu && (
        <View style={[styles.sortMenu, { backgroundColor: colors.card }]}>
          {[
            { value: 'creation' as SortOption, label: 'Creation Date' },
            { value: 'dueDate' as SortOption, label: 'Due Date' },
            { value: 'type' as SortOption, label: 'Type' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.sortMenuItem}
              onPress={() => {
                setSortBy(option.value);
                setShowSortMenu(false);
              }}
            >
              <Text
                style={[
                  styles.sortMenuText,
                  { color: sortBy === option.value ? colors.primary : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.tableHeader, { backgroundColor: colors.card }]}>
        <Text style={[styles.columnHeader, styles.dateColumn, { color: colors.textSecondary }]}>
          Date
        </Text>
        <Text style={[styles.columnHeader, styles.titleColumn, { color: colors.textSecondary }]}>
          Title
        </Text>
        <Text style={[styles.columnHeader, styles.notesColumn, { color: colors.textSecondary }]}>
          Notes
        </Text>
      </View>

      <ScrollView style={styles.tableBody}>
        {sortedItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.row,
              {
                backgroundColor: index % 2 === 0
                  ? (isDarkMode ? '#1f2937' : '#ffffff')
                  : (isDarkMode ? '#374151' : '#f9fafb'),
              },
            ]}
            onPress={() => onItemPress(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cellText, styles.dateColumn, { color: colors.text }]}>
              {getItemDate(item)}
            </Text>
            <View style={[styles.titleCell, styles.titleColumn]}>
              <Text style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                {formatItemTitle(item)}
              </Text>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: `${TYPE_COLORS[item.type]}20` },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    { color: TYPE_COLORS[item.type] },
                  ]}
                >
                  {TYPE_LABELS[item.type]}
                </Text>
              </View>
            </View>
            <View style={[styles.notesCell, styles.notesColumn]}>
              {item.has_notes && <FileText size={18} color={colors.textSecondary} />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 14,
  },
  sortMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minWidth: 150,
  },
  sortMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sortMenuText: {
    fontSize: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateColumn: {
    width: '25%',
  },
  titleColumn: {
    flex: 1,
  },
  notesColumn: {
    width: 60,
    textAlign: 'center',
  },
  tableBody: {
    maxHeight: 400,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cellText: {
    fontSize: 14,
  },
  titleCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
