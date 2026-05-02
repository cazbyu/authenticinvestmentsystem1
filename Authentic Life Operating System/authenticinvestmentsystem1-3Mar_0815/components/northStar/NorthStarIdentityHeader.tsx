// NorthStarIdentityHeader.tsx
// NS-1 component — North Star page identity card
// Sibling of components/roles/RoleIdentityHeader.tsx
//             and components/keyrelationships/KRIdentityHeader.tsx
//             and components/wellness/ZoneIdentityHeader.tsx

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

const DAILY_PROMPTS = [
  "What would you do if you knew you couldn't fail?",
  "Who are you becoming, and is that who you want to be?",
  "What does living authentically look like for you today?",
  "If your life had a headline five years from now, what would it say?",
  "What matters most to you that you haven't said out loud yet?",
  "What would you regret not doing?",
  "What does thriving look like — not just surviving?",
  "Who are the people you are living for?",
  "What is the one thing only you can do?",
  "What does enough look like to you?",
  "What are you building, and why does it matter?",
  "What would your 80-year-old self tell you to start today?",
  "Where is your life most aligned with your values right now?",
  "What is the next right thing?",
];

const STAR_PATH =
  'M12 2 L14.09 8.26 L20.5 8.27 L15.45 12.14 L17.18 18.5 L12 14.77 L6.82 18.5 L8.55 12.14 L3.5 8.27 L9.91 8.26 Z';

export interface NorthStarIdentityHeaderProps {
  deepCapturesCount: number;
  powerQAnswersCount: number;
  coreValuesCount: number;
  accentColor?: string;
}

export function NorthStarIdentityHeader({
  deepCapturesCount,
  powerQAnswersCount,
  coreValuesCount,
  accentColor = '#8b1a1a',
}: NorthStarIdentityHeaderProps) {
  const { colors } = useTheme();

  const dailyPrompt = useMemo(() => {
    const idx = Math.floor(Date.now() / 86400000) % DAILY_PROMPTS.length;
    return DAILY_PROMPTS[idx];
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.starWrap}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d={STAR_PATH} fill={accentColor} />
          </Svg>
        </View>
        <View style={styles.textBlock}>
          <Text
            style={[styles.label, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Your North Star
          </Text>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}
          >
            Mission, Vision & Purpose
          </Text>
        </View>
      </View>

      <View style={[styles.promptBlock, { borderLeftColor: accentColor }]}>
        <Text style={styles.promptText}>{dailyPrompt}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={[styles.statNumber, { color: accentColor }]}>
            {deepCapturesCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Deep captures
          </Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statNumber, { color: accentColor }]}>
            {powerQAnswersCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Power Q answers
          </Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statNumber, { color: accentColor }]}>
            {coreValuesCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Core values
          </Text>
        </View>
      </View>
    </View>
  );
}

export default NorthStarIdentityHeader;

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  promptBlock: {
    borderLeftWidth: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  promptText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#7f1d1d',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
