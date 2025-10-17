import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, MessageCircle, Settings, LogOut, BookOpen, Bell, Lightbulb } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

const menuItems = [
  { id: 'calendar', title: 'Calendar View', icon: Calendar, route: '/calendar' },
  { id: 'reflections', title: 'Reflections', icon: BookOpen, route: '/reflections' },
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

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }

      // Fetch user profile to get name
      if (user) {
        const { data: profile } = await supabase
          .from('0008-ap-users')
          .select('first_name, last_name')
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
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  // --- ADD THIS FUNCTION ---
  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error signing out', error.message);
      } else {
        // This will clear the local session and send the user to the login screen
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };
  // -------------------------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Authentic</Text>
        <Text style={styles.headerSubtitle}>Investments</Text>
      </View>
      
      <ScrollView style={[styles.menuContainer, { backgroundColor: colors.background }]}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuPress(item.route)}
            >
              <IconComponent size={24} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>v 0.01</Text>
        </View>
      </ScrollView>
      
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {(userName || userEmail) && (
          <View style={styles.userEmailContainer}>
            <Text style={[styles.userEmailText, { color: colors.textSecondary }]} numberOfLines={1}>
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
  menuItemText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
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