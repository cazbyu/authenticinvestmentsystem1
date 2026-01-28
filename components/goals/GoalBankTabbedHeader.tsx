import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

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
  isSubHeader?: boolean;
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
  isSubHeader = false,
}: GoalBankTabbedHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  // When used as sub-header, use light gray background
  const headerBgColor = isSubHeader ? '#f8fafc' : (backgroundColor || colors.primary);
  const textColor = isSubHeader ? '#1f2937' : '#ffffff';
  const secondaryTextColor = isSubHeader ? '#6b7280' : 'rgba(255, 255, 255, 0.8)';
  const borderColor = isSubHeader ? '#e5e7eb' : 'rgba(255, 255, 255, 0.2)';

  // If showing back button (timeline selected), show timeline info header
  if (showBackButton) {
    return (
      <View style={[styles.subHeaderContainer, { backgroundColor: headerBgColor, borderBottomColor: borderColor }]}>
        <View style={styles.timelineHeaderRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            accessibilityLabel="Go back to timeline selector"
            accessibilityRole="button"
          >
            <ChevronLeft size={20} color="#0078d4" />
            <Text style={styles.backButtonText}>My Goals</Text>
          </TouchableOpacity>
        </View>
        
        {timelineTitle && (
          <View style={styles.timelineInfoRow}>
            <Text style={[styles.timelineTitle, { color: textColor }]} numberOfLines={1}>
              {timelineTitle}
            </Text>
            {(daysRemaining !== undefined || cycleProgressPercentage !== undefined) && (
              <View style={styles.timelineMetrics}>
                {daysRemaining !== undefined && (
                  <Text style={[styles.timelineMetric, { color: secondaryTextColor }]}>
                    {daysRemaining} days left
                  </Text>
                )}
                {cycleProgressPercentage !== undefined && (
                  <>
                    <Text style={[styles.timelineMetricSeparator, { color: secondaryTextColor }]}>•</Text>
                    <Text style={[styles.timelineMetric, { color: secondaryTextColor }]}>
                      {Math.round(cycleProgressPercentage)}% complete
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  // Main view with tabs (sub-header style)
  return (
    <View style={[styles.subHeaderContainer, { backgroundColor: headerBgColor, borderBottomColor: borderColor }]}>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'goals' && styles.tabActive,
          ]}
          onPress={() => onTabChange('goals')}
          accessibilityLabel="My Goals tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'goals' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'goals' && styles.tabTextActive,
            ]}
          >
            Goals
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'manage-timelines' && styles.tabActive,
          ]}
          onPress={() => onTabChange('manage-timelines')}
          accessibilityLabel="Manage Timelines tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'manage-timelines' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'manage-timelines' && styles.tabTextActive,
            ]}
          >
            Manage
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sub-header styles (light gray background)
  subHeaderContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
    padding: 3,
    alignSelf: 'flex-start',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#0078d4',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  // Timeline selected header
  timelineHeaderRow: {
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0078d4',
  },
  timelineInfoRow: {
    gap: 4,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  timelineMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineMetric: {
    fontSize: 12,
    color: '#6b7280',
  },
  timelineMetricSeparator: {
    fontSize: 12,
    color: '#9ca3af',
  },
});