import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  User,
  Settings,
  Calendar,
  BookOpen,
  Target,
  Users,
  Heart,
  HelpCircle,
  LogOut,
  ChevronRight,
  Compass,
  Clock,
  MessageCircle,
  Lightbulb,
  Info,
  Mail,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);

interface SettingsSidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface UserProfile {
  name: string;
  email: string;
}

export function SettingsSidebar({ visible, onClose }: SettingsSidebarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', email: '' });
  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Get app version
  const appVersion = Constants.expoConfig?.version || '0.2';

  useEffect(() => {
    if (visible) {
      fetchUserProfile();
      // Slide in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const fetchUserProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Try to get display name from user metadata or profile table
        const displayName = user.user_metadata?.full_name 
          || user.user_metadata?.name 
          || user.email?.split('@')[0] 
          || 'User';
        
        setUserProfile({
          name: displayName,
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
    // Small delay to let sidebar close animation start
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      onClose();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    // Main Navigation
    { icon: Compass, label: 'Dashboard', route: '/(tabs)/dashboard' },
    { icon: Users, label: 'Role Bank', route: '/(tabs)/roles' },
    { icon: Heart, label: 'Wellness Bank', route: '/(tabs)/wellness' },
    { icon: Target, label: 'Goal Bank', route: '/(tabs)/goals' },
    { type: 'divider' },
    // Tools & Views
    { icon: Calendar, label: 'Calendar', route: '/calendar' },
    { icon: BookOpen, label: 'Reflections', route: '/reflections' },
    { icon: Clock, label: 'Follow Up', route: '/follow-up' },
    { type: 'divider' },
    // Coaching
    { icon: MessageCircle, label: 'Coach Chat', route: '/coach-chat' },
    { type: 'divider' },
    // Settings & Support
    { icon: Settings, label: 'Settings', route: '/settings' },
    { icon: Lightbulb, label: 'Suggestions', route: '/suggestions' },
    { icon: Info, label: 'About', route: '/about' },
    { icon: Mail, label: 'Contact', route: '/contact' },
    { icon: HelpCircle, label: 'Help & Support', route: '/help' },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View 
        style={[
          styles.backdrop,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            backgroundColor: colors.surface,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header with Profile */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarCircle}>
              <User size={32} color={colors.primary} />
            </View>
            <Text style={styles.profileName}>{userProfile.name}</Text>
            <Text style={styles.profileEmail}>{userProfile.email}</Text>
            <Text style={styles.appVersion}>Authentic LOS v{appVersion}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          {menuItems.map((item, index) => {
            if (item.type === 'divider') {
              return <View key={`divider-${index}`} style={styles.divider} />;
            }

            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.route}
                style={styles.menuItem}
                onPress={() => handleNavigation(item.route!)}
              >
                <IconComponent size={22} color={colors.textSecondary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  {item.label}
                </Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sign Out Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOut size={22} color="#dc2626" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#dc2626',
  },
});