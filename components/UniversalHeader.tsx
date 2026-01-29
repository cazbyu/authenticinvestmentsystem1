import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { User } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { CompassIcon } from '@/components/icons/CustomIcons';
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
  const pathname = usePathname();
  const { colors } = useTheme();
  const { authenticScore } = useAuthenticScore();
  const [showMissionCard, setShowMissionCard] = useState(false);
  
  // Check if user is on Dashboard (compass page)
  const isOnDashboard = pathname === '/' || pathname === '/dashboard' || pathname === '/(tabs)/dashboard' || pathname === '/(tabs)';

  // Compass pulse animation (when user taps while already on dashboard)
  const compassScale = useSharedValue(1);

  // Score pulse animation (triggers on score change)
  const scoreScale = useSharedValue(1);
  const prevScoreRef = React.useRef(authenticScore);

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

  const compassAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: compassScale.value }],
  }));

  const scoreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const handleProfilePress = () => {
    onOpenSettings();
  };

  const handleCompassPress = () => {
    if (isOnDashboard) {
      // Already on dashboard - show pulse animation
      compassScale.value = withSequence(
        withSpring(1.3, { damping: 8 }),
        withSpring(1, { damping: 8 })
      );
    } else {
      // Navigate to dashboard
      router.push('/dashboard');
    }
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

      {/* Center: Compass */}
      <TouchableOpacity
        style={styles.compassButton}
        onPress={handleCompassPress}
        accessibilityLabel="Go to Dashboard"
        accessibilityRole="button"
      >
        <Animated.View style={compassAnimatedStyle}>
          <CompassIcon
            size={32}
            color="#ffffff"
          />
        </Animated.View>
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
  compassButton: {
    padding: 4,
    position: 'relative',
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