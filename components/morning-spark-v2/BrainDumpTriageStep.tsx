import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import type { BrainDumpTriageItem, TriageAction } from '@/lib/morningSparkV2Service';
import { triageBrainDumpItem } from '@/lib/morningSparkV2Service';
import { toLocalISOString } from '@/lib/dateUtils';

// ============ TYPES ============

interface BrainDumpTriageStepProps {
  items: BrainDumpTriageItem[];
  userId: string;
  onItemProcessed: (itemId: string) => void;
  onAllProcessed: () => void;
}

interface ActionOption {
  action: TriageAction;
  label: string;
  emoji: string;
  color: string;
}

// ============ CONSTANTS ============

/**
 * FAB-style source icons from activityConfig.ts
 */
const SOURCE_ICONS: Record<string, any> = {
  task: require('@/assets/images/task-list.png'),
  event: require('@/assets/images/calendar.png'),
  rose: require('@/assets/images/rose-81.png'),
  thorn: require('@/assets/images/thorn-81.png'),
  depositIdea: require('@/assets/images/deposit-idea.png'),
  reflection: require('@/assets/images/reflections-72.png'),
  brain_dump: require('@/assets/images/reflections-72.png'),
};

const SOURCE_COLORS: Record<string, string> = {
  task: '#3b82f6',
  event: '#22c55e',
  rose: '#ec4899',
  thorn: '#ef4444',
  depositIdea: '#f59e0b',
  reflection: '#9333ea',
  brain_dump: '#8B5CF6',
};

const ACTION_OPTIONS: ActionOption[] = [
  { action: 'do_today', label: 'Do Today', emoji: '\u{1F4AA}', color: '#3B82F6' },
  { action: 'schedule', label: 'Schedule', emoji: '\u{1F4C5}', color: '#16A34A' },
  { action: 'park', label: 'Park', emoji: '\u{1F4A1}', color: '#F59E0B' },
  { action: 'archive', label: 'Archive', emoji: '\u{1F4D3}', color: '#9333EA' },
  { action: 'delete', label: 'Delete', emoji: '\u{1F5D1}', color: '#EF4444' },
];

/** Number of days past follow_up_date before showing a stale nudge */
const STALE_THRESHOLD_DAYS = 3;

/** Quick date options for the Schedule action */
const QUICK_DATE_OPTIONS = [
  {
    label: 'Tomorrow',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: 'In 3 Days',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d;
    },
  },
  {
    label: 'Next Week',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    },
  },
  {
    label: 'In 2 Weeks',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d;
    },
  },
];

// ============ CELEBRATION OVERLAY ============

/**
 * The celebration that pops up when an action is taken.
 * Each action has a different celebration.
 */
const CELEBRATIONS: Record<TriageAction, { content: string; isImage: boolean; imageKey?: string }> = {
  do_today: { content: '\u{1FAF6}', isImage: false },      // 🫶 heart hands
  schedule: { content: '\u{1FAF6}', isImage: false },       // 🫶 heart hands
  park: { content: 'depositIdea', isImage: true, imageKey: 'depositIdea' },
  archive: { content: 'reflection', isImage: true, imageKey: 'reflection' },
  delete: { content: 'Get Out of Here!', isImage: false },
};

function CelebrationOverlay({
  action,
  visible,
  onFinished,
}: {
  action: TriageAction | null;
  visible: boolean;
  onFinished: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && action) {
      // Reset
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);

      Animated.sequence([
        // Pop in
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        // Hold
        Animated.delay(800),
        // Fade out
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinished();
      });
    }
  }, [visible, action]);

  if (!visible || !action) return null;

  const celebration = CELEBRATIONS[action];

  return (
    <Animated.View
      style={[
        styles.celebrationOverlay,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      {celebration.isImage && celebration.imageKey ? (
        <Image
          source={SOURCE_ICONS[celebration.imageKey]}
          style={styles.celebrationImage}
          resizeMode="contain"
        />
      ) : action === 'delete' ? (
        <Text style={styles.celebrationText}>{celebration.content}</Text>
      ) : (
        <Text style={styles.celebrationEmoji}>{celebration.content}</Text>
      )}
    </Animated.View>
  );
}

// ============ STALE NUDGE BANNER ============

function StaleNudgeBanner({
  daysPastDue,
  colors,
}: {
  daysPastDue: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.staleBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
      <Text style={styles.staleBannerIcon}>{'\u26A0\uFE0F'}</Text>
      <Text style={[styles.staleBannerText, { color: '#92400E' }]}>
        This item is {daysPastDue} day{daysPastDue !== 1 ? 's' : ''} past its follow-up date.
        Consider parking, archiving, or deleting to clear your head.
      </Text>
    </View>
  );
}

// ============ SINGLE TRIAGE CARD ============

function TriageCard({
  item,
  userId,
  colors,
  isDarkMode,
  onProcessed,
}: {
  item: BrainDumpTriageItem;
  userId: string;
  colors: ReturnType<typeof useTheme>['colors'];
  isDarkMode: boolean;
  onProcessed: (itemId: string) => void;
}) {
  const [selectedAction, setSelectedAction] = useState<TriageAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationAction, setCelebrationAction] = useState<TriageAction | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });

  // Slide-out animation
  const slideAnim = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;

  // Determine source icon key
  const getIconKey = (): string => {
    if (item.source === 'brain_dump') return 'brain_dump';
    // For follow-ups, use the parent_type
    if (item.parent_type) return item.parent_type;
    return 'reflection';
  };

  const iconKey = getIconKey();
  const iconSource = SOURCE_ICONS[iconKey] || SOURCE_ICONS.reflection;
  const iconColor = SOURCE_COLORS[iconKey] || SOURCE_COLORS.reflection;

  // Calculate days past follow_up_date
  const daysPastDue = (() => {
    if (!item.follow_up_date) return 0;
    const followUpDate = new Date(item.follow_up_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    followUpDate.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - followUpDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  })();

  const isStale = daysPastDue >= STALE_THRESHOLD_DAYS;

  const handleActionSelect = (action: TriageAction) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (action === 'schedule') {
      // Toggle schedule picker
      if (selectedAction === 'schedule') {
        setSelectedAction(null);
        setShowSchedulePicker(false);
      } else {
        setSelectedAction('schedule');
        setShowSchedulePicker(true);
      }
      return;
    }

    // Single-select: tap same = deselect, tap different = select
    if (selectedAction === action) {
      setSelectedAction(null);
    } else {
      setSelectedAction(action);
      setShowSchedulePicker(false);
      // Auto-execute non-schedule actions immediately
      executeAction(action);
    }
  };

  const handleScheduleConfirm = () => {
    setShowSchedulePicker(false);
    executeAction('schedule');
  };

  const executeAction = async (action: TriageAction) => {
    if (processing) return;
    setProcessing(true);

    try {
      const options: { scheduleDate?: string; scheduleTime?: string } = {};
      if (action === 'schedule') {
        options.scheduleDate = toLocalISOString(scheduleDate).split('T')[0];
      }

      await triageBrainDumpItem(item, action, userId, options);

      // Trigger celebration
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCelebrationAction(action);
      setShowCelebration(true);
    } catch (error) {
      console.error('Error processing triage item:', error);
      setProcessing(false);
      setSelectedAction(null);
    }
  };

  const handleCelebrationFinished = () => {
    setShowCelebration(false);

    // Animate the card out
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      onProcessed(item.id);
    });
  };

  const animatedStyle = {
    opacity: slideAnim,
    transform: [
      {
        translateX: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-400, 0],
        }),
      },
    ],
  };

  const animatedHeight = {
    maxHeight: heightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 500],
    }),
    overflow: 'hidden' as const,
    marginBottom: heightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 16],
    }),
  };

  return (
    <Animated.View style={animatedHeight}>
      <Animated.View style={animatedStyle}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
              borderColor: isStale ? '#F59E0B' : colors.border,
              borderWidth: isStale ? 2 : 1,
            },
          ]}
        >
          {/* Stale nudge */}
          {isStale && <StaleNudgeBanner daysPastDue={daysPastDue} colors={colors} />}

          {/* Card header with source icon + content */}
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
              <Image source={iconSource} style={styles.sourceIcon} resizeMode="contain" />
            </View>
            <View style={styles.contentContainer}>
              <Text style={[styles.itemContent, { color: colors.text }]} numberOfLines={3}>
                {item.content}
              </Text>
              {item.follow_up_date && (
                <Text style={[styles.followUpDate, { color: colors.textSecondary }]}>
                  {'\u{1F4C5}'} Follow-up: {item.follow_up_date}
                </Text>
              )}
            </View>
          </View>

          {/* Action buttons - single-select per item */}
          <View style={styles.actionsRow}>
            {ACTION_OPTIONS.map((option) => {
              const isSelected = selectedAction === option.action;

              return (
                <TouchableOpacity
                  key={option.action}
                  style={[
                    styles.actionButton,
                    isSelected
                      ? { backgroundColor: option.color, borderColor: option.color }
                      : {
                          backgroundColor: isDarkMode ? colors.surface : '#F9FAFB',
                          borderColor: colors.border,
                        },
                  ]}
                  onPress={() => handleActionSelect(option.action)}
                  activeOpacity={0.7}
                  disabled={processing}
                >
                  <Text style={styles.actionEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Schedule quick-pick dates */}
          {showSchedulePicker && (
            <View style={[styles.schedulePickerContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.schedulePickerLabel, { color: colors.text }]}>
                {'\u{1F4C5}'} When?
              </Text>
              <View style={styles.quickDateRow}>
                {QUICK_DATE_OPTIONS.map((opt) => {
                  const isSelected = scheduleDate.toDateString() === opt.getDate().toDateString();
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.quickDateBtn,
                        isSelected
                          ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                          : { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB', borderColor: colors.border },
                      ]}
                      onPress={() => setScheduleDate(opt.getDate())}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickDateLabel,
                          { color: isSelected ? '#FFF' : colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.scheduleConfirmBtn, { backgroundColor: '#16A34A' }]}
                onPress={handleScheduleConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.scheduleConfirmText}>
                  Schedule for {scheduleDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Celebration overlay positioned inside the card */}
          <CelebrationOverlay
            action={celebrationAction}
            visible={showCelebration}
            onFinished={handleCelebrationFinished}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ============ MAIN COMPONENT ============

export default function BrainDumpTriageStep({
  items,
  userId,
  onItemProcessed,
  onAllProcessed,
}: BrainDumpTriageStepProps) {
  const { colors, isDarkMode } = useTheme();
  const [remainingItems, setRemainingItems] = useState<BrainDumpTriageItem[]>(items);

  // Sync from parent if items change
  useEffect(() => {
    setRemainingItems(items);
  }, [items]);

  const handleItemProcessed = useCallback(
    (itemId: string) => {
      setRemainingItems((prev) => {
        const next = prev.filter((i) => i.id !== itemId);
        if (next.length === 0) {
          // Small delay so the last card animates out
          setTimeout(() => onAllProcessed(), 200);
        }
        return next;
      });
      onItemProcessed(itemId);
    },
    [onItemProcessed, onAllProcessed],
  );

  // Determine header text based on item sources
  const hasBrainDumps = remainingItems.some((i) => i.source === 'brain_dump');
  const hasFollowUps = remainingItems.some((i) => i.source === 'follow_up');

  const headerText = hasBrainDumps && hasFollowUps
    ? 'Yesterday\u2019s thoughts & follow-ups'
    : hasBrainDumps
      ? 'Based on yesterday\u2019s thoughts...'
      : 'Follow-up items';

  const headerEmoji = hasBrainDumps ? '\u{1F9E0}' : '\u{1F4C5}';

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: '#ECFDF5' }]}>
        <Text style={styles.emptyIcon}>{'\u2705'}</Text>
        <Text style={[styles.emptyTitle, { color: '#065F46' }]}>
          Your mind is clear!
        </Text>
        <Text style={[styles.emptySubtext, { color: '#047857' }]}>
          Nothing to triage.
        </Text>
      </View>
    );
  }

  if (remainingItems.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: '#ECFDF5' }]}>
        <Text style={styles.emptyIcon}>{'\u{1F389}'}</Text>
        <Text style={[styles.emptyTitle, { color: '#065F46' }]}>
          All done!
        </Text>
        <Text style={[styles.emptySubtext, { color: '#047857' }]}>
          Every item has been processed.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.header, { color: colors.text }]}>
        {headerEmoji} {headerText}
      </Text>
      <Text style={[styles.subtext, { color: colors.textSecondary }]}>
        {remainingItems.length} item{remainingItems.length !== 1 ? 's' : ''} remaining
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {remainingItems.map((item) => (
          <TriageCard
            key={item.id}
            item={item}
            userId={userId}
            colors={colors}
            isDarkMode={isDarkMode}
            onProcessed={handleItemProcessed}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 14,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ---- Card ----
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIcon: {
    width: 24,
    height: 24,
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  itemContent: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  followUpDate: {
    fontSize: 12,
    marginTop: 2,
  },

  // ---- Stale nudge ----
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  staleBannerIcon: {
    fontSize: 16,
  },
  staleBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  // ---- Actions ----
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 5,
  },
  actionEmoji: {
    fontSize: 14,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ---- Schedule picker ----
  schedulePickerContainer: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  schedulePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickDateBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickDateLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleConfirmBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scheduleConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ---- Celebration ----
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    zIndex: 10,
  },
  celebrationEmoji: {
    fontSize: 72,
  },
  celebrationText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#EF4444',
    textAlign: 'center',
  },
  celebrationImage: {
    width: 80,
    height: 80,
  },

  // ---- Empty ----
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    padding: 32,
    margin: 16,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '500',
  },
});
