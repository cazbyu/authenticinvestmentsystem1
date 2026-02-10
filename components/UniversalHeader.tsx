import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { User } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useHeaderColor } from '@/contexts/HeaderColorContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { CompassIcon } from '@/components/icons/CustomIcons';
import { MissionCardOverlay } from '@/components/northStar/MissionCardOverlay';
import { getSupabaseClient } from '@/lib/supabase';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

interface UniversalHeaderProps {
  onOpenSettings: () => void;
}

export function UniversalHeader({ onOpenSettings }: UniversalHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { headerColor, setActiveTab } = useHeaderColor();
  const { authenticScore } = useAuthenticScore();
  const [showMissionCard, setShowMissionCard] = useState(false);
  const [firstName, setFirstName] = useState<string>('');
  
  // Check if user is on Dashboard (compass page)
  const isOnDashboard = pathname === '/' || pathname === '/dashboard' || pathname === '/(tabs)/dashboard' || pathname === '/(tabs)';

  // Set dashboard color when on dashboard
  useEffect(() => {
    if (isOnDashboard) {
      setActiveTab('dashboard');
    }
  }, [isOnDashboard, setActiveTab]);

  // Fetch user's first name and sync from Google auth if needed
  useEffect(() => {
    const fetchAndSyncUserName = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get current profile data
        const { data: userData } = await supabase
          .from('0008-ap-users')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        // If profile has first_name, use it
        if (userData?.first_name) {
          setFirstName(userData.first_name);
        } else {
          // Profile is empty - try to sync from Google auth metadata
          const googleMetadata = user.user_metadata;
          const googleFirstName = googleMetadata?.first_name;
          const googleLastName = googleMetadata?.last_name;

          if (googleFirstName) {
            // Update profile with Google auth data
            const updateData: { first_name: string; last_name?: string } = {
              first_name: googleFirstName,
            };
            
            if (googleLastName) {
              updateData.last_name = googleLastName;
            }

            const { error: updateError } = await supabase
              .from('0008-ap-users')
              .update(updateData)
              .eq('id', user.id);

            if (updateError) {
              console.error('Error syncing Google auth name to profile:', updateError);
            } else {
              console.log('Successfully synced Google auth name to profile');
              setFirstName(googleFirstName);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching/syncing user name:', error);
      }
    };

    fetchAndSyncUserName();
  }, []);

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
      // Navigate to dashboard and set color
      setActiveTab('dashboard');
      router.push('/dashboard');
    }
  };

  const handleScorePress = () => {
    router.push('/analytics');
  };

  return (
    <View style={[styles.headerWrapper, { backgroundColor: headerColor }]}>
      <View style={styles.container}>
        {/* Left: Profile */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleProfilePress}
          accessibilityLabel="Open settings"
          accessibilityRole="button"
        >
          <View style={styles.profileCircle}>
            <User size={20} color={headerColor} />
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
              size={40}
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
      </View>

      {/* Personalized title below compass - only show on dashboard */}
      {isOnDashboard && (
        <Text style={styles.personalizedTitle}>
          {firstName 
            ? `${firstName}'s Authentic Life Operating System`
            : 'Your Authentic Life Operating System'
          }
        </Text>
      )}

      {/* Mission Card Overlay (optional quick view) */}
      <MissionCardOverlay
        visible={showMissionCard}
        onClose={() => setShowMissionCard(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  personalizedTitle: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
});