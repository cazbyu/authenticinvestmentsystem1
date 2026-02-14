import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { BrainDumpTriageItem, TriageAction } from '@/lib/morningSparkV2Service';
import { triageBrainDumpItem } from '@/lib/morningSparkV2Service';
import { toLocalISOString } from '@/lib/dateUtils';
import { CoachInsight } from './CoachInsight';
import type { CoachTone } from '@/types/alignmentCoach';

// ============ TYPES ============

interface BrainDumpTriageStepProps {
  items: BrainDumpTriageItem[];
  userId: string;
  onItemProcessed: (itemId: string) => void;
  onAllProcessed: () => void;
  /** Alignment coach message (from morning guidance call) */
  coachMessage?: string | null;
  /** Coach message tone */
  coachTone?: CoachTone;
  /** Coach is still loading */
  coachLoading?: boolean;
  /** Coach message is from local fallback */
  coachIsFallback?: boolean;
}

// ============ LIFE OS COLOR PALETTE (semi-muted, 70-80% saturation) ============

const PALETTE = {
  skyBlue: '#5B9BD5',        // Do Today — soft sky blue
  skyBlueBg: '#EBF3FB',      // light bg
  skyBlueBorder: '#B8D4EE',  // subtle inner border
  emerald: '#3DA87A',        // Schedule — emerald green
  emeraldBg: '#E8F6EF',
  emeraldBorder: '#A8D9BF',
  amber: '#D4924A',          // Park — warm amber
  amberBg: '#FDF3E7',
  amberBorder: '#E6C99B',
  muted: '#8B7EB8',          // Archive — muted lavender
  mutedBg: '#F0ECF6',
  mutedBorder: '#C5BDD9',
  coral: '#C7605B',          // Delete — muted coral
  coralBg: '#FAE9E8',
  coralBorder: '#E0ACA9',
  charcoal: '#2D3748',       // Text on light buttons
  charcoalSoft: '#4A5568',
  selectedGreen: '#3DA87A',  // Schedule picker selected state
  selectedGreenBg: '#3DA87A',
};

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
  task: '#5B9BD5',
  event: '#3DA87A',
  rose: '#D4769A',
  thorn: '#C7605B',
  depositIdea: '#D4924A',
  reflection: '#8B7EB8',
  brain_dump: '#8B7EB8',
  goal_12wk: '#5B9BD5',
  goal_1y: '#5B9BD5',
  goal_custom: '#5B9BD5',
};

const STALE_THRESHOLD_DAYS = 3;

/** Duration options in minutes */
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Get default start time: current time rounded up to next 15-min */
function getDefaultStartTime(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedUp = Math.ceil((minutes + 15) / 15) * 15;
  now.setMinutes(roundedUp, 0, 0);
  if (now.getHours() >= 24) {
    // Wrapped past midnight — set to 00:00
    return '00:00';
  }
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

/** Get the index of the default start time in the time options */
function getDefaultTimeIndex(): number {
  const defaultTime = getDefaultStartTime();
  const options = getTimeOptions();
  const idx = options.indexOf(defaultTime);
  return idx >= 0 ? idx : 0;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Generate 30 days of date options starting from tomorrow */
function getDateOptions(): { date: Date; dateStr: string; dayLabel: string; dayNum: number; monthLabel: string; isTomorrow: boolean }[] {
  const options = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    options.push({
      date: d,
      dateStr: toLocalISOString(d).split('T')[0],
      dayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString(undefined, { month: 'short' }),
      isTomorrow: i === 1,
    });
  }
  return options;
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

// ============ ARROW SCROLL WRAPPER ============

/** Horizontal scroll with left/right arrow buttons */
function ArrowScrollView({
  children,
  scrollRef,
  colors,
  isDarkMode,
  itemWidth,
  initialScrollIndex,
}: {
  children: React.ReactNode;
  scrollRef?: React.RefObject<ScrollView>;
  colors: any;
  isDarkMode: boolean;
  itemWidth: number;
  initialScrollIndex?: number;
}) {
  const internalRef = useRef<ScrollView>(null);
  const ref = scrollRef || internalRef;
  const scrollX = useRef(0);
  const maxScroll = useRef(0);

  useEffect(() => {
    if (initialScrollIndex && initialScrollIndex > 0) {
      setTimeout(() => {
        ref.current?.scrollTo({ x: initialScrollIndex * itemWidth - 20, animated: false });
      }, 50);
    }
  }, [initialScrollIndex, itemWidth]);

  const scrollLeft = () => {
    const newX = Math.max(0, scrollX.current - itemWidth * 3);
    ref.current?.scrollTo({ x: newX, animated: true });
  };

  const scrollRight = () => {
    const newX = scrollX.current + itemWidth * 3;
    ref.current?.scrollTo({ x: newX, animated: true });
  };

  return (
    <View style={styles.arrowScrollContainer}>
      <TouchableOpacity onPress={scrollLeft} style={styles.arrowBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <ChevronLeft size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.arrowScrollInner}
        onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
      <TouchableOpacity onPress={scrollRight} style={styles.arrowBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <ChevronRight size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
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
  const dateOptions = useMemo(() => getDateOptions(), []);
  const [selectedDateStr, setSelectedDateStr] = useState(() => dateOptions[0]?.dateStr || '');
  const [startTime, setStartTime] = useState(getDefaultStartTime);
  const [duration, setDuration] = useState(30);

  const timeOptions = useMemo(() => getTimeOptions(), []);
  const defaultTimeIdx = useMemo(() => getDefaultTimeIndex(), []);

  const scheduleDate = dateOptions.find(d => d.dateStr === selectedDateStr)?.date || dateOptions[0]?.date || new Date();

  // Reset schedule state when popup opens for a new item
  useEffect(() => {
    if (visible && item) {
      setShowSchedule(false);
      setProcessing(false);
      setShowCelebration(false);
      setCelebrationAction(null);
      setSelectedDateStr(dateOptions[0]?.dateStr || '');
      setStartTime(getDefaultStartTime());
      setDuration(30);
    }
  }, [visible, item?.id]);

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

            {/* Compact stale nudge */}
            {isStale && (
              <View style={[styles.staleBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <Text style={styles.staleBannerText}>
                  {'\u26A0\uFE0F'} {daysPastDue}d overdue — park, archive, or delete?
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

                {/* Date picker with arrows — tomorrow highlighted */}
                <Text style={[styles.scheduleLabel, { color: PALETTE.charcoalSoft }]}>Date</Text>
                <ArrowScrollView colors={colors} isDarkMode={isDarkMode} itemWidth={68} initialScrollIndex={0}>
                  {dateOptions.map((opt) => {
                    const isSelected = selectedDateStr === opt.dateStr;
                    return (
                      <TouchableOpacity
                        key={opt.dateStr}
                        style={[
                          styles.datePill,
                          isSelected
                            ? { backgroundColor: PALETTE.selectedGreenBg, borderColor: PALETTE.selectedGreenBg }
                            : { backgroundColor: isDarkMode ? colors.background : '#F7F8FA', borderColor: isDarkMode ? colors.border : '#E2E6EA' },
                        ]}
                        onPress={() => setSelectedDateStr(opt.dateStr)}
                      >
                        <Text style={[styles.datePillDay, { color: isSelected ? '#FFF' : PALETTE.charcoalSoft }]}>
                          {opt.isTomorrow ? 'Tmrw' : opt.dayLabel}
                        </Text>
                        <Text style={[styles.datePillNum, { color: isSelected ? '#FFF' : PALETTE.charcoal }]}>
                          {opt.dayNum}
                        </Text>
                        <Text style={[styles.datePillMonth, { color: isSelected ? '#E5FFE5' : colors.textSecondary }]}>
                          {opt.monthLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ArrowScrollView>

                {/* Start Time with arrows */}
                <Text style={[styles.scheduleLabel, { color: PALETTE.charcoalSoft, marginTop: 14 }]}>Start Time</Text>
                <ArrowScrollView colors={colors} isDarkMode={isDarkMode} itemWidth={82} initialScrollIndex={defaultTimeIdx}>
                  {timeOptions.map((t) => {
                    const isSelected = startTime === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.timePill,
                          isSelected
                            ? { backgroundColor: PALETTE.selectedGreenBg, borderColor: PALETTE.selectedGreenBg }
                            : { backgroundColor: isDarkMode ? colors.background : '#F7F8FA', borderColor: isDarkMode ? colors.border : '#E2E6EA' },
                        ]}
                        onPress={() => setStartTime(t)}
                      >
                        <Text style={[styles.timePillText, { color: isSelected ? '#FFF' : PALETTE.charcoal }]}>
                          {formatTime(t)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ArrowScrollView>

                {/* Duration */}
                <Text style={[styles.scheduleLabel, { color: PALETTE.charcoalSoft, marginTop: 14 }]}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => {
                    const isSelected = duration === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.durationBtn,
                          isSelected
                            ? { backgroundColor: PALETTE.selectedGreenBg, borderColor: PALETTE.selectedGreenBg }
                            : { backgroundColor: isDarkMode ? colors.background : '#F7F8FA', borderColor: isDarkMode ? colors.border : '#E2E6EA' },
                        ]}
                        onPress={() => setDuration(d)}
                      >
                        <Text style={[styles.durationBtnText, { color: isSelected ? '#FFF' : PALETTE.charcoal }]}>
                          {formatDuration(d)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Schedule confirm button */}
                <TouchableOpacity
                  style={[styles.scheduleGoBtn, { backgroundColor: PALETTE.emerald, opacity: processing ? 0.5 : 1 }]}
                  onPress={handleScheduleConfirm}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  <Text style={styles.scheduleGoBtnText}>
                    {'\u{1F4C5}'} Schedule It
                  </Text>
                </TouchableOpacity>

                {/* Back from schedule */}
                <TouchableOpacity
                  style={styles.scheduleBackBtn}
                  onPress={() => setShowSchedule(false)}
                >
                  <Text style={[styles.scheduleBackText, { color: colors.textSecondary }]}>
                    {'\u2190'} Back to actions
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ====== ACTION BUTTONS — 2x2 grid + Park full-width + Archive/Delete utility ====== */
              <View style={styles.actionsContainer}>
                {/* Top row: Do Today + Schedule (2x2 grid) */}
                <View style={styles.actionsTopRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionPrimaryBtn,
                      { backgroundColor: PALETTE.skyBlueBg, borderColor: PALETTE.skyBlueBorder, opacity: processing ? 0.5 : 1 },
                    ]}
                    onPress={() => handleAction('do_today')}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionPrimaryEmoji}>{'\u2600\uFE0F'}</Text>
                    <Text style={[styles.actionPrimaryLabel, { color: PALETTE.charcoal }]}>Do Today</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionPrimaryBtn,
                      { backgroundColor: PALETTE.emeraldBg, borderColor: PALETTE.emeraldBorder, opacity: processing ? 0.5 : 1 },
                    ]}
                    onPress={() => handleAction('schedule')}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionPrimaryEmoji}>{'\u{1F4C5}'}</Text>
                    <Text style={[styles.actionPrimaryLabel, { color: PALETTE.charcoal }]}>Schedule</Text>
                  </TouchableOpacity>
                </View>

                {/* Park — slim full-width */}
                <TouchableOpacity
                  style={[
                    styles.actionParkBtn,
                    { backgroundColor: PALETTE.amberBg, borderColor: PALETTE.amberBorder, opacity: processing ? 0.5 : 1 },
                  ]}
                  onPress={() => handleAction('park')}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionParkEmoji}>{'\u{1F4A1}'}</Text>
                  <Text style={[styles.actionParkLabel, { color: PALETTE.charcoal }]}>Park</Text>
                </TouchableOpacity>

                {/* Bottom: Archive + Delete as small utility buttons */}
                <View style={styles.actionsBottomRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionUtilBtn,
                      { backgroundColor: PALETTE.mutedBg, borderColor: PALETTE.mutedBorder, opacity: processing ? 0.5 : 1 },
                    ]}
                    onPress={() => handleAction('archive')}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionUtilEmoji}>{'\u{1F4D3}'}</Text>
                    <Text style={[styles.actionUtilLabel, { color: PALETTE.charcoalSoft }]}>Archive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionUtilBtn,
                      { backgroundColor: PALETTE.coralBg, borderColor: PALETTE.coralBorder, opacity: processing ? 0.5 : 1 },
                    ]}
                    onPress={() => handleAction('delete')}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionUtilEmoji}>{'\u{1F5D1}'}</Text>
                    <Text style={[styles.actionUtilLabel, { color: PALETTE.charcoalSoft }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
          borderColor: isStale ? '#D4924A' : colors.border,
          borderWidth: isStale ? 2 : 1,
        },
      ]}
    >
      <View style={[styles.compactIconBox, { backgroundColor: iconColor + '18' }]}>
        <Image source={iconSource} style={styles.compactIcon} resizeMode="contain" />
      </View>
      <View style={styles.compactContent}>
        <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.follow_up_date && (
          <Text style={[styles.compactDate, { color: isStale ? '#D4924A' : colors.textSecondary }]}>
            {isStale ? `\u26A0\uFE0F ${daysPastDue}d overdue` : `\u{1F4C5} ${item.follow_up_date}`}
          </Text>
        )}
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

// ============ MAIN COMPONENT ============

export default function BrainDumpTriageStep({
  items,
  userId,
  onItemProcessed,
  onAllProcessed,
  coachMessage,
  coachTone = 'encourage',
  coachLoading = false,
  coachIsFallback = false,
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
      <View style={styles.wrapper}>
        {/* Coach insight — explains what this step is even when empty */}
        {coachMessage && (
          <View style={styles.coachInsightWrapper}>
            <CoachInsight
              message={coachMessage}
              tone={coachTone}
              loading={false}
              isFallback={coachIsFallback}
              startCollapsed={false}
            />
          </View>
        )}
        <View style={[styles.emptyContainer, { backgroundColor: '#ECFDF5' }]}>
          <Text style={styles.emptyIcon}>{'\u2705'}</Text>
          <Text style={[styles.emptyTitle, { color: '#065F46' }]}>Your mind is clear!</Text>
          <Text style={[styles.emptySubtext, { color: '#047857' }]}>Nothing to triage.</Text>
        </View>
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
      {/* Alignment Coach insight (from morning guidance) */}
      {(coachMessage || coachLoading) && (
        <View style={styles.coachInsightWrapper}>
          <CoachInsight
            message={coachMessage ?? null}
            tone={coachTone}
            loading={coachLoading}
            isFallback={coachIsFallback}
            startCollapsed={false}
          />
        </View>
      )}

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
  coachInsightWrapper: { marginBottom: 4 },
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
  popupHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10, paddingRight: 30 },
  popupIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  popupIcon: { width: 26, height: 26 },
  popupTitle: { fontSize: 17, fontWeight: '700', flex: 1, lineHeight: 22 },
  popupMeta: { fontSize: 12, marginBottom: 6 },
  popupBodyBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  popupBody: { fontSize: 14, lineHeight: 21 },

  // ---- Stale nudge (compact) ----
  staleBanner: {
    flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, marginBottom: 8,
  },
  staleBannerText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#92400E' },

  // ---- Action buttons: 2x2 grid + Park + Archive/Delete ----
  actionsContainer: { marginTop: 10, gap: 10 },

  actionsTopRow: { flexDirection: 'row', gap: 10 },
  actionPrimaryBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, borderRadius: 12, borderWidth: 1, gap: 6,
  },
  actionPrimaryEmoji: { fontSize: 24 },
  actionPrimaryLabel: { fontSize: 15, fontWeight: '700' },

  actionParkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, gap: 8,
  },
  actionParkEmoji: { fontSize: 18 },
  actionParkLabel: { fontSize: 14, fontWeight: '700' },

  actionsBottomRow: { flexDirection: 'row', gap: 10 },
  actionUtilBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 6,
  },
  actionUtilEmoji: { fontSize: 14 },
  actionUtilLabel: { fontSize: 13, fontWeight: '600' },

  // ---- Arrow scroll wrapper ----
  arrowScrollContainer: { flexDirection: 'row', alignItems: 'center' },
  arrowBtn: { padding: 4 },
  arrowScrollInner: { flex: 1 },

  // ---- Schedule section ----
  scheduleSection: { marginTop: 8 },
  scheduleSectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  scheduleLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Date pill
  datePill: {
    borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10,
    alignItems: 'center', marginRight: 6, minWidth: 58,
  },
  datePillDay: { fontSize: 10, fontWeight: '600' },
  datePillNum: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  datePillMonth: { fontSize: 10 },

  // Time pill
  timePill: { borderRadius: 8, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 10, marginRight: 6 },
  timePillText: { fontSize: 13, fontWeight: '600' },

  // Duration
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
  celebrationText: { fontSize: 28, fontWeight: '800', color: '#C7605B', textAlign: 'center' },
  celebrationImage: { width: 80, height: 80 },

  // ---- Empty ----
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 16, padding: 32, margin: 16, gap: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtext: { fontSize: 15, fontWeight: '500' },
});
