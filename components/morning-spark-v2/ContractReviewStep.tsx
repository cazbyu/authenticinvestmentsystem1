import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  GroupedContractItems,
  WeeklyContractItem,
} from '@/lib/morningSparkV2Service';

interface ContractReviewStepProps {
  grouped: GroupedContractItems;
  loading: boolean;
  onAdjust: (taskId: string, action: 'delay' | 'delete', newDate?: string) => void;
  onAddNew: () => void;
  targetScore: number;
}

interface SectionConfig {
  key: keyof GroupedContractItems;
  label: string;
  icon: string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'roles', label: 'Roles', icon: '\u{1F465}' },
  { key: 'wellness', label: 'Wellness', icon: '\u{1F9D8}' },
  { key: 'goals', label: 'Goals', icon: '\u{1F3AF}' },
  { key: 'other', label: 'Other', icon: '\u{1F4CB}' },
];

function TagPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tagPill, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.tagPillText, { color }]}>{label}</Text>
    </View>
  );
}

function TaskCard({
  item,
  colors,
  isDarkMode,
  onAdjust,
}: {
  item: WeeklyContractItem;
  colors: ReturnType<typeof useTheme>['colors'];
  isDarkMode: boolean;
  onAdjust: ContractReviewStepProps['onAdjust'];
}) {
  const isCompleted = !!item.completed_at;

  const handleDelay = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdjust(item.id, 'delay');
  };

  const handleRemove = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onAdjust(item.id, 'delete');
  };

  const timeDisplay =
    item.start_time && item.end_time
      ? `${item.start_time} - ${item.end_time}`
      : item.start_time
        ? item.start_time
        : null;

  return (
    <View
      style={[
        styles.taskCard,
        {
          backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
          borderColor: isCompleted ? colors.success + '40' : colors.border,
          opacity: isCompleted ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          {item.one_thing && <Text style={styles.starIcon}>{'\u2B50'}</Text>}
          <Text
            style={[
              styles.taskTitle,
              { color: colors.text },
              isCompleted && styles.strikethrough,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>
        <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.pointsText, { color: colors.primary }]}>
            +{item.points}
          </Text>
        </View>
      </View>

      {timeDisplay && (
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {'\u{1F552}'} {timeDisplay}
        </Text>
      )}

      {(item.roles.length > 0 || item.domains.length > 0 || item.goals.length > 0) && (
        <View style={styles.tagsRow}>
          {item.roles.map((r) => (
            <TagPill key={`role-${r.id}`} label={r.label} color="#3B82F6" />
          ))}
          {item.domains.map((d) => (
            <TagPill key={`domain-${d.id}`} label={d.name} color="#16A34A" />
          ))}
          {item.goals.map((g) => (
            <TagPill key={`goal-${g.id}`} label={g.title} color="#D97706" />
          ))}
        </View>
      )}

      {!isCompleted && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={handleDelay}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>{'\u{1F4C5}'}</Text>
            <Text style={[styles.actionBtnLabel, { color: colors.textSecondary }]}>
              Delay
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.error + '40' }]}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>{'\u{1F5D1}'}</Text>
            <Text style={[styles.actionBtnLabel, { color: colors.error }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ContractReviewStep({
  grouped,
  loading,
  onAdjust,
  onAddNew,
  targetScore,
}: ContractReviewStepProps) {
  const { colors, isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    roles: true,
    wellness: true,
    goals: true,
    other: true,
  });

  const toggleSection = useCallback((key: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your contract...
        </Text>
      </View>
    );
  }

  const visibleSections = SECTIONS.filter((s) => grouped[s.key].length > 0);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        Here's what you said you wanted to accomplish today
      </Text>

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleSections.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? colors.surface : '#FFF' }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks scheduled for today. Tap "Add New" to get started.
            </Text>
          </View>
        )}

        {visibleSections.map((section) => {
          const items = grouped[section.key];
          const isExpanded = expanded[section.key];

          return (
            <View key={section.key} style={styles.sectionContainer}>
              <TouchableOpacity
                style={[
                  styles.sectionHeader,
                  {
                    backgroundColor: isDarkMode ? colors.surface : '#F9FAFB',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => toggleSection(section.key)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionIcon}>{section.icon}</Text>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    {section.label}
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.countBadgeText}>{items.length}</Text>
                  </View>
                </View>
                <Text style={[styles.chevron, { color: colors.textSecondary }]}>
                  {isExpanded ? '\u25B2' : '\u25BC'}
                </Text>
              </TouchableOpacity>

              {isExpanded &&
                items.map((item) => (
                  <TaskCard
                    key={item.id}
                    item={item}
                    colors={colors}
                    isDarkMode={isDarkMode}
                    onAdjust={onAdjust}
                  />
                ))}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.addNewBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onAddNew();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.addNewIcon}>+</Text>
          <Text style={styles.addNewLabel}>Add New</Text>
        </TouchableOpacity>

        <View style={[styles.targetBadge, { backgroundColor: isDarkMode ? colors.surface : '#FFF5E1' }]}>
          <Text style={[styles.targetText, { color: '#D97706' }]}>
            Target: {targetScore} pts
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 12,
  },
  taskCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 6,
    marginLeft: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  starIcon: {
    fontSize: 16,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  pointsBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagPill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  actionBtnIcon: {
    fontSize: 14,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  addNewIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  addNewLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  targetBadge: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  targetText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
