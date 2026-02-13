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
  Modal,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
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

const SOURCE_ICONS: Record<string, any> = {
  task: require('@/assets/images/task-list.png'),
  event: require('@/assets/images/calendar.png'),
  rose: require('@/assets/images/rose-81.png'),
  thorn: require('@/assets/images/thorn-81.png'),
  depositIdea: require('@/assets/images/deposit-idea.png'),
  reflection: require('@/assets/images/reflections-72.png'),
  brain_dump: require('@/assets/images/reflections-72.png'),
  goal_12wk: require('@/assets/images/task-list.png'),
  goal_1y: require('@/assets/images/task-list.png'),
  goal_custom: require('@/assets/images/task-list.png'),
};

const SOURCE_COLORS: Record<string, string> = {
  task: '#3b82f6',
  event: '#22c55e',
  rose: '#ec4899',
  thorn: '#ef4444',
  depositIdea: '#f59e0b',
  reflection: '#9333ea',
  brain_dump: '#8B5CF6',
  goal_12wk: '#3b82f6',
  goal_1y: '#3b82f6',
  goal_custom: '#3b82f6',
};

const ACTION_OPTIONS: ActionOption[] = [
  { action: 'do_today', label: 'Do Today', emoji: '\u{1F4AA}', color: '#3B82F6' },
  { action: 'schedule', label: 'Schedule', emoji: '\u{1F4C5}', color: '#16A34A' },
  { action: 'park', label: 'Park', emoji: '\u{1F4A1}', color: '#F59E0B' },
  { action: 'archive', label: 'Archive', emoji: '\u{1F4D3}', color: '#9333EA' },
  { action: 'delete', label: 'Delete', emoji: '\u{1F5D1}', color: '#EF4444' },
];

const STALE_THRESHOLD_DAYS = 3;

/** Duration options in minutes */
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Build quick date options with formatted labels */
function getQuickDateOptions(): { label: string; date: Date }[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const twoDays = new Date();
  twoDays.setDate(twoDays.getDate() + 2);

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return [
    { label: `Tomorrow - ${fmt(tomorrow)}`, date: tomorrow },
    { label: `2 Days - ${fmt(twoDays)}`, date: twoDays },
  ];
}

/** Get default start time: current time rounded up to next 15-min */
function getDefaultStartTime(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedUp = Math.ceil((minutes + 15) / 15) * 15;
  now.setMinutes(roundedUp, 0, 0);
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Generate time options in 15-minute intervals */
function getTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ============ CELEBRATION OVERLAY ============

const CELEBRATIONS: Record<TriageAction, { content: string; isImage: boolean; imageKey?: string }> = {
  do_today: { content: '\u{1FAF6}', isImage: false },
  schedule: { content: '\u{1FAF6}', isImage: false },
  park: { content: 'depositIdea', isImage: true, imageKey: 'depositIdea' },
  archive: { content: 'reflection', isImage: true, imageKey: 'reflection' },
  delete: { content: 'Get Out of Here!', isImage: false },
};

const CONFETTI_COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#FFA07A', '#87CEEB'];

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
        position: 'absolute', left: startX, bottom: '40%',
        width: 8, height: 8, borderRadius: 2, backgroundColor: color,
        opacity, transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
      pointerEvents="none"
    />
  );
}

function CelebrationOverlay({ action, visible, onFinished }: {
  action: TriageAction | null; visible: boolean; onFinished: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(30)).current;
  const [confettiPieces] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 200, startX: 30 + Math.random() * 140,
    }))
  );

  useEffect(() => {
    if (visible && action) {
      scaleAnim.setValue(0); opacityAnim.setValue(0); riseAnim.setValue(30);
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
  }, [visible, action]);

  if (!visible || !action) return null;
  const celebration = CELEBRATIONS[action];

  return (
    <Animated.View style={[styles.celebrationOverlay, { opacity: opacityAnim }]} pointerEvents="none">
      {confettiPieces.map((p) => <ConfettiParticle key={p.id} delay={p.delay} color={p.color} startX={p.startX} />)}
      <Animated.View style={{ transform: [{ scale: scaleAnim }, { translateY: riseAnim }] }}>
        {celebration.isImage && celebration.imageKey ? (
          <Image source={SOURCE_ICONS[celebration.imageKey]} style={styles.celebrationImage} resizeMode="contain" />
        ) : action === 'delete' ? (
          <Text style={styles.celebrationText}>{celebration.content}</Text>
        ) : (
          <Text style={styles.celebrationEmoji}>{celebration.content}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ============ ITEM DETAIL POPUP ============

function ItemDetailPopup({
  item,
  visible,
  userId,
  colors,
  isDarkMode,
  onClose,
  onProcessed,
}: {
  item: BrainDumpTriageItem | null;
  visible: boolean;
  userId: string;
  colors: ReturnType<typeof useTheme>['colors'];
  isDarkMode: boolean;
  onClose: () => void;
  onProcessed: (itemId: string) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationAction, setCelebrationAction] = useState<TriageAction | null>(null);

  // Schedule state
  const quickDates = getQuickDateOptions();
  const [selectedDateOption, setSelectedDateOption] = useState<'tomorrow' | '2days' | 'other'>('tomorrow');
  const [customDate, setCustomDate] = useState('');
  const [startTime, setStartTime] = useState(getDefaultStartTime);
  const [duration, setDuration] = useState(30);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const scheduleDate = selectedDateOption === 'tomorrow'
    ? quickDates[0].date
    : selectedDateOption === '2days'
      ? quickDates[1].date
      : customDate ? new Date(customDate) : quickDates[0].date;

  if (!item || !visible) return null;

  const iconKey = item.iconType || 'reflection';
  const iconSource = SOURCE_ICONS[iconKey] || SOURCE_ICONS.reflection;
  const iconColor = SOURCE_COLORS[iconKey] || SOURCE_COLORS.reflection;

  // Stale calculation
  const daysPastDue = (() => {
    if (!item.follow_up_date) return 0;
    const fDate = new Date(item.follow_up_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); fDate.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - fDate.getTime()) / (1000 * 60 * 60 * 24));
  })();
  const isStale = daysPastDue >= STALE_THRESHOLD_DAYS;

  const handleAction = async (action: TriageAction) => {
    if (action === 'schedule') {
      setShowSchedule(true);
      return;
    }
    await executeAction(action);
  };

  const handleScheduleConfirm = () => {
    executeAction('schedule');
  };

  const executeAction = async (action: TriageAction) => {
    if (processing) return;
    setProcessing(true);

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const options: { scheduleDate?: string; scheduleTime?: string; durationMinutes?: number } = {};
      if (action === 'schedule') {
        options.scheduleDate = toLocalISOString(scheduleDate).split('T')[0];
        options.scheduleTime = startTime;
        options.durationMinutes = duration;
      }

      await triageBrainDumpItem(item, action, userId, options);

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCelebrationAction(action);
      setShowCelebration(true);
    } catch (error) {
      console.error('Error processing triage item:', error);
      setProcessing(false);
    }
  };

  const handleCelebrationDone = () => {
    setShowCelebration(false);
    setProcessing(false);
    setShowSchedule(false);
    onClose();
    onProcessed(item.id);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.popupBackdrop}>
        <View style={[styles.popupContainer, { backgroundColor: isDarkMode ? colors.surface : '#FFFFFF' }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.popupClose} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Celebration overlay */}
          {showCelebration && (
            <CelebrationOverlay action={celebrationAction} visible={showCelebration} onFinished={handleCelebrationDone} />
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.popupScroll}>
            {/* Icon + Title */}
            <View style={styles.popupHeader}>
              <View style={[styles.popupIconBox, { backgroundColor: iconColor + '20' }]}>
                <Image source={iconSource} style={styles.popupIcon} resizeMode="contain" />
              </View>
              <Text style={[styles.popupTitle, { color: colors.text }]}>{item.title}</Text>
            </View>

            {/* Stale nudge */}
            {isStale && (
              <View style={[styles.staleBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <Text style={styles.staleBannerIcon}>{'\u26A0\uFE0F'}</Text>
                <Text style={[styles.staleBannerText, { color: '#92400E' }]}>
                  {daysPastDue} day{daysPastDue !== 1 ? 's' : ''} past follow-up. Consider parking, archiving, or deleting.
                </Text>
              </View>
            )}

            {/* Follow-up date */}
            {item.follow_up_date && (
              <Text style={[styles.popupMeta, { color: colors.textSecondary }]}>
                {'\u{1F4C5}'} Follow-up: {item.follow_up_date}
              </Text>
            )}

            {/* Body / content */}
            {item.body && (
              <View style={[styles.popupBodyBox, { backgroundColor: isDarkMode ? colors.background : '#F9FAFB', borderColor: colors.border }]}>
                <Text style={[styles.popupBody, { color: colors.text }]}>{item.body}</Text>
              </View>
            )}

            {/* Schedule section (shown when Schedule is tapped) */}
            {showSchedule ? (
              <View style={styles.scheduleSection}>
                <Text style={[styles.scheduleSectionTitle, { color: colors.text }]}>
                  {'\u{1F4C5}'} Schedule
                </Text>

                {/* Date options */}
                <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>Date</Text>
                <View style={styles.scheduleDateOptions}>
                  {quickDates.map((opt, idx) => {
                    const key = idx === 0 ? 'tomorrow' : '2days';
                    const isSelected = selectedDateOption === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.scheduleDateBtn, isSelected
                          ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                          : { backgroundColor: isDarkMode ? colors.background : '#F9FAFB', borderColor: colors.border }]}
                        onPress={() => setSelectedDateOption(key as any)}
                      >
                        <Text style={[styles.scheduleDateBtnText, { color: isSelected ? '#FFF' : colors.text }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.scheduleDateBtn, selectedDateOption === 'other'
                      ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                      : { backgroundColor: isDarkMode ? colors.background : '#F9FAFB', borderColor: colors.border }]}
                    onPress={() => setSelectedDateOption('other')}
                  >
                    <Text style={[styles.scheduleDateBtnText, { color: selectedDateOption === 'other' ? '#FFF' : colors.text }]}>
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom date picker (simple date input for "Other") */}
                {selectedDateOption === 'other' && (
                  <View style={styles.otherDateContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {Array.from({ length: 14 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() + i + 3); // Start 3 days out (1 and 2 are already quick options)
                        const dateStr = toLocalISOString(d).split('T')[0];
                        const isSelected = customDate === dateStr;
                        return (
                          <TouchableOpacity
                            key={dateStr}
                            style={[styles.otherDateBtn, isSelected
                              ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                              : { backgroundColor: isDarkMode ? colors.background : '#F9FAFB', borderColor: colors.border }]}
                            onPress={() => setCustomDate(dateStr)}
                          >
                            <Text style={[styles.otherDateDay, { color: isSelected ? '#FFF' : colors.text }]}>
                              {d.toLocaleDateString(undefined, { weekday: 'short' })}
                            </Text>
                            <Text style={[styles.otherDateNum, { color: isSelected ? '#FFF' : colors.text }]}>
                              {d.getDate()}
                            </Text>
                            <Text style={[styles.otherDateMonth, { color: isSelected ? '#E5FFE5' : colors.textSecondary }]}>
                              {d.toLocaleDateString(undefined, { month: 'short' })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Start Time */}
                <Text style={[styles.scheduleLabel, { color: colors.textSecondary, marginTop: 12 }]}>Start Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                  {getTimeOptions().map((t) => {
                    const isSelected = startTime === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.timeBtn, isSelected
                          ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                          : { backgroundColor: isDarkMode ? colors.background : '#F9FAFB', borderColor: colors.border }]}
                        onPress={() => setStartTime(t)}
                      >
                        <Text style={[styles.timeBtnText, { color: isSelected ? '#FFF' : colors.text }]}>
                          {formatTime(t)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Duration */}
                <Text style={[styles.scheduleLabel, { color: colors.textSecondary, marginTop: 12 }]}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => {
                    const isSelected = duration === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.durationBtn, isSelected
                          ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                          : { backgroundColor: isDarkMode ? colors.background : '#F9FAFB', borderColor: colors.border }]}
                        onPress={() => setDuration(d)}
                      >
                        <Text style={[styles.durationBtnText, { color: isSelected ? '#FFF' : colors.text }]}>
                          {formatDuration(d)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Schedule confirm button */}
                <TouchableOpacity
                  style={[styles.scheduleGoBtn, { backgroundColor: '#16A34A', opacity: processing ? 0.5 : 1 }]}
                  onPress={handleScheduleConfirm}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  <Text style={styles.scheduleGoBtnText}>
                    {'\u{1F4C5}'} Schedule It
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Action buttons grid */
              <View style={styles.popupActions}>
                {ACTION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.action}
                    style={[styles.popupActionBtn, { backgroundColor: opt.color, opacity: processing ? 0.5 : 1 }]}
                    onPress={() => handleAction(opt.action)}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.popupActionEmoji}>{opt.emoji}</Text>
                    <Text style={styles.popupActionLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Back from schedule */}
            {showSchedule && (
              <TouchableOpacity
                style={styles.scheduleBackBtn}
                onPress={() => setShowSchedule(false)}
              >
                <Text style={[styles.scheduleBackText, { color: colors.textSecondary }]}>
                  {'\u2190'} Back to actions
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============ COMPACT LIST CARD ============

function CompactCard({
  item,
  colors,
  isDarkMode,
  onTap,
}: {
  item: BrainDumpTriageItem;
  colors: ReturnType<typeof useTheme>['colors'];
  isDarkMode: boolean;
  onTap: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;

  const iconKey = item.iconType || 'reflection';
  const iconSource = SOURCE_ICONS[iconKey] || SOURCE_ICONS.reflection;
  const iconColor = SOURCE_COLORS[iconKey] || SOURCE_COLORS.reflection;

  const daysPastDue = (() => {
    if (!item.follow_up_date) return 0;
    const fDate = new Date(item.follow_up_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); fDate.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - fDate.getTime()) / (1000 * 60 * 60 * 24));
  })();
  const isStale = daysPastDue >= STALE_THRESHOLD_DAYS;

  return (
    <TouchableOpacity
      onPress={onTap}
      activeOpacity={0.7}
      style={[
        styles.compactCard,
        {
          backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
          borderColor: isStale ? '#F59E0B' : colors.border,
          borderWidth: isStale ? 2 : 1,
        },
      ]}
    >
      <View style={[styles.compactIconBox, { backgroundColor: iconColor + '20' }]}>
        <Image source={iconSource} style={styles.compactIcon} resizeMode="contain" />
      </View>
      <View style={styles.compactContent}>
        <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.follow_up_date && (
          <Text style={[styles.compactDate, { color: isStale ? '#D97706' : colors.textSecondary }]}>
            {isStale ? `\u26A0\uFE0F ${daysPastDue}d overdue` : `\u{1F4C5} ${item.follow_up_date}`}
          </Text>
        )}
      </View>
      <Text style={[styles.compactChevron, { color: colors.textSecondary }]}>{'\u203A'}</Text>
    </TouchableOpacity>
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

  const processedIdsRef = useRef<Set<string>>(new Set());
  const [processedCount, setProcessedCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<BrainDumpTriageItem | null>(null);

  const remainingItems = items.filter((i) => !processedIdsRef.current.has(i.id));

  const handleItemProcessed = useCallback(
    (itemId: string) => {
      processedIdsRef.current.add(itemId);
      setProcessedCount((c) => c + 1);
      onItemProcessed(itemId);

      const stillRemaining = items.filter((i) => !processedIdsRef.current.has(i.id));
      if (stillRemaining.length === 0) {
        setTimeout(() => onAllProcessed(), 300);
      }
    },
    [items, onItemProcessed, onAllProcessed],
  );

  const hasBrainDumps = remainingItems.some((i) => i.source === 'brain_dump');
  const hasFollowUps = remainingItems.some((i) => i.source === 'follow_up');
  const headerText = hasBrainDumps && hasFollowUps
    ? 'Yesterday\u2019s thoughts & follow-ups'
    : hasBrainDumps ? 'Based on yesterday\u2019s thoughts...' : 'Follow-up items';
  const headerEmoji = hasBrainDumps ? '\u{1F9E0}' : '\u{1F4C5}';

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: '#ECFDF5' }]}>
        <Text style={styles.emptyIcon}>{'\u2705'}</Text>
        <Text style={[styles.emptyTitle, { color: '#065F46' }]}>Your mind is clear!</Text>
        <Text style={[styles.emptySubtext, { color: '#047857' }]}>Nothing to triage.</Text>
      </View>
    );
  }

  if (remainingItems.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: '#ECFDF5' }]}>
        <Text style={styles.emptyIcon}>{'\u{1F389}'}</Text>
        <Text style={[styles.emptyTitle, { color: '#065F46' }]}>All done!</Text>
        <Text style={[styles.emptySubtext, { color: '#047857' }]}>Every item has been processed.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.header, { color: colors.text }]}>{headerEmoji} {headerText}</Text>
      <Text style={[styles.subtext, { color: colors.textSecondary }]}>
        {remainingItems.length} item{remainingItems.length !== 1 ? 's' : ''} remaining — tap to action
      </Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {remainingItems.map((item) => (
          <CompactCard
            key={item.id}
            item={item}
            colors={colors}
            isDarkMode={isDarkMode}
            onTap={() => setSelectedItem(item)}
          />
        ))}
      </ScrollView>

      {/* Detail popup */}
      <ItemDetailPopup
        item={selectedItem}
        visible={selectedItem !== null}
        userId={userId}
        colors={colors}
        isDarkMode={isDarkMode}
        onClose={() => setSelectedItem(null)}
        onProcessed={handleItemProcessed}
      />
    </View>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  wrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtext: { fontSize: 14, marginBottom: 16 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: 10 },

  // ---- Compact card ----
  compactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  compactIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  compactIcon: { width: 22, height: 22 },
  compactContent: { flex: 1, gap: 2 },
  compactTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  compactDate: { fontSize: 12 },
  compactChevron: { fontSize: 24, fontWeight: '300' },

  // ---- Popup ----
  popupBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  popupContainer: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40,
    paddingHorizontal: 20, maxHeight: Dimensions.get('window').height * 0.85,
    position: 'relative', overflow: 'hidden',
  },
  popupClose: { position: 'absolute', top: 16, right: 16, zIndex: 20, padding: 4 },
  popupScroll: { paddingTop: 8, paddingBottom: 20 },
  popupHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, paddingRight: 30 },
  popupIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  popupIcon: { width: 28, height: 28 },
  popupTitle: { fontSize: 18, fontWeight: '700', flex: 1, lineHeight: 24 },
  popupMeta: { fontSize: 13, marginBottom: 8 },
  popupBodyBox: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 16 },
  popupBody: { fontSize: 14, lineHeight: 22 },

  // ---- Stale nudge ----
  staleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 10,
  },
  staleBannerIcon: { fontSize: 16 },
  staleBannerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500' },

  // ---- Popup action buttons ----
  popupActions: { gap: 10, marginTop: 8 },
  popupActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  popupActionEmoji: { fontSize: 18 },
  popupActionLabel: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // ---- Schedule section ----
  scheduleSection: { marginTop: 8 },
  scheduleSectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  scheduleLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  scheduleDateOptions: { gap: 8 },
  scheduleDateBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  scheduleDateBtnText: { fontSize: 15, fontWeight: '600' },
  otherDateContainer: { marginTop: 8 },
  otherDateBtn: {
    borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12,
    alignItems: 'center', marginRight: 8, minWidth: 60,
  },
  otherDateDay: { fontSize: 11, fontWeight: '600' },
  otherDateNum: { fontSize: 18, fontWeight: '700' },
  otherDateMonth: { fontSize: 11 },
  timeScroll: { marginBottom: 4 },
  timeBtn: { borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, marginRight: 6 },
  timeBtnText: { fontSize: 13, fontWeight: '600' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationBtn: { borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
  durationBtnText: { fontSize: 13, fontWeight: '600' },
  scheduleGoBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  scheduleGoBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  scheduleBackBtn: { alignItems: 'center', paddingVertical: 12 },
  scheduleBackText: { fontSize: 14, fontWeight: '500' },

  // ---- Celebration ----
  celebrationOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 20, zIndex: 30,
  },
  celebrationEmoji: { fontSize: 72 },
  celebrationText: { fontSize: 28, fontWeight: '800', color: '#EF4444', textAlign: 'center' },
  celebrationImage: { width: 80, height: 80 },

  // ---- Empty ----
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 16, padding: 32, margin: 16, gap: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtext: { fontSize: 15, fontWeight: '500' },
});
