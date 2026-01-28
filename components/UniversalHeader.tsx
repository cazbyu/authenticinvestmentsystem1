import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { NorthStarIcon } from '@/components/icons/CustomIcons';
import { useNorthStarVisit } from '@/hooks/NorthStarVisits';
import { MissionCardOverlay } from '@/components/northStar/MissionCardOverlay';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

interface UniversalHeaderProps {
  onOpenSettings: () => void;
}

export function UniversalHeader({ onOpenSettings }: UniversalHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { authenticScore } = useAuthenticScore();
  const [showMissionCard, setShowMissionCard] = useState(false);
  
  // NorthStar visit tracking for pulse animation
  let shouldPulse = false;
  try {
    const visitData = useNorthStarVisit();
    shouldPulse = visitData?.shouldPulse ?? false;
  } catch (error) {
    // Hook not available, default to no pulse
  }

  // NorthStar pulse animation
  const northStarOpacity = useSharedValue(1);
  const northStarScale = useSharedValue(1);

  // Score pulse animation (triggers on score change)
  const scoreScale = useSharedValue(1);
  const prevScoreRef = React.useRef(authenticScore);

  useEffect(() => {
    if (shouldPulse) {
      // Gentle pulse for NorthStar when not visited in 24 hours
      northStarOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1500 }),
          withTiming(1, { duration: 1500 })
        ),
        -1,
        true
      );
      northStarScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1500 }),
          withTiming(1, { duration: 1500 })
        ),
        -1,
        true
      );
    } else {
      northStarOpacity.value = withTiming(1);
      northStarScale.value = withTiming(1);
    }
  }, [shouldPulse]);

  // Pulse score when it changes
  useEffect(() => {
    if (prevScoreRef.current !== authenticScore) {
      scoreScale.value = withSequence(
        withSpring(1.2, { damping: 8 }),
        withSpring(1, { damping: 8 })
      );
      prevScoreRef.current = authenticScore;
    }
  }, [authenticScore]);

  const northStarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: northStarOpacity.value,
    transform: [{ scale: northStarScale.value }],
  }));

  const scoreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const handleProfilePress = () => {
    onOpenSettings();
  };

  const handleNorthStarPress = () => {
    router.push('/north-star');
  };

  const handleScorePress = () => {
    router.push('/analytics');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      {/* Left: Profile */}
      <TouchableOpacity
        style={styles.profileButton}
        onPress={handleProfilePress}
        accessibilityLabel="Open settings"
        accessibilityRole="button"
      >
        <View style={styles.profileCircle}>
          <User size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Center: NorthStar */}
      <TouchableOpacity
        style={styles.northStarButton}
        onPress={handleNorthStarPress}
        accessibilityLabel="View North Star"
        accessibilityRole="button"
      >
        <Animated.View style={northStarAnimatedStyle}>
          <NorthStarIcon
            size={32}
            color={shouldPulse ? '#C9A227' : '#ffffff'}
          />
        </Animated.View>
        {shouldPulse && <View style={styles.pulseIndicator} />}
      </TouchableOpacity>

      {/* Right: Authentic Score */}
      <TouchableOpacity
        style={styles.scoreButton}
        onPress={handleScorePress}
        accessibilityLabel={`Authentic Score: ${authenticScore}`}
        accessibilityRole="button"
      >
        <Animated.View style={scoreAnimatedStyle}>
          <Text style={styles.scoreText}>{authenticScore}</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Mission Card Overlay (optional quick view) */}
      <MissionCardOverlay
        visible={showMissionCard}
        onClose={() => setShowMissionCard(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileButton: {
    padding: 4,
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  northStarButton: {
    padding: 4,
    position: 'relative',
  },
  pulseIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  scoreButton: {
    padding: 4,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
});