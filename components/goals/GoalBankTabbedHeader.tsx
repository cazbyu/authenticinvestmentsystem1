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

  // If showing back button (timeline selected), show timeline info header
  if (showBackButton) {
    return (
      <View style={styles.subHeaderContainer}>
        <View style={styles.timelineHeaderRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            accessibilityLabel="Go back to goals list"
            accessibilityRole="button"
          >
            <ChevronLeft size={20} color="#0078d4" />
            <Text style={styles.backButtonText}>Goals</Text>
          </TouchableOpacity>
        </View>
        
        {timelineTitle && (
          <View style={styles.timelineInfoRow}>
            <Text style={styles.timelineTitle} numberOfLines={1}>
              {timelineTitle}
            </Text>
            {(daysRemaining !== undefined || cycleProgressPercentage !== undefined) && (
              <View style={styles.timelineMetrics}>
                {daysRemaining !== undefined && (
                  <Text style={styles.timelineMetric}>
                    {daysRemaining} days left
                  </Text>
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
      </View>
    );
  }

  // Main view with tabs (sub-header style matching other banks)
  return (
    <View style={styles.subHeaderContainer}>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'goals' && styles.tabActive,
          ]}
          onPress={() => onTabChange('goals')}
          accessibilityLabel="Goals tab"
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
          accessibilityLabel="Manage tab"
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
  // Sub-header container (light gray background)
  subHeaderContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  // Tabs row
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
  // Timeline selected header (back button view)
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