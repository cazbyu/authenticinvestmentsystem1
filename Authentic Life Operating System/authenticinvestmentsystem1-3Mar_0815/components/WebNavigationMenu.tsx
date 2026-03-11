import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Home, Target, User, Activity, Calendar, Clock, Settings, MessageCircle, Info, Mail, BookText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface WebNavigationMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function WebNavigationMenu({ visible, onClose }: WebNavigationMenuProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const navigateTo = (route: string) => {
    router.push(route as any);
    onClose();
  };

  const menuItems = [
    { icon: Home, label: 'Dashboard', route: '/(tabs)/dashboard' },
    { icon: Target, label: 'Goals', route: '/(tabs)/goals' },
    { icon: User, label: 'Roles', route: '/(tabs)/roles' },
    { icon: Activity, label: 'Wellness', route: '/(tabs)/wellness' },
    { icon: Calendar, label: 'Calendar', route: '/calendar' },
    { icon: Clock, label: 'Follow Up', route: '/followup' },
    { icon: MessageCircle, label: 'Reflections', route: '/reflections' },
    { icon: BookText, label: 'Journal', route: '/journal' },
    { icon: MessageCircle, label: 'Coach', route: '/coach' },
    { icon: Settings, label: 'Settings', route: '/settings' },
    { icon: MessageCircle, label: 'Suggestions', route: '/suggestions' },
    { icon: Info, label: 'About', route: '/about' },
    { icon: Mail, label: 'Contact', route: '/contact' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.menuContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Navigation</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuItems}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={() => navigateTo(item.route)}
                >
                  <item.icon size={20} color={colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  menuContainer: {
    width: 280,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  menuItems: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
});
