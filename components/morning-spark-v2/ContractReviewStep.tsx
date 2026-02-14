import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Clock,
  Users,
  CalendarDays,
  Trash2,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  GroupedContractItems,
  GoalContractGroup,
  WeeklyContractItem,
} from '@/lib/morningSparkV2Service';
import { CoachInsight } from './CoachInsight';
import type { CoachTone } from '@/types/alignmentCoach';

// ── FAB Icon images (same as BrainDumpTriageStep / SpeedDialFab) ────
const SOURCE_ICONS: Record<string, any> = {
  task: require('@/assets/images/task-list.png'),
  event: require('@/assets/images/calendar.png'),
};

// ── Eisenhower-based color palette ──────────────────────────────────
const QUADRANT = {
  Q1: { border: '#DC4545', bg: '#DC454510', label: 'Do First', labelColor: '#DC4545' },
  Q2: { border: '#3DA87A', bg: '#3DA87A10', label: 'Schedule', labelColor: '#3DA87A' },
  Q3: { border: '#D4924A', bg: '#D4924A10', label: 'Delegate', labelColor: '#D4924A' },
  Q4: { border: '#A0AEC0', bg: '#A0AEC010', label: 'Low Priority', labelColor: '#A0AEC0' },
} as const;

const CONFETTI_COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#FFA07A', '#87CEEB'];

function getQuadrant(item: WeeklyContractItem) {
  if (item.is_urgent && item.is_important) return QUADRANT.Q1;
  if (!item.is_urgent && item.is_important) return QUADRANT.Q2;
  if (item.is_urgent && !item.is_important) return QUADRANT.Q3;
  return QUADRANT.Q4;
}

function isDelegateCandidate(item: WeeklyContractItem) {
  return (item.is_urgent && !item.is_important) || (!item.is_urgent && !item.is_important);
}

/** Calculate days overdue relative to today */
function getDaysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatOverdue(days: number): string {
  if (days === 1) return '1 day overdue';
  if (days < 7) return `${days} days overdue`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week overdue' : `${weeks} weeks overdue`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month overdue' : `${months} months overdue`;
}

// ── Props ───────────────────────────────────────────────────────────

interface ContractReviewStepProps {
  grouped: GroupedContractItems;
  loading: boolean;
  onAdjust: (taskId: string, action: 'delay' | 'delete' | 'delegate', newDate?: string) => void;
  onCommitToTask: (taskId: string) => void;
  committedTaskIds: Set<string>;
  onEdit: (taskId: string) => void;
  onAddNew: () => void;
  targetScore: number;
  coachMessage?: string | null;
  coachTone?: CoachTone;
}

/** Flat sections (roles, wellness, unassigned) — goals handled separately */
interface FlatSectionConfig {
  key: 'roles' | 'wellness' | 'unassigned';
  label: string;
  icon: string;
}

const FLAT_SECTIONS: FlatSectionConfig[] = [
  { key: 'roles', label: 'Roles', icon: '\u{1F465}' },
  { key: 'wellness', label: 'Wellness Zones', icon: '\u{1F9D8}' },
];

// ── Confetti Particle ───────────────────────────────────────────────

function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const xDrift = (Math.random() - 0.5) * 120;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -80 - Math.random() * 40, duration: 600, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: xDrift, duration: 600, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: Math.random() * 4 - 2, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateY, { toValue: 40, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [-2, 2], outputRange: ['-120deg', '120deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        bottom: '40%',
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
      pointerEvents="none"
    />
  );
}

// ── Celebration Overlay (inline per card) ───────────────────────────
// type: 'commit' = 🫶 (heart-hands), 'delete' = "Get Out of Here!" text
type CelebrationType = 'commit' | 'delete';

function CardCelebration({ visible, type, onFinished }: { visible: boolean; type: CelebrationType; onFinished: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(30)).current;
  const [confettiPieces] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 200,
      startX: 20 + Math.random() * 160,
    }))
  );

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      riseAnim.setValue(30);
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(riseAnim, { toValue: 0, tension: 60, friction: 7, useNativeDriver: true }),
        ]),
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(riseAnim, { toValue: -20, duration: 400, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start(() => onFinished());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.celebrationOverlay,
        { opacity: opacityAnim },
      ]}
      pointerEvents="none"
    >
      {confettiPieces.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} startX={p.startX} />
      ))}
      <Animated.View style={{ transform: [{ scale: scaleAnim }, { translateY: riseAnim }] }}>
        {type === 'delete' ? (
          <Text style={styles.celebrationDeleteText}>Get Out of Here!</Text>
        ) : (
          <Text style={styles.celebrationEmoji}>{'\u{1FAF6}'}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

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
  onCommitToTask,
  isCommitted,
  onEdit,
}: {
  item: WeeklyContractItem;
  colors: ReturnType<typeof useTheme>['colors'];
  isDarkMode: boolean;
  onAdjust: ContractReviewStepProps['onAdjust'];
  onCommitToTask: ContractReviewStepProps['onCommitToTask'];
  isCommitted: boolean;
  onEdit: ContractReviewStepProps['onEdit'];
}) {
  const quadrant = getQuadrant(item);
  const showDelegateNudge = isDelegateCandidate(item);
  const daysOverdue = getDaysOverdue(item.due_date);
  const isOverdue = daysOverdue > 0;
  const [celebrationType, setCelebrationType] = useState<CelebrationType | null>(null);

  const handleReschedule = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdjust(item.id, 'delay');
  };

  const handleDelegate = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdjust(item.id, 'delegate');
  };

  const handleRemove = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCelebrationType('delete');
    // Delay actual deletion so celebration plays first
    setTimeout(() => {
      onAdjust(item.id, 'delete');
    }, 1300);
  };

  const handleDoIt = () => {
    if (isCommitted || celebrationType) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCelebrationType('commit');
    // "Do It" = commit to the task for today's contract (NOT mark completed)
    onCommitToTask(item.id);
  };

  const handleEdit = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit(item.id);
  };

  const timeDisplay =
    item.start_time && item.end_time
      ? `${item.start_time} - ${item.end_time}`
      : item.start_time
        ? item.start_time
        : null;

  const isEvent = item.type === 'event';
  const iconSource = isEvent ? SOURCE_ICONS.event : SOURCE_ICONS.task;

  return (
    <TouchableOpacity
      onPress={handleEdit}
      activeOpacity={0.8}
      style={[
        styles.taskCard,
        {
          backgroundColor: isCommitted
            ? (isDarkMode ? '#1A3A2A' : '#F0FFF4')
            : (isDarkMode ? colors.surface : '#FFFFFF'),
          borderColor: isCommitted
            ? '#3DA87A40'
            : isOverdue ? '#DC454540' : (isDarkMode ? colors.border : '#EDF2F7'),
          borderLeftColor: isCommitted ? '#3DA87A' : quadrant.border,
          borderLeftWidth: 4,
        },
      ]}
    >
      {/* Celebration overlay (stacks on top of card content) */}
      <CardCelebration visible={!!celebrationType} type={celebrationType || 'commit'} onFinished={() => setCelebrationType(null)} />

      {/* Row 1: FAB Icon + Title + (One Thing) + Points */}
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <View style={[styles.typeIconWrap, { backgroundColor: quadrant.border + '15' }]}>
            <Image source={iconSource} style={styles.typeIconImage} resizeMode="contain" />
          </View>
          <Text
            style={[
              styles.taskTitle,
              { color: colors.text },
              !!item.completed_at && styles.strikethrough,
            ]}
            numberOfLines={2}
          >
            {item.title}
            {item.one_thing && (
              <Text style={styles.oneThingLabel}> (One Thing)</Text>
            )}
          </Text>
        </View>
        <View style={styles.rightCol}>
          <View style={[styles.pointsBadge, { backgroundColor: quadrant.border + '18' }]}>
            <Text style={[styles.pointsText, { color: quadrant.border }]}>+{item.points}</Text>
          </View>
          <ChevronRight size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
        </View>
      </View>

      {/* Row 2: Time + Overdue badge + Quadrant badge */}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          {timeDisplay && (
            <View style={styles.timeContainer}>
              <Clock size={12} color={colors.textSecondary} />
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>{timeDisplay}</Text>
            </View>
          )}
          {isOverdue && (
            <View style={[styles.overdueBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
              <Text style={styles.overdueText}>
                {'\u26A0\uFE0F'} {formatOverdue(daysOverdue)}
              </Text>
            </View>
          )}
        </View>
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
      <View style={styles.actionsRow}>
        {/* Do It (commit to contract — 🫶 heart-hands celebration) */}
        {isCommitted ? (
          <View style={[styles.actionBtn, styles.committedBtn]}>
            <Text style={styles.actionBtnEmoji}>{'\u{1FAF6}'}</Text>
            <Text style={[styles.actionBtnLabel, { color: '#3DA87A', fontWeight: '700' }]}>
              Committed
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.doItBtn]}
            onPress={handleDoIt}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnEmoji}>{'\u{1FAF6}'}</Text>
            <Text style={[styles.actionBtnLabel, { color: '#3DA87A', fontWeight: '700' }]}>
              Do It
            </Text>
          </TouchableOpacity>
        )}

        {/* Reschedule (opens date picker) — hidden once committed */}
        {!isCommitted && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={handleReschedule}
            activeOpacity={0.7}
          >
            <CalendarDays size={13} color={colors.textSecondary} />
            <Text style={[styles.actionBtnLabel, { color: colors.textSecondary }]}>Reschedule</Text>
          </TouchableOpacity>
        )}

        {/* Delegate — hidden once committed */}
        {!isCommitted && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              showDelegateNudge
                ? { borderColor: quadrant.border, backgroundColor: quadrant.border + '12', borderWidth: 1.5 }
                : { borderColor: colors.border },
            ]}
            onPress={handleDelegate}
            activeOpacity={0.7}
          >
            <Users size={13} color={showDelegateNudge ? quadrant.border : colors.textSecondary} />
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
        )}

        {/* Delete (🗑️ "Get Out of Here!" celebration) */}
        {!isCommitted && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#C7605B40' }]}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnEmoji}>{'\u{1F5D1}\uFE0F'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function ContractReviewStep({
  grouped,
  loading,
  onAdjust,
  onCommitToTask,
  committedTaskIds,
  onEdit,
  onAddNew,
  targetScore,
  coachMessage,
  coachTone,
}: ContractReviewStepProps) {
  const { colors, isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    roles: true,
    wellness: true,
    goals: true,
    unassigned: true,
  });

  const toggleSection = useCallback((key: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  // Collect all flat items for Eisenhower counts
  const goalTasks = grouped.goals.flatMap((g) => g.tasks);
  const allItems = [
    ...grouped.roles, ...grouped.wellness, ...goalTasks, ...grouped.unassigned,
  ].filter((i) => !i.completed_at);

  // Extract One Thing items to surface at the top
  const oneThingItems = allItems.filter((i) => i.one_thing);

  const q1Count = allItems.filter((i) => i.is_urgent && i.is_important).length;
  const q2Count = allItems.filter((i) => !i.is_urgent && i.is_important).length;
  const q3Count = allItems.filter((i) => i.is_urgent && !i.is_important).length;
  const q4Count = allItems.filter((i) => !i.is_urgent && !i.is_important).length;

  const hasAnything =
    grouped.roles.length > 0 ||
    grouped.wellness.length > 0 ||
    grouped.goals.length > 0 ||
    grouped.unassigned.length > 0;

  // Helper to render a collapsible flat section
  const renderFlatSection = (
    key: string,
    label: string,
    icon: string,
    items: WeeklyContractItem[],
  ) => {
    if (items.length === 0) return null;
    const isExpanded = expanded[key];
    return (
      <View key={key} style={styles.sectionContainer}>
        <TouchableOpacity
          style={[
            styles.sectionHeader,
            { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB', borderColor: colors.border },
          ]}
          onPress={() => toggleSection(key)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionIcon}>{icon}</Text>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{label}</Text>
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
              key={item.id} item={item} colors={colors} isDarkMode={isDarkMode}
              onAdjust={onAdjust} onCommitToTask={onCommitToTask}
              isCommitted={committedTaskIds.has(item.id)} onEdit={onEdit}
            />
          ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {coachMessage && (
        <View style={{ marginBottom: 4 }}>
          <CoachInsight
            message={coachMessage}
            tone={coachTone || 'push_forward'}
            loading={false}
            isFallback={false}
            startCollapsed={true}
          />
        </View>
      )}
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
        {!hasAnything && (
          <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? colors.surface : '#FFF' }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks scheduled for today. Tap "+ Add New" to get started.
            </Text>
          </View>
        )}

        {/* One Thing Focus — surfaced at top for daily priority */}
        {oneThingItems.length > 0 && (
          <View style={styles.sectionContainer}>
            <View
              style={[
                styles.oneThingBanner,
                { backgroundColor: isDarkMode ? '#2A2000' : '#FFFBEB', borderColor: '#D4A84350' },
              ]}
            >
              <Text style={styles.oneThingBannerIcon}>{'\u2B50'}</Text>
              <View style={styles.oneThingBannerTextWrap}>
                <Text style={[styles.oneThingBannerTitle, { color: isDarkMode ? '#FFD700' : '#92400E' }]}>
                  Your One Thing{oneThingItems.length > 1 ? 's' : ''}
                </Text>
                <Text style={[styles.oneThingBannerSub, { color: isDarkMode ? '#D4A843' : '#B45309' }]}>
                  If you do nothing else today, do this
                </Text>
              </View>
            </View>
            {oneThingItems.map((item) => (
              <TaskCard
                key={`onething-${item.id}`} item={item} colors={colors} isDarkMode={isDarkMode}
                onAdjust={onAdjust} onCommitToTask={onCommitToTask}
                isCommitted={committedTaskIds.has(item.id)} onEdit={onEdit}
              />
            ))}
          </View>
        )}

        {/* Roles section */}
        {renderFlatSection('roles', 'Roles', '\u{1F465}', grouped.roles)}

        {/* Wellness section */}
        {renderFlatSection('wellness', 'Wellness Zones', '\u{1F9D8}', grouped.wellness)}

        {/* Goals section — parent goal headers with nested tasks */}
        {grouped.goals.length > 0 && (
          <View style={styles.sectionContainer}>
            <TouchableOpacity
              style={[
                styles.sectionHeader,
                { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB', borderColor: colors.border },
              ]}
              onPress={() => toggleSection('goals')}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionIcon}>{'\u{1F3AF}'}</Text>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Goals</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.countBadgeText}>{grouped.goals.length}</Text>
                </View>
              </View>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>
                {expanded.goals ? '\u25B2' : '\u25BC'}
              </Text>
            </TouchableOpacity>

            {expanded.goals &&
              grouped.goals.map((goalGroup) => {
                const targetMet =
                  goalGroup.weeklyTarget !== null &&
                  goalGroup.weeklyActual >= goalGroup.weeklyTarget;

                return (
                  <View key={goalGroup.goalId} style={styles.goalGroupContainer}>
                    {/* Goal parent header */}
                    <View style={[styles.goalHeader, { backgroundColor: isDarkMode ? colors.surface : '#F0F7FF' }]}>
                      <View style={styles.goalHeaderLeft}>
                        <Text style={styles.goalIcon}>{'\u{1F3AF}'}</Text>
                        <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={1}>
                          {goalGroup.goalTitle}
                        </Text>
                      </View>
                      {goalGroup.weeklyTarget !== null && (
                        <View
                          style={[
                            styles.weeklyProgressBadge,
                            {
                              backgroundColor: targetMet ? '#3DA87A20' : '#5B9BD520',
                              borderColor: targetMet ? '#3DA87A' : '#5B9BD5',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.weeklyProgressText,
                              { color: targetMet ? '#3DA87A' : '#5B9BD5' },
                            ]}
                          >
                            {targetMet
                              ? `\u2713 ${goalGroup.weeklyActual}/${goalGroup.weeklyTarget} this week`
                              : `${goalGroup.weeklyActual}/${goalGroup.weeklyTarget} this week`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Goal's child tasks */}
                    {goalGroup.tasks.map((item) => (
                      <TaskCard
                        key={item.id} item={item} colors={colors} isDarkMode={isDarkMode}
                        onAdjust={onAdjust} onCommitToTask={onCommitToTask}
                        isCommitted={committedTaskIds.has(item.id)} onEdit={onEdit}
                      />
                    ))}
                  </View>
                );
              })}
          </View>
        )}

        {/* Unassigned section (was "Other") */}
        {renderFlatSection('unassigned', 'Unassigned', '\u{1F4CB}', grouped.unassigned)}
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
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  container: { flex: 1, paddingTop: 8 },

  title: {
    fontSize: 17, fontWeight: '700', textAlign: 'center',
    marginBottom: 10, paddingHorizontal: 16, lineHeight: 23,
  },

  // ── Legend ──
  legendBar: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 6, paddingHorizontal: 16, marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, gap: 4,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },

  // ── Loading ──
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: 14 },

  // ── Scroll ──
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 16 },

  // ── Empty ──
  emptyCard: { borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // ── Section ──
  sectionContainer: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { fontSize: 18 },
  sectionLabel: { fontSize: 15, fontWeight: '600' },
  countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  countBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  chevron: { fontSize: 12 },

  // ── Task card ──
  taskCard: {
    borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 6, marginLeft: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
    overflow: 'hidden', // for celebration overlay
  },
  taskHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  oneThingLabel: { fontSize: 12, fontWeight: '700', color: '#D4A843', fontStyle: 'italic' },
  oneThingBanner: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    borderWidth: 1, marginBottom: 8, gap: 10,
  },
  oneThingBannerIcon: { fontSize: 24 },
  oneThingBannerTextWrap: { flex: 1 },
  oneThingBannerTitle: { fontSize: 15, fontWeight: '700' },
  oneThingBannerSub: { fontSize: 12, marginTop: 2 },
  typeIconWrap: {
    width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  typeIconImage: { width: 18, height: 18 },
  taskTitle: { fontSize: 14, fontWeight: '600', flex: 1, color: '#2D3748' },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.5 },
  rightCol: { alignItems: 'flex-end', gap: 4, marginLeft: 6 },
  pointsBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pointsText: { fontSize: 13, fontWeight: '700' },

  // ── Meta row ──
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, flexWrap: 'wrap', gap: 4,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12 },
  overdueBadge: {
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
  },
  overdueText: { fontSize: 10, fontWeight: '600', color: '#D97706' },
  quadrantBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  quadrantBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },

  // ── Tags ──
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  tagPill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  tagPillText: { fontSize: 10, fontWeight: '600' },

  // ── Actions ──
  actionsRow: { flexDirection: 'row', gap: 5, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 3,
  },
  doItBtn: {
    borderColor: '#3DA87A50', backgroundColor: '#3DA87A10',
  },
  committedBtn: {
    borderColor: '#3DA87A', backgroundColor: '#3DA87A20', borderWidth: 1.5,
  },
  actionBtnLabel: { fontSize: 11, fontWeight: '500' },
  actionBtnEmoji: { fontSize: 13 },
  nudgeDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 1 },

  // ── Goal groups ──
  goalGroupContainer: { marginTop: 6, marginLeft: 8 },
  goalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: '#5B9BD5',
  },
  goalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  goalIcon: { fontSize: 14 },
  goalTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  weeklyProgressBadge: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
    marginLeft: 6,
  },
  weeklyProgressText: { fontSize: 10, fontWeight: '700' },

  // ── Celebration ──
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
  },
  celebrationEmoji: { fontSize: 56 },
  celebrationDeleteText: {
    fontSize: 22, fontWeight: '800', color: '#C7605B', textAlign: 'center',
  },

  // ── Bottom ──
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
  },
  addNewBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, gap: 6,
  },
  addNewIcon: { color: '#FFF', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  addNewLabel: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  targetBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  targetText: { fontSize: 14, fontWeight: '700' },
});
