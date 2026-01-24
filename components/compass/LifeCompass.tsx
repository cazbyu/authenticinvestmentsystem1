import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform, TouchableOpacity, Pressable } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {
  G,
  Rect,
  Circle,
  Path,
  Polygon,
} from 'react-native-svg';
import { useRouter } from 'expo-router';
import { COMPASS_WAYPOINTS, WAYPOINT_TOLERANCE, COMPASS_CENTER, CompassWaypoint } from './compassConfig';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import SpindleGold from './SpindleGold';
import SpindleSilver from './SpindleSilver';
import CompassHub from './CompassHub';
import { ColorRing } from './ColorRing';
import CardinalIcons from './CardinalIcons';
import SparkQuestionModal from './SparkQuestionModal';

interface LifeCompassProps {
  size?: number;
  contextMode?: 'morning_spark' | 'dashboard' | 'navigation';
  onZoneChange?: (zone: 'mission' | 'wellness' | 'goals' | 'roles') => void;
  onSlotSelect?: (slotCode: string | null) => void;
  onSpinComplete?: () => void;
  onTaskFormOpen?: (formType: 'task' | 'event' | 'depositIdea') => void;
  onJournalFormOpen?: (formType: 'rose' | 'thorn' | 'reflection') => void;
}

type CompassMode = 'spark' | 'exploration';

interface CompassState {
  mode: CompassMode;
  bigSpindleAngle: 0 | 90 | 180 | 270;
  smallSpindleAngle: number;
  activeZone: 'mission' | 'wellness' | 'goals' | 'roles';
  focusedSlot: string | null;
  isSpinning: boolean;
  sequenceStep: number | null;
  showQuestionModal: boolean;
  currentCardinal: 'north' | 'east' | 'south' | 'west' | null;
}

const ZONE_ANGLES = {
  mission: 0,
  wellness: 90,
  goals: 180,
  roles: 270,
} as const;

const ANGLE_TO_ZONE = {
  0: 'mission',
  90: 'wellness',
  180: 'goals',
  270: 'roles',
} as const;

const DOT_ANGLES = [
  15, 30, 45, 60, 75,       // Between N (0°) and E (90°)
  105, 120, 135, 150, 165,  // Between E (90°) and S (180°)
  195, 210, 225, 240, 255,  // Between S (180°) and W (270°)
  285, 300, 315, 330, 345   // Between W (270°) and N (0°)
];

const DOT_RADIUS = 126;  // Outside the compass ring
const DOT_SIZE = 6;      // Radius of each dot

const CARDINALS_SEQUENCE: Array<'north' | 'east' | 'south' | 'west'> = ['north', 'east', 'south', 'west'];
const CARDINAL_TO_ANGLE = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function findNearestWaypoint(angle: number): CompassWaypoint | null {
  const normalized = normalizeAngle(angle);
  const activeWaypoints = COMPASS_WAYPOINTS.filter(w => w.type !== 'decorative');

  for (const waypoint of activeWaypoints) {
    const diff = Math.abs(normalized - waypoint.angle);
    const diff2 = Math.abs(normalized - (waypoint.angle + 360));
    const diff3 = Math.abs(normalized - (waypoint.angle - 360));
    const minDiff = Math.min(diff, diff2, diff3);

    if (minDiff <= WAYPOINT_TOLERANCE) {
      return waypoint;
    }
  }

  return null;
}

function findNearestDot(angle: number): number | null {
  const normalized = normalizeAngle(angle);
  const TOLERANCE = 10;

  for (const dotAngle of DOT_ANGLES) {
    const diff = Math.abs(normalized - dotAngle);
    const diff2 = Math.abs(normalized - (dotAngle + 360));
    const diff3 = Math.abs(normalized - (dotAngle - 360));
    const minDiff = Math.min(diff, diff2, diff3);

    if (minDiff <= TOLERANCE) {
      return dotAngle;
    }
  }

  return null;
}

export function LifeCompass({
  size = 320,
  contextMode = 'navigation',
  onZoneChange,
  onSlotSelect,
  onSpinComplete,
  onTaskFormOpen,
  onJournalFormOpen,
}: LifeCompassProps) {
  const router = useRouter();
  const rotation = useSharedValue(0);

  const [compassState, setCompassState] = useState<CompassState>({
    mode: 'spark',
    bigSpindleAngle: 0,
    smallSpindleAngle: 0,
    activeZone: 'mission',
    focusedSlot: null,
    isSpinning: false,
    sequenceStep: null,
    showQuestionModal: false,
    currentCardinal: null,
  });

  const [domainContentCounts, setDomainContentCounts] = useState<{
    mission?: number;
    wellness?: number;
    goals?: number;
    roles?: number;
  }>({});

  const [focusedDot, setFocusedDot] = useState<number | null>(null);
  const [sparkSequenceIndex, setSparkSequenceIndex] = useState(0);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [sparkQuestions, setSparkQuestions] = useState<Record<string, { id: string; text: string }>>({
    north: { id: '', text: "What's your guiding purpose today?" },
    east: { id: '', text: "How will you nurture your wellbeing today?" },
    south: { id: '', text: "What's one goal you can advance today?" },
    west: { id: '', text: "Which role needs your attention today?" },
  });
  const lastUpdateTime = useSharedValue(0);

  const responsiveSize = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return Math.min(size, screenWidth * 0.8);
  }, [size]);

  useEffect(() => {
    if (onZoneChange) {
      onZoneChange(compassState.activeZone);
    }
  }, [compassState.activeZone]);

  useEffect(() => {
    if (onSlotSelect) {
      onSlotSelect(compassState.focusedSlot);
    }
  }, [compassState.focusedSlot]);

  useEffect(() => {
    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const fetchSparkQuestions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Step 1: Fetch all active morning_spark questions
      const { data: allQuestions, error: questionsError } = await supabase
        .from('0008-ap-coaching-prompts')
        .select('id, domain, prompt_template')
        .contains('context_mode', ['morning_spark'])
        .eq('prompt_type', 'question')
        .eq('is_active', true);

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        return;
      }

      // Step 2: Get questions shown in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentHistory, error: historyError } = await supabase
        .from('0008-ap-prompt-history')
        .select('prompt_id')
        .eq('user_id', user.id)
        .eq('context_mode', 'morning_spark')
        .gte('shown_date', sevenDaysAgo.toISOString().split('T')[0]);

      if (historyError) {
        console.error('Error fetching history:', historyError);
      }

      const recentlyShownIds = new Set(recentHistory?.map(h => h.prompt_id) || []);

      // Step 3: Map domain to cardinal
      const domainToCardinal: Record<string, string> = {
        mission: 'north',
        wellness: 'east',
        goals: 'south',
        roles: 'west',
      };

      // Step 4: Group by cardinal, excluding recently shown
      const questionsByCardinal: Record<string, Array<{ id: string; text: string }>> = {
        north: [],
        east: [],
        south: [],
        west: [],
      };

      allQuestions?.forEach((prompt: any) => {
        const cardinal = domainToCardinal[prompt.domain];
        if (cardinal && !recentlyShownIds.has(prompt.id)) {
          questionsByCardinal[cardinal].push({
            id: prompt.id,
            text: prompt.prompt_template,
          });
        }
      });

      // Step 5: If no unshown questions for a cardinal, use all questions for that domain
      allQuestions?.forEach((prompt: any) => {
        const cardinal = domainToCardinal[prompt.domain];
        if (cardinal && questionsByCardinal[cardinal].length === 0) {
          questionsByCardinal[cardinal].push({
            id: prompt.id,
            text: prompt.prompt_template,
          });
        }
      });

      // Step 6: Pick one random question per cardinal
      const selectedQuestions: Record<string, { id: string; text: string }> = {};

      Object.entries(questionsByCardinal).forEach(([cardinal, questions]) => {
        if (questions.length > 0) {
          const randomIndex = Math.floor(Math.random() * questions.length);
          selectedQuestions[cardinal] = questions[randomIndex];
        }
      });

      setSparkQuestions(prev => ({ ...prev, ...selectedQuestions }));

    } catch (err) {
      console.error('Error in fetchSparkQuestions:', err);
    }
  }, []);

  useEffect(() => {
    if (compassState.mode === 'spark') {
      fetchSparkQuestions();
    }
  }, [compassState.mode, fetchSparkQuestions]);

  const checkDomainContent = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const domains = ['mission', 'wellness', 'goals', 'roles'];
      const counts: { [key: string]: number } = {};

      for (const domain of domains) {
        const { count: quoteCount } = await supabase
          .from('0008-ap-user-power-quotes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('domain', domain)
          .eq('is_active', true);

        const { count: questionCount } = await supabase
          .from('0008-ap-user-power-questions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('domain', domain)
          .eq('is_active', true);

        counts[domain] = (quoteCount || 0) + (questionCount || 0);
      }

      setDomainContentCounts(counts);
    } catch (error) {
      console.error('Error checking domain content:', error);
    }
  }, []);

  useEffect(() => {
    checkDomainContent();
  }, [checkDomainContent]);

  const recordQuestionShown = useCallback(async (promptId: string, cardinal: string) => {
    if (!promptId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cardinalToDomain: Record<string, string> = {
        north: 'mission',
        east: 'wellness',
        south: 'goals',
        west: 'roles',
      };

      const { data, error } = await supabase
        .from('0008-ap-prompt-history')
        .insert({
          user_id: user.id,
          prompt_id: promptId,
          context_mode: 'morning_spark',
          slot_code: cardinalToDomain[cardinal],
          shown_at: new Date().toISOString(),
          shown_date: new Date().toISOString().split('T')[0],
        })
        .select('id')
        .single();

      if (error) {
        console.log('History insert:', error.message);
      } else if (data) {
        setCurrentHistoryId(data.id);
      }
    } catch (err) {
      console.error('Error recording question:', err);
    }
  }, []);

  const recordQuestionResponse = useCallback(async (actionType: string) => {
    if (!currentHistoryId) return;

    try {
      await supabase
        .from('0008-ap-prompt-history')
        .update({
          response_action: actionType,
          responded_at: new Date().toISOString(),
        })
        .eq('id', currentHistoryId);

    } catch (err) {
      console.error('Error recording response:', err);
    }
  }, [currentHistoryId]);

  const handleCardinalPress = useCallback((cardinal: 'north' | 'east' | 'south' | 'west') => {
    if (compassState.isSpinning || compassState.showQuestionModal) return;

    const question = sparkQuestions[cardinal];

    // Record that we're showing this question
    if (question?.id) {
      recordQuestionShown(question.id, cardinal);
    }

    // Find the index of this cardinal in the sequence
    const cardinalIndex = CARDINALS_SEQUENCE.indexOf(cardinal);

    setCompassState(prev => ({
      ...prev,
      smallSpindleAngle: CARDINAL_TO_ANGLE[cardinal],
      currentCardinal: cardinal,
      showQuestionModal: true,
      sequenceStep: cardinalIndex,
    }));

    setSparkSequenceIndex(cardinalIndex);

    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [compassState.isSpinning, compassState.showQuestionModal, sparkQuestions, recordQuestionShown]);

  const handleGoldSpindleSnap = useCallback((direction: 0 | 90 | 180 | 270) => {
    const zone = ANGLE_TO_ZONE[direction];
    setCompassState(prev => ({
      ...prev,
      bigSpindleAngle: direction,
      activeZone: zone,
    }));

    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleSilverSpindleChange = useCallback((angle: number) => {
    const waypoint = findNearestWaypoint(angle);
    const nearestDot = findNearestDot(angle);

    setCompassState(prev => ({
      ...prev,
      smallSpindleAngle: angle,
      focusedSlot: waypoint?.id || (nearestDot ? `DOT_${nearestDot}` : null),
    }));

    setFocusedDot(nearestDot);
  }, []);

  const handleHubTap = useCallback(() => {
    if (compassState.isSpinning || compassState.showQuestionModal) return;

    if (compassState.mode === 'spark') {
      const firstCardinal = CARDINALS_SEQUENCE[0];
      const question = sparkQuestions[firstCardinal];

      // Record that we're showing this question
      if (question?.id) {
        recordQuestionShown(question.id, firstCardinal);
      }

      setCompassState(prev => ({
        ...prev,
        smallSpindleAngle: CARDINAL_TO_ANGLE[firstCardinal],
        currentCardinal: firstCardinal,
        showQuestionModal: true,
        sequenceStep: 0,
      }));

      setSparkSequenceIndex(0);

      if (Platform.OS !== 'web' && Haptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else {
      setCompassState(prev => ({ ...prev, isSpinning: true }));

      if (Platform.OS !== 'web' && Haptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const zones: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270, 0];
      let currentIndex = 0;

      const interval = setInterval(() => {
        if (currentIndex < zones.length) {
          const angle = zones[currentIndex];
          setCompassState(prev => ({
            ...prev,
            bigSpindleAngle: angle,
            activeZone: ANGLE_TO_ZONE[angle],
            sequenceStep: currentIndex,
          }));
          currentIndex++;
        } else {
          clearInterval(interval);
          setCompassState(prev => ({
            ...prev,
            isSpinning: false,
            sequenceStep: null,
            bigSpindleAngle: 0,
            activeZone: 'mission',
          }));
          if (onSpinComplete) {
            onSpinComplete();
          }
        }
      }, 1000);
    }
  }, [compassState.mode, compassState.isSpinning, compassState.showQuestionModal, sparkQuestions, recordQuestionShown, onSpinComplete]);

  const handleSparkNext = useCallback(() => {
    const nextIndex = sparkSequenceIndex + 1;

    // Step 1: Hide modal first
    setCompassState(prev => ({
      ...prev,
      showQuestionModal: false,
    }));

    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Step 2: After modal fades out, move spindle
    setTimeout(() => {
      if (nextIndex >= CARDINALS_SEQUENCE.length) {
        // Sequence complete - return to North
        setCompassState(prev => ({
          ...prev,
          currentCardinal: null,
          sequenceStep: null,
          smallSpindleAngle: 0,
        }));
        setSparkSequenceIndex(0);
        setCurrentHistoryId(null);

        if (onSpinComplete) {
          onSpinComplete();
        }
      } else {
        // Move to next cardinal
        const nextCardinal = CARDINALS_SEQUENCE[nextIndex];
        const question = sparkQuestions[nextCardinal];

        // Record that we're showing this question
        if (question?.id) {
          recordQuestionShown(question.id, nextCardinal);
        }

        setCompassState(prev => ({
          ...prev,
          smallSpindleAngle: CARDINAL_TO_ANGLE[nextCardinal],
          currentCardinal: nextCardinal,
          sequenceStep: nextIndex,
        }));

        setSparkSequenceIndex(nextIndex);

        // Step 3: After spindle moves, show modal again
        setTimeout(() => {
          setCompassState(prev => ({
            ...prev,
            showQuestionModal: true,
          }));
        }, 400);
      }
    }, 300);
  }, [sparkSequenceIndex, sparkQuestions, recordQuestionShown, onSpinComplete]);

  const handleSparkAction = useCallback((actionType: string) => {
  // Record the response
  recordQuestionResponse(actionType);

  if (Platform.OS !== 'web' && Haptics) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // Map action IDs to form types
  const taskFormTypes: Record<string, 'task' | 'event' | 'depositIdea'> = {
    'task': 'task',
    'event': 'event',
    'idea': 'depositIdea',  // ✅ Map 'idea' → 'depositIdea'
  };

  const journalFormTypes: Record<string, 'rose' | 'thorn' | 'reflection'> = {
    'rose': 'rose',
    'thorn': 'thorn',
    'reflect': 'reflection',  // ✅ Map 'reflect' → 'reflection'
  };

  // Open appropriate form with correct type
  if (onTaskFormOpen && taskFormTypes[actionType]) {
    onTaskFormOpen(taskFormTypes[actionType]);
  }
  if (onJournalFormOpen && journalFormTypes[actionType]) {
    onJournalFormOpen(journalFormTypes[actionType]);
  }
}, [recordQuestionResponse, onTaskFormOpen, onJournalFormOpen]);

  const handleSparkClose = useCallback(() => {
    setCompassState(prev => ({
      ...prev,
      showQuestionModal: false,
    }));
  }, []);

  const handleWaypointAction = useCallback((waypoint: CompassWaypoint) => {
    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (waypoint.action === 'navigate' && waypoint.route) {
      router.push(waypoint.route as any);
    } else if (waypoint.action === 'task-form' && waypoint.formType && onTaskFormOpen) {
      onTaskFormOpen(waypoint.formType as 'task' | 'event' | 'depositIdea');
    } else if (waypoint.action === 'journal-form' && waypoint.formType && onJournalFormOpen) {
      onJournalFormOpen(waypoint.formType as 'rose' | 'thorn' | 'reflection');
    }
  }, [router, onTaskFormOpen, onJournalFormOpen]);

  const handleDotPress = useCallback((dotAngle: number) => {
    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setCompassState(prev => ({
      ...prev,
      smallSpindleAngle: dotAngle,
      focusedSlot: `DOT_${dotAngle}`,
    }));

    setFocusedDot(dotAngle);

    const waypoint = findNearestWaypoint(dotAngle);
    if (waypoint) {
      setTimeout(() => {
        handleWaypointAction(waypoint);
      }, 300);
    }
  }, [handleWaypointAction]);

  const calculateDotPosition = useCallback((angle: number) => {
    const angleRad = (angle - 90) * (Math.PI / 180);
    const x = COMPASS_CENTER.x + DOT_RADIUS * Math.cos(angleRad);
    const y = COMPASS_CENTER.y + DOT_RADIUS * Math.sin(angleRad);
    return { x, y };
  }, []);

  const calculateAngle = useCallback((x: number, y: number): number => {
    const scale = 288 / responsiveSize;
    const svgX = x * scale;
    const svgY = y * scale;

    const dx = svgX - COMPASS_CENTER.x;
    const dy = svgY - COMPASS_CENTER.y;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle + 90;

    return normalizeAngle(angle);
  }, [responsiveSize]);

  const dotPositions = useMemo(() => {
    return DOT_ANGLES.map(angle => {
      const angleRad = (angle - 90) * (Math.PI / 180);
      const x = COMPASS_CENTER.x + DOT_RADIUS * Math.cos(angleRad);
      const y = COMPASS_CENTER.y + DOT_RADIUS * Math.sin(angleRad);
      return { angle, x, y };
    });
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan().onUpdate((event) => {
        const now = Date.now();
        if (now - lastUpdateTime.value < 16) {
          return;
        }
        lastUpdateTime.value = now;

        const angle = calculateAngle(event.x, event.y);
        rotation.value = angle;
        runOnJS(handleSilverSpindleChange)(angle);
      }),
    [calculateAngle, handleSilverSpindleChange, rotation, lastUpdateTime]
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.compassContainer,
          { width: responsiveSize, height: responsiveSize },
        ]}
      >
        <Svg
          width={responsiveSize}
          height={responsiveSize}
          viewBox="0 0 288 288"
        >
         
          <G id="Circle">
            <G id="Lines">
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-22.85 27.2) rotate(-10)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-32.42 42.18) rotate(-15)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-40.64 57.95) rotate(-20)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-47.45 74.37) rotate(-25)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-52.81 91.32) rotate(-30)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-56.67 108.67) rotate(-35)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-59.01 126.3) rotate(-40)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-59.03 161.82) rotate(-50)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-56.72 179.45) rotate(-55)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-52.89 196.81) rotate(-60)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-47.55 213.77) rotate(-65)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-40.76 230.2) rotate(-70)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-32.56 245.98) rotate(-75)" fill="#333"/>
              <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-23.02 260.98) rotate(-80)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-22.89 27.25) rotate(-10.02)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-32.44 42.23) rotate(-15.01)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-40.6 57.87) rotate(-19.98)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-47.45 74.36) rotate(-25)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-52.81 91.33) rotate(-30)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-56.67 108.69) rotate(-35)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-59.01 126.32) rotate(-40.01)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-59.03 161.79) rotate(-49.99)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-56.74 179.33) rotate(-54.97)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-52.89 196.8) rotate(-60)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-47.59 213.66) rotate(-64.97)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-40.8 230.11) rotate(-69.97)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-32.58 245.95) rotate(-74.99)" fill="#333"/>
              <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-22.96 261.07) rotate(-80.03)" fill="#333"/>
              <Circle cx="144" cy="144" r="102.24" fill="#fff"/>
</G>

{/* Color Ring - rendered after white background, before star */}
<ColorRing visible={compassState.bigSpindleAngle === 90} size={288} />

<G id="Outer_Circle">
              <Path d="M144,30.24c62.83,0,113.76,50.93,113.76,113.76s-50.93,113.76-113.76,113.76S30.24,206.83,30.24,144,81.17,30.24,144,30.24M144,27.84c-64.05,0-116.16,52.11-116.16,116.16s52.11,116.16,116.16,116.16,116.16-52.11,116.16-116.16S208.05,27.84,144,27.84h0Z" fill="#333"/>
              <Path d="M144,32c61.86,0,112,50.14,112,112s-50.14,112-112,112-112-50.14-112-112,50.14-112,112-112M144,30.4c-62.64,0-113.6,50.96-113.6,113.6s50.96,113.6,113.6,113.6,113.6-50.96,113.6-113.6S206.64,30.4,144,30.4h0Z" fill="#fff"/>
            </G>
          </G>

          <G id="Middle_Circle">
            <Path d="M144,57.6c47.72,0,86.4,38.68,86.4,86.4s-38.68,86.4-86.4,86.4-86.4-38.68-86.4-86.4,38.68-86.4,86.4-86.4M144,55.2c-48.96,0-88.8,39.84-88.8,88.8s39.84,88.8,88.8,88.8,88.8-39.84,88.8-88.8-39.84-88.8-88.8-88.8h0Z" fill="#333"/>
          </G>

          <G id="Star">
            <G id="_2nd_Tier_Star">
              <Polygon points="144 112.87 64.8 64.8 112.87 144 64.8 223.2 144 175.13 223.2 223.2 175.13 144 223.2 64.8 144 112.87" fill="#333"/>
              <Polygon points="144 144 211.78 211.78 170.64 144 144 144" fill="#fff"/>
              <Polygon points="144 144 211.78 211.78 144 170.64 144 144" fill="#333"/>
              <Polygon points="144 144 211.78 76.22 144 117.36 144 144" fill="#fff"/>
              <Polygon points="144 144 211.78 76.22 170.64 144 144 144" fill="#333"/>
              <Polygon points="144 144 69.44 69.44 114.7 144 144 144" fill="#fff"/>
              <Polygon points="144 144 69.44 69.44 144 114.7 144 144" fill="#333"/>
              <Polygon points="144 144 76.22 211.78 144 170.64 144 144" fill="#fff"/>
              <Polygon points="144 144 76.22 211.78 117.36 144 144 144" fill="#333"/>
            </G>
            <G id="Outer_Star">
              <Polygon points="172.3 115.7 144 0 115.7 115.7 0 144 115.7 172.3 144 288 172.3 172.3 288 144 172.3 115.7" fill="#333"/>
              <G id="Top_Star">
                <Polygon points="144 144 144 279.56 170.64 170.64 144 144" fill="#fff"/>
                <Polygon points="144 144 144 279.56 117.36 170.64 144 144" fill="#333"/>
                <Polygon points="144 144 279.56 144 170.64 117.36 144 144" fill="#fff"/>
                <Polygon points="144 144 279.56 144 170.64 170.64 144 144" fill="#333"/>
                <Polygon points="144 144 144 8.44 117.36 117.36 144 144" fill="#fff"/>
                <Polygon points="144 144 144 8.44 170.64 117.36 144 144" fill="#333"/>
                <Polygon points="144 144 8.44 144 117.36 170.64 144 144" fill="#fff"/>
                <Polygon points="144 144 8.44 144 117.36 117.36 144 144" fill="#333"/>
              </G>
            </G>
          </G>

          <G id="Center_Circle">
            <Path d="M144,164.96c-11.56,0-20.96-9.4-20.96-20.96s9.4-20.96,20.96-20.96,20.96,9.4,20.96,20.96-9.4,20.96-20.96,20.96ZM144,124.64c-10.68,0-19.36,8.69-19.36,19.36s8.68,19.36,19.36,19.36,19.36-8.68,19.36-19.36-8.69-19.36-19.36-19.36Z" fill="#fff"/>
            <G id="Core_Circle">
              <Circle cx="144" cy="144" r="24.48" fill="#fff"/>
              <Path d="M144,169.68c-14.16,0-25.68-11.52-25.68-25.68s11.52-25.68,25.68-25.68,25.68,11.52,25.68,25.68-11.52,25.68-25.68,25.68ZM144,120.72c-12.84,0-23.28,10.44-23.28,23.28s10.44,23.28,23.28,23.28,23.28-10.44,23.28-23.28-10.44-23.28-23.28-23.28Z" fill="#333"/>
              <Circle cx="144" cy="144" r="20.16" fill="#333"/>
              <Circle cx="144" cy="144" r="16.8" fill="#fff"/>
            </G>
          </G>

          <G id="BlackDots">
            {dotPositions.map(({ angle, x, y }, index) => {
              const isFocused = focusedDot === angle;

              return (
                <G key={`dot-${index}`}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={isFocused ? DOT_SIZE * 1.3 : DOT_SIZE}
                    fill={isFocused ? '#000' : '#333'}
                    opacity={isFocused ? 1 : 0.85}
                  />
                </G>
              );
            })}
          </G>
        </Svg>

        {dotPositions.map(({ angle, x, y }, index) => {
          const scale = responsiveSize / 288;
          const touchSize = 44;

          return (
            <TouchableOpacity
              key={`touch-dot-${index}`}
              style={[
                styles.dotTouch,
                {
                  left: (x * scale) - (touchSize / 2),
                  top: (y * scale) - (touchSize / 2),
                  width: touchSize,
                  height: touchSize,
                },
              ]}
              onPress={() => handleDotPress(angle)}
              activeOpacity={0.6}
            />
          );
        })}

        <GestureDetector gesture={panGesture}>
  <View style={[styles.gestureArea, StyleSheet.absoluteFill]} pointerEvents="box-none" />
</GestureDetector>


        <View style={[styles.spindleLayer, { width: responsiveSize, height: responsiveSize }]}>
          <SpindleGold
            angle={compassState.bigSpindleAngle}
            size={responsiveSize}
            onSnapComplete={handleGoldSpindleSnap}
          />
        </View>

        <View style={[styles.spindleLayer, StyleSheet.absoluteFill]}>
          <SpindleSilver
            angle={compassState.smallSpindleAngle}
            size={responsiveSize}
            animated={!compassState.isSpinning}
            onAngleChange={handleSilverSpindleChange}
          />
        </View>

        <CardinalIcons
  activeCardinal={compassState.mode === 'spark' ? compassState.currentCardinal : null}
  size={responsiveSize}
  onCardinalPress={handleCardinalPress}
  contentCounts={domainContentCounts}
/>

<CompassHub
  size={responsiveSize}
  isSpinning={compassState.isSpinning}
  onTap={handleHubTap}
  activeZone={compassState.activeZone}
  activeCardinal={compassState.currentCardinal}
/>

{/* All touch targets - rendered last so they're on top */}
<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
  {/* Cardinal touch targets */}
  {(['north', 'east', 'south', 'west'] as const).map((cardinal) => {
    const positions = {
      north: { x: 144, y: 28 },
      east: { x: 260, y: 144 },
      south: { x: 144, y: 260 },
      west: { x: 28, y: 144 },
    };
    const pos = positions[cardinal];
    const scale = responsiveSize / 288;
    
    return (
      <Pressable
        key={cardinal}
        onPress={() => handleCardinalPress(cardinal)}
        style={{
          position: 'absolute',
          left: pos.x * scale - 24,
          top: pos.y * scale - 24,
          width: 48,
          height: 48,
          borderRadius: 24,
        }}
      />
    );
  })}
  
  {/* Hub touch target */}
  <Pressable
    onPress={handleHubTap}
    disabled={compassState.isSpinning}
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      marginLeft: -25,
      marginTop: -25,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(255,0,0,0.3)',
    }}
  />
</View>
    
        <SparkQuestionModal
          visible={compassState.showQuestionModal}
          cardinal={compassState.currentCardinal}
          question={compassState.currentCardinal ? sparkQuestions[compassState.currentCardinal]?.text : ''}
          onAction={handleSparkAction}
          onNext={handleSparkNext}
          onClose={handleSparkClose}
          isLastCardinal={sparkSequenceIndex === CARDINALS_SEQUENCE.length - 1}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spindleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hubLayer: {
  justifyContent: 'center',
  alignItems: 'center',
},
  dotTouch: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  gestureArea: {
    backgroundColor: 'transparent',
  },
});
