import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, Menu } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { WebNavigationMenu } from '../WebNavigationMenu';

export type GoalBankTab = 'goals' | 'manage-timelines';

interface GoalBankTabbedHeaderProps {
  activeTab: GoalBankTab;
  onTabChange: (tab: GoalBankTab) => void;
  authenticScore: number;
  showBackButton?: boolean;
  onBackPress?: () => void;
  timelineTitle?: string;
  daysRemaining?: number;
  cycleProgressPercentage?: number;
  backgroundColor?: string;
}

export function GoalBankTabbedHeader({
  activeTab,
  onTabChange,
  authenticScore,
  showBackButton,
  onBackPress,
  timelineTitle,
  daysRemaining,
  cycleProgressPercentage,
  backgroundColor,
}: GoalBankTabbedHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const headerBgColor = backgroundColor || colors.primary;
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: headerBgColor }]}>
        <View style={styles.topRow}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              accessibilityLabel="Go back to timeline selector"
              accessibilityRole="button"
            >
              <ChevronLeft size={24} color="#ffffff" />
              <Text style={styles.backButtonText}>My Goals</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.titleRow}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={handleMenuPress}
                accessibilityLabel="Open menu"
                accessibilityRole="button"
              >
                <Menu size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.pageTitle}>Goal Bank</Text>
            </View>
          )}

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Authentic Score</Text>
            <Text style={styles.scoreValue}>{authenticScore}</Text>
          </View>
        </View>

        {timelineTitle && (
          <View style={styles.timelineInfo}>
            <Text style={styles.timelineTitle} numberOfLines={1}>
              {timelineTitle}
            </Text>
            {(daysRemaining !== undefined || cycleProgressPercentage !== undefined) && (
              <View style={styles.timelineMetrics}>
                {daysRemaining !== undefined && (
                  <Text style={styles.timelineMetric}>{daysRemaining} days left</Text>
                )}
                {cycleProgressPercentage !== undefined && (
                  <>
                    <Text style={styles.timelineMetricSeparator}>•</Text>
                    <Text style={styles.timelineMetric}>
                      {Math.round(cycleProgressPercentage)}% complete
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {!showBackButton && (
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'goals' && styles.activeTab,
              ]}
              onPress={() => onTabChange('goals')}
              accessibilityLabel="My Goals tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'goals' }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'goals' && styles.activeTabText,
                ]}
              >
                My Goals
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'manage-timelines' && styles.activeTab,
              ]}
              onPress={() => onTabChange('manage-timelines')}
              accessibilityLabel="Manage Timelines tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'manage-timelines' }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'manage-timelines' && styles.activeTabText,
                ]}
              >
                Manage Timelines
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <WebNavigationMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
      />
    </>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  timelineInfo: {
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  timelineMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineMetric: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  timelineMetricSeparator: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
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
