import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  AspirationContent,
  WeeklyContractItem,
  DelegationItem,
} from '@/lib/morningSparkV2Service';
import { CoachInsight } from './CoachInsight';
import type { CoachTone } from '@/types/alignmentCoach';

// ── FAB Icon images ────────────────────────────────────────────────
const SOURCE_ICONS: Record<string, any> = {
  task: require('@/assets/images/task-list.png'),
  event: require('@/assets/images/calendar.png'),
};

// ── Eisenhower color for left border ─────────────────────────────
function getQuadrantColor(item: WeeklyContractItem): string {
  if (item.is_urgent && item.is_important) return '#DC4545';
  if (!item.is_urgent && item.is_important) return '#3DA87A';
  if (item.is_urgent && !item.is_important) return '#D4924A';
  return '#A0AEC0';
}

// ── Props ──────────────────────────────────────────────────────────

interface ContractCloseStepProps {
  aspiration: AspirationContent | null;
  committedItems: WeeklyContractItem[];
  delegations: DelegationItem[];
  targetScore: number;
  contractItemCount: number;
  onCommit: () => void;
  committing: boolean;
  /** Alignment coach message for the close step */
  coachMessage?: string | null;
  /** Coach message tone */
  coachTone?: CoachTone;
  /** Coach is still loading */
  coachLoading?: boolean;
  /** Coach message is from local fallback */
  coachIsFallback?: boolean;
}

// ── Compact item row (read-only) ──────────────────────────────────

function CommittedItemRow({
  item,
  colors,
  isDarkMode,
}: {
  item: WeeklyContractItem;
  colors: any;
  isDarkMode: boolean;
}) {
  const isEvent = item.type === 'event';
  const iconSource = isEvent ? SOURCE_ICONS.event : SOURCE_ICONS.task;
  const borderColor = getQuadrantColor(item);

  const timeDisplay =
    item.start_time && item.end_time
      ? `${item.start_time} – ${item.end_time}`
      : item.start_time || null;

  return (
    <View
      style={[
        styles.itemRow,
        {
          backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
          borderLeftColor: borderColor,
          borderColor: isDarkMode ? colors.border : '#EDF2F7',
        },
      ]}
    >
      <View style={[styles.itemIconWrap, { backgroundColor: borderColor + '15' }]}>
        <Image source={iconSource} style={styles.itemIconImage} resizeMode="contain" />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
          {item.one_thing && <Text style={styles.oneThingLabel}> (One Thing)</Text>}
        </Text>
        {timeDisplay && (
          <View style={styles.itemTimeRow}>
            <Clock size={10} color={colors.textSecondary} />
            <Text style={[styles.itemTimeText, { color: colors.textSecondary }]}>{timeDisplay}</Text>
          </View>
        )}
      </View>
      <View style={[styles.itemPointsBadge, { backgroundColor: borderColor + '18' }]}>
        <Text style={[styles.itemPointsText, { color: borderColor }]}>+{item.points}</Text>
      </View>
    </View>
  );
}

// ── Build AI coaching summary ─────────────────────────────────────

function buildCoachingSummary(
  items: WeeklyContractItem[],
  delegations: DelegationItem[],
): string {
  const events = items.filter((i) => i.type === 'event');
  const tasks = items.filter((i) => i.type === 'task');

  // Count unique roles
  const roleSet = new Set<string>();
  items.forEach((i) => i.roles.forEach((r) => roleSet.add(r.label)));
  const roleCount = roleSet.size;

  // Count unique wellness domains
  const domainSet = new Set<string>();
  items.forEach((i) => i.domains.forEach((d) => domainSet.add(d.name)));
  const wellnessCount = domainSet.size;

  // Build goal summary from unique goals across all committed items
  const goalMap = new Map<string, { title: string; count: number }>();
  items.forEach((i) => {
    i.goals.forEach((g) => {
      const existing = goalMap.get(g.id);
      if (existing) {
        existing.count += 1;
      } else {
        goalMap.set(g.id, { title: g.title, count: 1 });
      }
    });
  });
  const goalSummaries = Array.from(goalMap.values()).map(
    (g) => `${g.count} action${g.count !== 1 ? 's' : ''} toward "${g.title}"`
  );

  // Delegation count
  const delegateCount = delegations.filter((d) => d.status !== 'completed').length;

  // Build the summary text
  const parts: string[] = [];

  // Event + task counts
  const countParts: string[] = [];
  if (events.length > 0) {
    countParts.push(`${events.length} event${events.length !== 1 ? 's' : ''}`);
  }
  if (tasks.length > 0) {
    countParts.push(`${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);
  }

  if (countParts.length > 0) {
    parts.push(`You committed to ${countParts.join(' and ')} for today`);
  } else {
    parts.push("You haven't committed to anything yet — go back and tap \"Do It\" on items you want to tackle today");
  }

  // Role + wellness + goal support
  const supportParts: string[] = [];
  if (roleCount > 0) {
    supportParts.push(`${roleCount} role${roleCount !== 1 ? 's' : ''}`);
  }
  if (wellnessCount > 0) {
    supportParts.push(`${wellnessCount} wellness zone${wellnessCount !== 1 ? 's' : ''}`);
  }
  if (supportParts.length > 0) {
    parts.push(`plan to support ${supportParts.join(' and ')}`);
  }

  // Goals
  if (goalSummaries.length > 0) {
    if (goalSummaries.length === 1) {
      parts.push(`and do ${goalSummaries[0]}`);
    } else {
      parts.push(`and do ${goalSummaries.join(', ')}`);
    }
  }

  // Delegation
  if (delegateCount > 0) {
    parts.push(
      `You have ${delegateCount} item${delegateCount !== 1 ? 's' : ''} delegated — follow up to keep things moving`
    );
  } else {
    parts.push("You don't have anything delegated right now");
  }

  let summary = parts.join(', ') + '.';
  // Fix sentence-level capitalization after periods
  summary = summary.replace(/\. y/g, '. Y');

  // Tone assessment
  const totalActive = items.length;
  let tone: string;
  if (totalActive === 0) {
    tone = "Hmm, an empty slate — go back to the Contract step and commit to some items.";
  } else if (totalActive <= 3) {
    tone = "A focused day — quality over quantity. Make each one count.";
  } else if (totalActive <= 7) {
    tone = "Solid game plan — balanced and achievable. You've got this.";
  } else if (totalActive <= 12) {
    tone = "This is ambitious — make sure you protect your energy and prioritize.";
  } else {
    tone = "That's a lot on your plate — consider if everything truly needs to happen today.";
  }

  const reminder = "Remember to capture reflections, take time to see a Rose in your day, and be honest about challenges. Let's get to work — we'll see you at the Evening Review!";

  return `${summary}\n\n${tone}\n\n${reminder}`;
}

// ── Main Component ────────────────────────────────────────────────

export default function ContractCloseStep({
  aspiration,
  committedItems,
  delegations,
  targetScore,
  contractItemCount,
  onCommit,
  committing,
  coachMessage,
  coachTone: coachToneProp = 'push_forward',
  coachLoading = false,
  coachIsFallback = false,
}: ContractCloseStepProps) {
  const { colors, isDarkMode } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(0.5)).current;
  const [committed, setCommitted] = useState(false);
  const prevCommitting = useRef(committing);

  // Detect when committing transitions from true to false (success)
  useEffect(() => {
    if (prevCommitting.current && !committing) {
      setCommitted(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Animated.parallel([
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCommitting.current = committing;
  }, [committing]);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleCommit = () => {
    if (committing || committed) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onCommit();
  };

  // Sorted items: events first (one_thing on top), then tasks (one_thing on top)
  const sortedItems = useMemo(() => {
    const events = committedItems
      .filter((i) => i.type === 'event')
      .sort((a, b) => (b.one_thing ? 1 : 0) - (a.one_thing ? 1 : 0));

    const tasks = committedItems
      .filter((i) => i.type === 'task')
      .sort((a, b) => (b.one_thing ? 1 : 0) - (a.one_thing ? 1 : 0));

    return { events, tasks };
  }, [committedItems]);

  // Active delegations
  const activeDelegations = useMemo(
    () => delegations.filter((d) => d.status !== 'completed'),
    [delegations],
  );

  // AI coaching summary
  const coachingSummary = useMemo(
    () => buildCoachingSummary(committedItems, delegations),
    [committedItems, delegations],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Coach summary section — use AI coach if available, fallback to local */}
        {(coachMessage || coachLoading) ? (
          <CoachInsight
            message={coachMessage ?? null}
            tone={coachToneProp}
            loading={coachLoading}
            isFallback={coachIsFallback}
          />
        ) : (
          <View
            style={[
              styles.coachCard,
              {
                backgroundColor: isDarkMode ? colors.surface : '#F0F7FF',
                borderColor: isDarkMode ? colors.border : '#5B9BD540',
              },
            ]}
          >
            <Text style={styles.coachIcon}>{'\u{1F9E0}'}</Text>
            <Text style={[styles.coachTitle, { color: colors.text }]}>
              Alignment Coach
            </Text>
            <Text style={[styles.coachSummary, { color: colors.textSecondary }]}>
              {coachingSummary}
            </Text>
          </View>
        )}

        {/* Committed items */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          Here's what you've committed to today
        </Text>

        {/* Events section */}
        {sortedItems.events.length > 0 && (
          <View style={styles.itemSection}>
            <View style={styles.itemSectionHeader}>
              <Text style={styles.itemSectionEmoji}>{'\u{1F4C5}'}</Text>
              <Text style={[styles.itemSectionLabel, { color: colors.text }]}>
                Events
              </Text>
              <View style={[styles.itemSectionCount, { backgroundColor: '#5B9BD5' }]}>
                <Text style={styles.itemSectionCountText}>{sortedItems.events.length}</Text>
              </View>
            </View>
            {sortedItems.events.map((item) => (
              <CommittedItemRow key={item.id} item={item} colors={colors} isDarkMode={isDarkMode} />
            ))}
          </View>
        )}

        {/* Tasks section */}
        {sortedItems.tasks.length > 0 && (
          <View style={styles.itemSection}>
            <View style={styles.itemSectionHeader}>
              <Text style={styles.itemSectionEmoji}>{'\u2705'}</Text>
              <Text style={[styles.itemSectionLabel, { color: colors.text }]}>
                Tasks
              </Text>
              <View style={[styles.itemSectionCount, { backgroundColor: '#3DA87A' }]}>
                <Text style={styles.itemSectionCountText}>{sortedItems.tasks.length}</Text>
              </View>
            </View>
            {sortedItems.tasks.map((item) => (
              <CommittedItemRow key={item.id} item={item} colors={colors} isDarkMode={isDarkMode} />
            ))}
          </View>
        )}

        {/* Delegated section */}
        {activeDelegations.length > 0 && (
          <View style={styles.itemSection}>
            <View style={styles.itemSectionHeader}>
              <Text style={styles.itemSectionEmoji}>{'\u{1F465}'}</Text>
              <Text style={[styles.itemSectionLabel, { color: colors.text }]}>
                Delegated
              </Text>
              <View style={[styles.itemSectionCount, { backgroundColor: '#D4924A' }]}>
                <Text style={styles.itemSectionCountText}>{activeDelegations.length}</Text>
              </View>
            </View>
            {activeDelegations.map((d) => (
              <View
                key={d.delegation_id}
                style={[
                  styles.delegateRow,
                  {
                    backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
                    borderColor: isDarkMode ? colors.border : '#EDF2F7',
                  },
                ]}
              >
                <View style={[styles.delegateIconWrap]}>
                  <Text style={styles.delegateIconText}>{'\u{1F465}'}</Text>
                </View>
                <View style={styles.delegateContent}>
                  <Text style={[styles.delegateTitle, { color: colors.text }]} numberOfLines={1}>
                    {d.task_title}
                  </Text>
                  <Text style={[styles.delegateSubtext, { color: colors.textSecondary }]}>
                    {'\u2192'} {d.delegate_name}
                    {d.due_date ? ` · Due ${d.due_date}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {sortedItems.events.length === 0 && sortedItems.tasks.length === 0 && activeDelegations.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? colors.surface : '#FFF' }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No items committed yet. Go back to the Contract step to add some.
            </Text>
          </View>
        )}

        {/* Target badge */}
        <View style={styles.targetRow}>
          <View style={[styles.targetBadge, { backgroundColor: isDarkMode ? colors.surface : '#FFF5E1', borderColor: '#D4924A40' }]}>
            <Text style={styles.targetText}>
              {'\u{1F3AF}'} Target: <Text style={styles.targetPoints}>{targetScore} pts</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Commit button (fixed at bottom) */}
      {!committed ? (
        <Animated.View style={[styles.commitWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity
            style={[
              styles.commitButton,
              committing && styles.commitButtonDisabled,
            ]}
            onPress={handleCommit}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.85}
            disabled={committing || committed}
          >
            {committing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.commitButtonText}>
                {'\u{270D}\uFE0F'} Sign Your Contract
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.celebrationContainer,
            {
              opacity: celebrationOpacity,
              transform: [{ scale: celebrationScale }],
            },
          ]}
        >
          <Text style={styles.celebrationCheck}>{'\u2705'}</Text>
          <Text style={[styles.celebrationText, { color: colors.success }]}>
            You got this!
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },

  // ── Coach Card ──
  coachCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  coachIcon: { fontSize: 28, marginBottom: 6 },
  coachTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  coachSummary: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  // ── Section Heading ──
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },

  // ── Item Sections ──
  itemSection: { marginBottom: 14 },
  itemSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingLeft: 4,
  },
  itemSectionEmoji: { fontSize: 15 },
  itemSectionLabel: { fontSize: 14, fontWeight: '600' },
  itemSectionCount: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  itemSectionCountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // ── Committed Item Row ──
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 5,
    gap: 8,
  },
  itemIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconImage: { width: 14, height: 14 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '600' },
  oneThingLabel: { fontSize: 11, fontWeight: '700', color: '#D4A843', fontStyle: 'italic' },
  itemTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  itemTimeText: { fontSize: 11 },
  itemPointsBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  itemPointsText: { fontSize: 11, fontWeight: '700' },

  // ── Delegate Row ──
  delegateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#D4924A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 5,
    gap: 8,
  },
  delegateIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#D4924A15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  delegateIconText: { fontSize: 12 },
  delegateContent: { flex: 1 },
  delegateTitle: { fontSize: 13, fontWeight: '600' },
  delegateSubtext: { fontSize: 11, marginTop: 1 },

  // ── Empty ──
  emptyCard: { borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // ── Target ──
  targetRow: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  targetBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  targetText: { fontSize: 14, fontWeight: '600', color: '#D4924A' },
  targetPoints: { fontWeight: '800' },

  // ── Commit Button ──
  commitWrapper: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    paddingTop: 8,
  },
  commitButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4A843',
    shadowColor: '#C4972E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    minHeight: 56,
  },
  commitButtonDisabled: {
    opacity: 0.7,
  },
  commitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Celebration ──
  celebrationContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  celebrationCheck: {
    fontSize: 40,
    marginBottom: 8,
  },
  celebrationText: {
    fontSize: 22,
    fontWeight: '700',
  },
});
