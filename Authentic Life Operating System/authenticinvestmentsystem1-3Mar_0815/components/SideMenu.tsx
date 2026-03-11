import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Calendar,
  MessageCircle,
  Settings,
  LogOut,
  BookOpen,
  BookText,
  Bell,
  Lightbulb,
  User,
  Star,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchPendingFollowUps } from '@/lib/followUpUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { getAppVersionDisplay } from '@/lib/appVersion';

const menuItems = [
  { id: 'northstar', title: 'North Star', icon: Star, route: '/(sidebar)/north-star' },
  { id: 'calendar', title: 'Calendar View', icon: Calendar, route: '/calendar' },
  { id: 'reflections', title: 'Reflections', icon: BookOpen, route: '/reflections' },
  { id: 'journal', title: 'Journal', icon: BookText, route: '/journal' },
  { id: 'followup', title: 'Follow Up', icon: Bell, route: '/followup' },
  { id: 'coach', title: 'Coach Chat', icon: MessageCircle, route: '/coach' },
  { id: 'suggestions', title: 'Suggestions', icon: Lightbulb, route: '/suggestions' },
  { id: 'settings', title: 'Settings', icon: Settings, route: '/settings' },
];

export function SideMenu() {
  const router = useRouter();
  const { colors } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [followUpCount, setFollowUpCount] = useState(0);

  useEffect(() => {
    fetchUserData();
    fetchFollowUpCount();

    const handleReflectionChange = () => {
      fetchFollowUpCount();
    };

    eventBus.on(EVENTS.REFLECTION_CREATED, handleReflectionChange);
    eventBus.on(EVENTS.REFLECTION_UPDATED, handleReflectionChange);
    eventBus.on(EVENTS.REFLECTION_DELETED, handleReflectionChange);

    return () => {
      eventBus.off(EVENTS.REFLECTION_CREATED, handleReflectionChange);
      eventBus.off(EVENTS.REFLECTION_UPDATED, handleReflectionChange);
      eventBus.off(EVENTS.REFLECTION_DELETED, handleReflectionChange);
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }

      // Fetch user profile to get name and profile image
      if (user) {
        const { data: profile } = await supabase
          .from('0008-ap-users')
          .select('first_name, last_name, profile_image')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.first_name || profile?.last_name) {
          const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();
          if (fullName) {
            setUserName(fullName);
          }
        }

        // Fetch profile image if available
        if (profile?.profile_image) {
          try {
            const { data: publicUrlData } = supabase
              .storage
              .from('0008-ap-profile-images')
              .getPublicUrl(profile.profile_image);

            if (publicUrlData?.publicUrl) {
              setProfileImageUrl(`${publicUrlData.publicUrl}?cb=${Date.now()}`);
            }
          } catch (imageError) {
            console.error('Error loading profile image in sidebar:', imageError);
            setProfileImageUrl(null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchFollowUpCount = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const filteredFollowUps = await fetchPendingFollowUps(user.id);
      setFollowUpCount(filteredFollowUps.length);
    } catch (error) {
      console.error('Error fetching follow-up count:', error);
    }
  };

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error signing out', error.message);
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        {profileImageUrl ? (
          <Image
            source={{ uri: profileImageUrl }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <User size={32} color="#ffffff" />
          </View>
        )}
        <Text style={styles.headerTitle}>Authentic</Text>
        <Text style={styles.headerSubtitle}>Investments</Text>
      </View>

      <ScrollView style={[styles.menuContainer, { backgroundColor: colors.background }]}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const showBadge = item.id === 'followup' && followUpCount > 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuPress(item.route)}
            >
              <View style={styles.menuItemIcon}>
                <IconComponent size={24} color={colors.primary} />
                {showBadge && (
                  <View style={[styles.badge, { backgroundColor: colors.error }]}>
                    <Text style={styles.badgeText}>{followUpCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            {getAppVersionDisplay()}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {(userName || userEmail) && (
          <View style={styles.userEmailContainer}>
            <Text
              style={[styles.userEmailText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {userName || `Signed in as ${userEmail}`}
            </Text>
          </View>
        )}

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <LogOut size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
  },
  menuContainerWrapper: {
    flex: 1,
  },
  menuContainer: {
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemIcon: {
    position: 'relative',
  },
  menuItemText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  userEmailContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  userEmailText: {
    fontSize: 13,
    fontWeight: '400',
  },
  separator: {
    height: 1,
    marginVertical: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  versionContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '400',
  },
});
