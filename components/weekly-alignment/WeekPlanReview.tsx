import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Lightbulb,
  ListTodo,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
} from 'lucide-react-native';
import { WeekPlanItem } from '@/hooks/useWeekPlan';

interface WeekPlanReviewProps {
  items: WeekPlanItem[];
  colors: any;
  onToggleCommit: (itemId: string) => void;
  onEditItem?: (item: WeekPlanItem) => void;
  onRemoveItem?: (itemId: string) => void;
}

export function WeekPlanReview({
  items,
  colors,
  onToggleCommit,
  onEditItem,
  onRemoveItem,
}: WeekPlanReviewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    roles: true,
    wellness: true,
    goals: true,
    ideas: true,
  });

  const itemsBySource = {
    roles: items.filter((item) =>
      item.source_context.toLowerCase().includes('role')
    ),
    wellness: items.filter((item) =>
      item.source_context.toLowerCase().includes('wellness')
    ),
    goals: items.filter((item) =>
      item.source_context.toLowerCase().includes('goal')
    ),
    ideas: items.filter((item) => item.type === 'idea'),
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderItem = (item: WeekPlanItem) => {
    const isCommitted = item.is_committed;
    const iconColor = isCommitted ? '#10b981' : colors.textSecondary;

    return (
      <View key={item.id} style={[styles.itemCard, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.itemCheckbox}
          onPress={() => onToggleCommit(item.id)}
        >
          {isCommitted ? (
            <CheckCircle2 size={20} color={iconColor} />
          ) : (
            <Circle size={20} color={iconColor} />
          )}
        </TouchableOpacity>

        <View style={styles.itemContent}>
          <Text
            style={[
              styles.itemTitle,
              { color: colors.text },
              isCommitted && styles.itemTitleCommitted,
            ]}
          >
            {item.title}
          </Text>
          <View style={styles.itemMeta}>
            <View style={[styles.itemTypeTag, { backgroundColor: getTypeColor(item.type) }]}>
              {item.type === 'task' && <ListTodo size={12} color="#ffffff" />}
              {item.type === 'event' && <Calendar size={12} color="#ffffff" />}
              {item.type === 'idea' && <Lightbulb size={12} color="#ffffff" />}
              <Text style={styles.itemTypeText}>{item.type}</Text>
            </View>
            <Text style={[styles.itemContext, { color: colors.textSecondary }]}>
              {item.source_context}
            </Text>
          </View>
          {item.aligned_to && (
            <Text style={[styles.itemAlignedTo, { color: '#ed1c24' }]}>
              ⭐ {item.aligned_to}
            </Text>
          )}
        </View>

        <View style={styles.itemActions}>
          {onEditItem && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEditItem(item)}
            >
              <Edit3 size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onRemoveItem && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onRemoveItem(item.id)}
            >
              <Trash2 size={16} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderSection = (
    key: string,
    title: string,
    items: WeekPlanItem[],
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null;

    const isExpanded = expandedSections[key];
    const committedCount = items.filter((item) => item.is_committed).length;

    return (
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(key)}
        >
          {icon}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {title} ({items.length})
          </Text>
          <View style={[styles.committedBadge, { backgroundColor: '#10b981' }]}>
            <Text style={styles.committedBadgeText}>{committedCount} committed</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {items.map((item) => renderItem(item))}
          </View>
        )}
      </View>
    );
  };

  const totalCommitted = items.filter((item) => item.is_committed).length;

  return (
    <ScrollView style={styles.container}>
      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: '#fef3f2', borderColor: '#fed7d7' }]}>
        <Text style={[styles.summaryTitle, { color: '#1f2937' }]}>
          Your Week Plan
        </Text>
        <Text style={[styles.summaryText, { color: '#374151' }]}>
          You've captured {items.length} aligned action{items.length !== 1 ? 's' : ''} across your
          roles, wellness, and goals. Review and commit to the ones that matter most this week.
        </Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#ed1c24' }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Items
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#10b981' }]}>{totalCommitted}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Committed
            </Text>
          </View>
        </View>
      </View>

      {/* Items by Source */}
      {renderSection(
        'roles',
        'From Roles',
        itemsBySource.roles,
        <View style={[styles.sectionIcon, { backgroundColor: '#9370DB' }]}>
          <Text style={styles.sectionIconText}>👥</Text>
        </View>
      )}

      {renderSection(
        'wellness',
        'From Wellness',
        itemsBySource.wellness,
        <View style={[styles.sectionIcon, { backgroundColor: '#39b54a' }]}>
          <Text style={styles.sectionIconText}>🌿</Text>
        </View>
      )}

      {renderSection(
        'goals',
        'From Goals',
        itemsBySource.goals,
        <View style={[styles.sectionIcon, { backgroundColor: '#4169E1' }]}>
          <Text style={styles.sectionIconText}>🎯</Text>
        </View>
      )}

      {renderSection(
        'ideas',
        'Ideas to Deposit',
        itemsBySource.ideas,
        <View style={[styles.sectionIcon, { backgroundColor: '#FFD700' }]}>
          <Text style={styles.sectionIconText}>💡</Text>
        </View>
      )}

      {items.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No items captured yet. Go back through the steps and add tasks, events, or ideas as
            you reflect on your roles, wellness, and goals.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function getTypeColor(type: 'task' | 'event' | 'idea'): string {
  switch (type) {
    case 'task':
      return '#3b82f6';
    case 'event':
      return '#8b5cf6';
    case 'idea':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconText: {
    fontSize: 14,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  committedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  committedBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  itemCheckbox: {
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  itemTitleCommitted: {
    opacity: 0.7,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemTypeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemContext: {
    fontSize: 12,
  },
  itemAlignedTo: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
