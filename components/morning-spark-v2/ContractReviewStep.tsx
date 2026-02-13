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
import {
  CheckSquare,
  CalendarDays,
  Clock,
  Users,
  CalendarClock,
  Trash2,
  Star,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  GroupedContractItems,
  WeeklyContractItem,
} from '@/lib/morningSparkV2Service';

// ── Eisenhower-based color palette ──────────────────────────────────
// Q1 = Urgent + Important → Red (Do First)
// Q2 = Not Urgent + Important → Emerald Green (Schedule)
// Q3 = Urgent + Not Important → Amber (Delegate)
// Q4 = Not Urgent + Not Important → Light Gray (Eliminate/Low Priority)

const QUADRANT = {
  Q1: { // Urgent + Important — DO
    border: '#DC4545',
    bg: '#DC454510',
    label: 'Do First',
    labelColor: '#DC4545',
  },
  Q2: { // Not Urgent + Important — SCHEDULE
    border: '#3DA87A',
    bg: '#3DA87A10',
    label: 'Schedule',
    labelColor: '#3DA87A',
  },
  Q3: { // Urgent + Not Important — DELEGATE
    border: '#D4924A',
    bg: '#D4924A10',
    label: 'Delegate',
    labelColor: '#D4924A',
  },
  Q4: { // Not Urgent + Not Important — ELIMINATE
    border: '#A0AEC0',
    bg: '#A0AEC010',
    label: 'Low Priority',
    labelColor: '#A0AEC0',
  },
} as const;

function getQuadrant(item: WeeklyContractItem) {
  if (item.is_urgent && item.is_important) return QUADRANT.Q1;
  if (!item.is_urgent && item.is_important) return QUADRANT.Q2;
  if (item.is_urgent && !item.is_important) return QUADRANT.Q3;
  return QUADRANT.Q4;
}

/** True for items that are good delegate candidates (Q3 or Q4) */
function isDelegateCandidate(item: WeeklyContractItem) {
  return (item.is_urgent && !item.is_important) || (!item.is_urgent && !item.is_important);
}

// ── Props ───────────────────────────────────────────────────────────

interface ContractReviewStepProps {
  grouped: GroupedContractItems;
  loading: boolean;
  onAdjust: (taskId: string, action: 'delay' | 'delete' | 'delegate', newDate?: string) => void;
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

// ── Tag Pill ────────────────────────────────────────────────────────

function TagPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tagPill, { backgroundColor: color + '18', borderColor: color + '50' }]}>
      <Text style={[styles.tagPillText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Task Card ───────────────────────────────────────────────────────

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
  const quadrant = getQuadrant(item);
  const showDelegateNudge = isDelegateCandidate(item);

  const handleDelay = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdjust(item.id, 'delay');
  };

  const handleDelegate = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdjust(item.id, 'delegate');
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

  const isEvent = item.type === 'event';
  const TypeIcon = isEvent ? CalendarDays : CheckSquare;

  return (
    <View
      style={[
        styles.taskCard,
        {
          backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
          borderColor: isCompleted ? colors.success + '40' : (isDarkMode ? colors.border : '#EDF2F7'),
          borderLeftColor: quadrant.border,
          borderLeftWidth: 4,
          opacity: isCompleted ? 0.6 : 1,
        },
      ]}
    >
      {/* Row 1: Icon + Title + Points */}
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          {item.one_thing ? (
            <Star size={16} color="#D4A843" fill="#D4A843" />
          ) : (
            <TypeIcon size={15} color={quadrant.border} />
          )}
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
        <View style={[styles.pointsBadge, { backgroundColor: quadrant.border + '18' }]}>
          <Text style={[styles.pointsText, { color: quadrant.border }]}>
            +{item.points}
          </Text>
        </View>
      </View>

      {/* Row 2: Time + Quadrant badge */}
      <View style={styles.metaRow}>
        {timeDisplay && (
          <View style={styles.timeContainer}>
            <Clock size={12} color={colors.textSecondary} />
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {timeDisplay}
            </Text>
          </View>
        )}
        <View style={[styles.quadrantBadge, { backgroundColor: quadrant.border + '15' }]}>
          <Text style={[styles.quadrantBadgeText, { color: quadrant.labelColor }]}>
            {quadrant.label}
          </Text>
        </View>
      </View>

      {/* Row 3: Tags */}
      {(item.roles.length > 0 || item.domains.length > 0 || item.goals.length > 0) && (
        <View style={styles.tagsRow}>
          {item.roles.map((r) => (
            <TagPill key={`role-${r.id}`} label={r.label} color="#5B9BD5" />
          ))}
          {item.domains.map((d) => (
            <TagPill key={`domain-${d.id}`} label={d.name} color="#3DA87A" />
          ))}
          {item.goals.map((g) => (
            <TagPill key={`goal-${g.id}`} label={g.title} color="#D4924A" />
          ))}
        </View>
      )}

      {/* Row 4: Action buttons */}
      {!isCompleted && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={handleDelay}
            activeOpacity={0.7}
          >
            <CalendarClock size={14} color={colors.textSecondary} />
            <Text style={[styles.actionBtnLabel, { color: colors.textSecondary }]}>
              Delay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              showDelegateNudge
                ? {
                    borderColor: quadrant.border,
                    backgroundColor: quadrant.border + '12',
                    borderWidth: 1.5,
                  }
                : { borderColor: colors.border },
            ]}
            onPress={handleDelegate}
            activeOpacity={0.7}
          >
            <Users size={14} color={showDelegateNudge ? quadrant.border : colors.textSecondary} />
            <Text
              style={[
                styles.actionBtnLabel,
                { color: showDelegateNudge ? quadrant.border : colors.textSecondary },
                showDelegateNudge && { fontWeight: '700' },
              ]}
            >
              Delegate
            </Text>
            {showDelegateNudge && (
              <View style={[styles.nudgeDot, { backgroundColor: quadrant.border }]} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#C7605B40' }]}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <Trash2 size={13} color="#C7605B" />
            <Text style={[styles.actionBtnLabel, { color: '#C7605B' }]}>
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Main Component ──────────────────────────────────────────────────

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

  // Count items per quadrant for the legend
  const allItems = [
    ...grouped.roles,
    ...grouped.wellness,
    ...grouped.goals,
    ...grouped.other,
  ].filter((i) => !i.completed_at);

  const q1Count = allItems.filter((i) => i.is_urgent && i.is_important).length;
  const q2Count = allItems.filter((i) => !i.is_urgent && i.is_important).length;
  const q3Count = allItems.filter((i) => i.is_urgent && !i.is_important).length;
  const q4Count = allItems.filter((i) => !i.is_urgent && !i.is_important).length;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        Here's what you said you wanted to accomplish today
      </Text>

      {/* Eisenhower legend bar */}
      <View style={styles.legendBar}>
        {q1Count > 0 && (
          <View style={[styles.legendItem, { backgroundColor: QUADRANT.Q1.border + '15' }]}>
            <View style={[styles.legendDot, { backgroundColor: QUADRANT.Q1.border }]} />
            <Text style={[styles.legendText, { color: QUADRANT.Q1.border }]}>Do {q1Count}</Text>
          </View>
        )}
        {q2Count > 0 && (
          <View style={[styles.legendItem, { backgroundColor: QUADRANT.Q2.border + '15' }]}>
            <View style={[styles.legendDot, { backgroundColor: QUADRANT.Q2.border }]} />
            <Text style={[styles.legendText, { color: QUADRANT.Q2.border }]}>Schedule {q2Count}</Text>
          </View>
        )}
        {q3Count > 0 && (
          <View style={[styles.legendItem, { backgroundColor: QUADRANT.Q3.border + '15' }]}>
            <View style={[styles.legendDot, { backgroundColor: QUADRANT.Q3.border }]} />
            <Text style={[styles.legendText, { color: QUADRANT.Q3.border }]}>Delegate {q3Count}</Text>
          </View>
        )}
        {q4Count > 0 && (
          <View style={[styles.legendItem, { backgroundColor: QUADRANT.Q4.border + '15' }]}>
            <View style={[styles.legendDot, { backgroundColor: QUADRANT.Q4.border }]} />
            <Text style={[styles.legendText, { color: QUADRANT.Q4.border }]}>Low {q4Count}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleSections.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? colors.surface : '#FFF' }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks scheduled for today. Tap "+ Add New" to get started.
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

      {/* Fixed bottom bar */}
      <View
        style={[
          styles.bottomBar,
          {
            borderTopColor: colors.border,
            backgroundColor: isDarkMode ? colors.background : '#FFFFFF',
          },
        ]}
      >
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

        <View style={[styles.targetBadge, { backgroundColor: isDarkMode ? colors.surface : '#FFF5E1', borderColor: '#D4924A40' }]}>
          <Text style={[styles.targetText, { color: '#D4924A' }]}>
            Target: {targetScore} pts
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
    lineHeight: 23,
    color: '#2D3748',
  },

  // ── Legend ──
  legendBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Loading ──
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

  // ── Scroll area ──
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },

  // ── Empty ──
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Section headers ──
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

  // ── Task card ──
  taskCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 6,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
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
    gap: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    color: '#2D3748',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
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

  // ── Meta row (time + quadrant) ──
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
  },
  quadrantBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  quadrantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // ── Tags ──
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  tagPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Action buttons ──
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  nudgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },

  // ── Bottom bar ──
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
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  targetText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
