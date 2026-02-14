/**
 * CoachInsight — One-way coaching message display
 *
 * Shows an alignment coach message at the top of ritual steps.
 * Tone-adaptive styling (welcome=blue, encourage=green, slow_down=amber, etc.)
 * Collapses to a single line when tapped, expands to full message on tap again.
 * Includes a loading shimmer state while the coach is thinking.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Compass, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { CoachTone } from '@/types/alignmentCoach';

// ── Tone → color mapping ─────────────────────────────────────────

const TONE_COLORS: Record<CoachTone, { bg: string; bgDark: string; accent: string; icon: string }> = {
  welcome:      { bg: '#EFF6FF', bgDark: 'rgba(59,130,246,0.10)', accent: '#3B82F6', icon: '\u{1F44B}' },
  encourage:    { bg: '#ECFDF5', bgDark: 'rgba(16,185,129,0.10)', accent: '#10B981', icon: '\u{1F4AA}' },
  slow_down:    { bg: '#FFF7ED', bgDark: 'rgba(249,115,22,0.10)', accent: '#F97316', icon: '\u{1F9D8}' },
  push_forward: { bg: '#F0F9FF', bgDark: 'rgba(14,165,233,0.10)', accent: '#0EA5E9', icon: '\u{1F680}' },
  celebrate:    { bg: '#FFF7ED', bgDark: 'rgba(245,158,11,0.10)', accent: '#F59E0B', icon: '\u{1F389}' },
  challenge:    { bg: '#FDF2F8', bgDark: 'rgba(236,72,153,0.10)', accent: '#EC4899', icon: '\u{1F525}' },
  reflect:      { bg: '#FAF5FF', bgDark: 'rgba(168,85,247,0.10)', accent: '#A855F7', icon: '\u{1F914}' },
};

// ── Props ─────────────────────────────────────────────────────────

interface CoachInsightProps {
  /** The coach message text. Null means no message loaded yet. */
  message: string | null;
  /** Emotional tone of the message */
  tone: CoachTone;
  /** Whether the coach is still thinking */
  loading: boolean;
  /** Whether the insight is from a fallback (not real AI) */
  isFallback?: boolean;
  /** Start collapsed (default: false = expanded) */
  startCollapsed?: boolean;
}

// ── Component ─────────────────────────────────────────────────────

export function CoachInsight({
  message,
  tone,
  loading,
  isFallback = false,
  startCollapsed = false,
}: CoachInsightProps) {
  const { colors, isDarkMode } = useTheme();
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(startCollapsed ? 0 : 1)).current;

  const toneStyle = TONE_COLORS[tone] || TONE_COLORS.encourage;

  // Fade in when message arrives
  useEffect(() => {
    if (message && !loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [message, loading]);

  // Animate collapse/expand
  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: collapsed ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [collapsed]);

  // Don't render anything if no message and not loading
  if (!message && !loading) return null;

  const bgColor = isDarkMode ? toneStyle.bgDark : toneStyle.bg;
  const borderColor = toneStyle.accent + '30';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
      ]}
      onPress={() => setCollapsed(!collapsed)}
      activeOpacity={0.8}
    >
      {/* Header row — always visible */}
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: toneStyle.accent + '20' }]}>
          {loading ? (
            <ActivityIndicator size="small" color={toneStyle.accent} />
          ) : (
            <Compass size={16} color={toneStyle.accent} />
          )}
        </View>
        <Text style={[styles.label, { color: toneStyle.accent }]}>
          {loading ? 'Coach is thinking...' : 'Alignment Coach'}
        </Text>
        <View style={styles.spacer} />
        {message && !loading && (
          collapsed ? (
            <ChevronDown size={16} color={colors.textSecondary} />
          ) : (
            <ChevronUp size={16} color={colors.textSecondary} />
          )
        )}
      </View>

      {/* Message body — collapsible */}
      {loading ? (
        <View style={styles.loadingRow}>
          <View style={[styles.shimmer, { backgroundColor: toneStyle.accent + '15' }]} />
          <View style={[styles.shimmer, styles.shimmerShort, { backgroundColor: toneStyle.accent + '10' }]} />
        </View>
      ) : message ? (
        <Animated.View
          style={[
            styles.bodyContainer,
            {
              maxHeight: heightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500],
              }),
              opacity: heightAnim,
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.messageText,
              { color: colors.text, opacity: fadeAnim },
            ]}
          >
            {toneStyle.icon} {message}
          </Animated.Text>

          {isFallback && (
            <Text style={[styles.fallbackLabel, { color: colors.textSecondary }]}>
              Offline guidance
            </Text>
          )}
        </Animated.View>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spacer: {
    flex: 1,
  },
  bodyContainer: {
    overflow: 'hidden',
    marginTop: 8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  fallbackLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  loadingRow: {
    marginTop: 8,
    gap: 6,
  },
  shimmer: {
    height: 14,
    borderRadius: 7,
    width: '90%',
  },
  shimmerShort: {
    width: '60%',
  },
});

export default CoachInsight;
