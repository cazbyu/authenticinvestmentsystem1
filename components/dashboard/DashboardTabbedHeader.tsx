import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '@/contexts/ThemeContext';

type DrawerNavigation = DrawerNavigationProp<any>;

export type DashboardTab = 'actions' | 'goals' | 'reflections';

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
            activeTab === 'actions' && styles.activeTab,
          ]}
          onPress={() => onTabChange('actions')}
          accessibilityLabel="Actions tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'actions' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'actions' && styles.activeTabText,
            ]}
          >
            Actions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'goals' && styles.activeTab,
          ]}
          onPress={() => onTabChange('goals')}
          accessibilityLabel="Goals tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'goals' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'goals' && styles.activeTabText,
            ]}
          >
            Goals
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'reflections' && styles.activeTab,
          ]}
          onPress={() => onTabChange('reflections')}
          accessibilityLabel="Reflections tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'reflections' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'reflections' && styles.activeTabText,
            ]}
          >
            Reflections
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
    alignSelf: 'flex-start',
    marginLeft: 48,
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
