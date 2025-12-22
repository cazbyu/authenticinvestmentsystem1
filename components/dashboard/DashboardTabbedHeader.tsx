import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Menu, House } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '@/contexts/ThemeContext';

type DrawerNavigation = DrawerNavigationProp<any>;

export type DashboardTab = 'home' | 'reflect' | 'act' | 'journal';

interface DashboardTabbedHeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  authenticScore: number;
}

export function DashboardTabbedHeader({
  activeTab,
  onTabChange,
  authenticScore,
}: DashboardTabbedHeaderProps) {
  const navigation = useNavigation<DrawerNavigation>();
  const { colors } = useTheme();

  const handleMenuPress = () => {
    navigation.openDrawer();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleMenuPress}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
          >
            <Menu size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Dashboard</Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'home' && styles.activeTab,
          ]}
          onPress={() => onTabChange('home')}
          accessibilityLabel="Home tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'home' }}
        >
          <House
            size={16}
            color={activeTab === 'home' ? '#0078d4' : '#ffffff'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'reflect' && styles.activeTab,
          ]}
          onPress={() => onTabChange('reflect')}
          accessibilityLabel="Reflect tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'reflect' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'reflect' && styles.activeTabText,
            ]}
          >
            Reflect
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'act' && styles.activeTab,
          ]}
          onPress={() => onTabChange('act')}
          accessibilityLabel="Act tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'act' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'act' && styles.activeTabText,
            ]}
          >
            Act
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'journal' && styles.activeTab,
          ]}
          onPress={() => onTabChange('journal')}
          accessibilityLabel="Journal tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'journal' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'journal' && styles.activeTabText,
            ]}
          >
            Journal
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  menuButton: {
    padding: 4,
    position: 'absolute',
    left: 0,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
    gap: 0,
    alignSelf: 'flex-end',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  activeTab: {
    backgroundColor: '#ffffff',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#0078d4',
  },
});
