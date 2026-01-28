import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import {
  X,
  User,
  Compass,
  Users,
  Heart,
  Target,
  Calendar,
  BookOpen,
  Clock,
  MessageCircle,
  Settings,
  Lightbulb,
  Info,
  Mail,
  HelpCircle,
  LogOut,
  ChevronRight,
  Home,
} from 'lucide-react-native';
import Constants from 'expo-constants';

interface SettingsSidebarProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsSidebar({ visible, onClose }: SettingsSidebarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    if (visible) {
      fetchUserProfile();
    }
  }, [visible]);

  const fetchUserProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserProfile({
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
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

  const screenWidth = Dimensions.get('window').width;
  const sidebarWidth = Math.min(320, screenWidth * 0.85);

  const menuSections = [
    {
      title: null, // No title for main navigation
      items: [
        { icon: Home, label: 'Dashboard', route: '/(tabs)/dashboard' },
        { icon: Target, label: 'Goals', route: '/(tabs)/goals' },
        { icon: Users, label: 'Roles', route: '/(tabs)/roles' },
        { icon: Heart, label: 'Wellness', route: '/(tabs)/wellness' },
        { icon: Calendar, label: 'Calendar', route: '/calendar' },
      ],
    },
    {
      title: 'Tools & Views',
      items: [
        { icon: Clock, label: 'Follow Up', route: '/follow-up' },
        { icon: BookOpen, label: 'Reflections', route: '/reflections' },
      ],
    },
    {
      title: 'Coaching',
      items: [
        { icon: MessageCircle, label: 'Coach', route: '/coach' },
      ],
    },
    {
      title: 'Settings & Support',
      items: [
        { icon: Settings, label: 'Settings', route: '/settings' },
        { icon: Lightbulb, label: 'Suggestions', route: '/suggestions' },
        { icon: Info, label: 'About', route: '/about' },
        { icon: Mail, label: 'Contact', route: '/contact' },
        { icon: HelpCircle, label: 'Help & Support', route: '/help' },
      ],
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sidebar, { width: sidebarWidth }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.primary }]}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Navigation</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileSection}>
              <View style={styles.avatarCircle}>
                <User size={32} color={colors.primary} />
              </View>
              <Text style={styles.userName}>{userProfile?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{userProfile?.email || ''}</Text>
              <Text style={styles.appVersion}>Authentic LOS v{appVersion}</Text>
            </View>
          </View>

          {/* Menu Items */}
          <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
            {menuSections.map((section, sectionIndex) => (
              <View key={sectionIndex}>
                {section.title && (
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                )}
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={itemIndex}
                    style={styles.menuItem}
                    onPress={() => handleNavigation(item.route)}
                  >
                    <item.icon size={20} color="#374151" />
                    <Text style={styles.menuItemText}>{item.label}</Text>
                    <ChevronRight size={16} color="#9ca3af" />
                  </TouchableOpacity>
                ))}
                {sectionIndex < menuSections.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            ))}

            {/* Sign Out */}
            <View style={styles.divider} />
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <LogOut size={20} color="#dc2626" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            {/* Bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  signOutText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '500',
  },
});