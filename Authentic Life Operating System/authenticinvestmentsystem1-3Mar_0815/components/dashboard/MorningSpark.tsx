// MorningSpark.tsx
// Dashboard D1 component — Morning Spark 3-state card
// States: trigger → prompt → scorecard

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import {
  Mic,
  Zap,
  Compass,
  Circle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, toLocalISOString } from '@/lib/dateUtils';

type SparkState = 'trigger' | 'prompt' | 'scorecard';

interface MorningSparkProps {
  userId: string;
  accentColor?: string;
}

function formatTimeFromIso(iso: string): string {
  const t = new Date(iso);
  const hours = t.getHours();
  const minutes = t.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
}

function formatTimeNow(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
}

export default function MorningSpark({
  userId,
  accentColor = '#8b1a1a',
}: MorningSparkProps) {
  const [sparkState, setSparkState] = useState<SparkState>('trigger');
  const [sparkTime, setSparkTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkmarkFilled, setCheckmarkFilled] = useState(false);

  // Scorecard counts (placeholder — Compass-3 arc will wire real data)
  const [tasksDone] = useState(0);
  const [goalActions] = useState(0);
  const [captures] = useState(0);
  const [score] = useState(0);

  const flickerAnim = useRef(new Animated.Value(1)).current;

  // Initial fetch: was Spark already committed today?
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = getSupabaseClient();
        const todayStr = formatLocalDate(new Date());
        const { data } = await supabase
          .from('0008-ap-daily-sparks')
          .select('committed_at')
          .eq('user_id', userId)
          .eq('spark_date', todayStr)
          .maybeSingle();
        if (cancelled) return;
        if (data?.committed_at) {
          setSparkTime(formatTimeFromIso(data.committed_at));
          setSparkState('scorecard');
        }
      } catch (err) {
        console.error('[MorningSpark] load error:', err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Subtle fire flicker in trigger state
  useEffect(() => {
    if (sparkState !== 'trigger') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, {
          toValue: 0.85,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flickerAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sparkState, flickerAnim]);

  const handleTriggerTap = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const now = new Date();
      const todayStr = formatLocalDate(now);
      const isoNow = toLocalISOString(now);
      setSparkTime(formatTimeNow(now));

      const supabase = getSupabaseClient();
      await supabase
        .from('0008-ap-daily-sparks')
        .upsert(
          {
            user_id: userId,
            spark_date: todayStr,
            committed_at: isoNow,
          },
          { onConflict: 'user_id,spark_date' },
        );
    } catch (err) {
      console.error('[MorningSpark] record error:', err);
    } finally {
      setSaving(false);
      setSparkState('prompt');
    }
  };

  const handleCheckmarkTap = () => {
    setCheckmarkFilled(true);
    setTimeout(() => {
      setSparkState('scorecard');
    }, 800);
  };

  const handleSkip = () => {
    setSparkState('scorecard');
  };

  const handleResetForDemo = () => {
    setSparkState('trigger');
    setCheckmarkFilled(false);
  };

  const handleComingSoon = (feature: string) => {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(`${feature} coming soon`);
    }
  };

  if (sparkState === 'trigger') {
    return (
      <TouchableOpacity
        style={styles.triggerCard}
        onPress={handleTriggerTap}
        activeOpacity={0.85}
        disabled={saving}
      >
        <View style={styles.triggerHeader}>
          <Animated.Text style={[styles.fireEmoji, { opacity: flickerAnim }]}>
            🔥
          </Animated.Text>
          <Text style={styles.triggerTitle}>Morning Spark</Text>
        </View>
        <Text style={styles.triggerBoldLine}>
          Who am I? Why am I here? Where do I want to go?
        </Text>
        <Text style={styles.triggerSubLine}>
          Today you help build that version of you!
        </Text>
        <View style={styles.triggerFooter}>
          <Text style={styles.triggerFooterMuted}>Not yet completed today</Text>
          <Text style={styles.triggerFooterCta}>Tap to begin →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (sparkState === 'prompt') {
    return (
      <View style={styles.promptCard}>
        <TouchableOpacity
          style={styles.promptCheckmark}
          onPress={handleCheckmarkTap}
          activeOpacity={0.7}
        >
          {checkmarkFilled ? (
            <CheckCircle2 size={28} color="#22c55e" fill="#22c55e" />
          ) : (
            <Circle size={28} color="#ffffff" strokeWidth={1.5} />
          )}
        </TouchableOpacity>

        <View style={styles.promptInner}>
          <Text style={styles.promptStar}>✦</Text>
          <Text style={styles.promptItalic}>
            Let your actions today take you in that direction —
          </Text>
          <Text style={styles.promptBoldSub}>it's time to build you!</Text>
          {sparkTime && (
            <Text style={styles.promptSparkLine}>
              🔥 Spark recorded at {sparkTime}
            </Text>
          )}
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => handleComingSoon('Coach Talk')}
            activeOpacity={0.7}
          >
            <View
              style={[styles.actionIconWrap, { backgroundColor: 'rgba(168,85,247,0.18)' }]}
            >
              <Mic size={18} color="#c084fc" />
            </View>
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Coach Talk</Text>
              <Text style={styles.actionDesc}>
                A word from your coach — quote, story or video
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => handleComingSoon("Today's Inspiration")}
            activeOpacity={0.7}
          >
            <View
              style={[styles.actionIconWrap, { backgroundColor: 'rgba(245,158,11,0.18)' }]}
            >
              <Zap size={18} color="#fbbf24" />
            </View>
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Today's Inspiration</Text>
              <Text style={styles.actionDesc}>
                From your personal inspiration library
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => handleComingSoon('Alignment Questions')}
            activeOpacity={0.7}
          >
            <View
              style={[styles.actionIconWrap, { backgroundColor: 'rgba(220,38,38,0.18)' }]}
            >
              <Compass size={18} color="#fca5a5" />
            </View>
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Alignment Questions</Text>
              <Text style={styles.actionDesc}>
                Stay connected to your mission, vision & values
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.promptFooter}>
          <Text style={styles.promptFooterMuted}>
            Fades to scorecard in a few minutes...
          </Text>
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.promptFooterSkip}>Skip →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Scorecard
  return (
    <View>
      <View style={styles.scorecardCard}>
        <View style={styles.scorecardHeader}>
          <Text style={styles.scorecardLabel}>TODAY'S SCORECARD</Text>
          {sparkTime && (
            <Text style={styles.scorecardSparkLine}>
              🔥 Spark {sparkTime} ✓
            </Text>
          )}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statNumber}>{tasksDone}</Text>
            <Text style={styles.statLabel}>Tasks done</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statNumber}>{goalActions}</Text>
            <Text style={styles.statLabel}>Goal actions</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statNumber}>{captures}</Text>
            <Text style={styles.statLabel}>Captures</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statNumber}>{score}</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={handleResetForDemo}
        activeOpacity={0.7}
      >
        <RotateCcw size={12} color="#9ca3af" />
        <Text style={styles.resetBtnText}>Reset to Morning Spark</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Trigger
  triggerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
  },
  triggerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fireEmoji: { fontSize: 18 },
  triggerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  triggerBoldLine: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 4,
  },
  triggerSubLine: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
    marginBottom: 12,
  },
  triggerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerFooterMuted: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  triggerFooterCta: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },

  // Prompt
  promptCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  promptCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
  },
  promptInner: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  promptStar: {
    fontSize: 28,
    color: '#fde68a',
    marginBottom: 4,
  },
  promptItalic: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  promptBoldSub: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  promptSparkLine: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
  },
  actionGrid: {
    gap: 8,
    marginBottom: 12,
  },
  actionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBlock: { flex: 1 },
  actionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  actionDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 14,
    marginTop: 1,
  },
  promptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  promptFooterMuted: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  promptFooterSkip: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },

  // Scorecard
  scorecardCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  scorecardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scorecardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.6,
  },
  scorecardSparkLine: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22c55e',
  },
  statsRow: { flexDirection: 'row', gap: 6 },
  statTile: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  resetBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  resetBtnText: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
