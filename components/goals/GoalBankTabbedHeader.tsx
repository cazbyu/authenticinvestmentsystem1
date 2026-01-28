import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

export type GoalBankTab = 'goals' | 'manage-timelines';

interface GoalBankTabbedHeaderProps {
  activeTab: GoalBankTab;
  onTabChange: (tab: GoalBankTab) => void;
  authenticScore?: number;
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
  showBackButton,
  onBackPress,
  timelineTitle,
  daysRemaining,
  cycleProgressPercentage,
}: GoalBankTabbedHeaderProps) {
  
  // Timeline selected - show back button and timeline info
  if (showBackButton) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
        >
          <ChevronLeft size={20} color="#0078d4" />
          <Text style={styles.backButtonText}>Goals</Text>
        </TouchableOpacity>
        
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
                    <Text style={styles.metricSeparator}>•</Text>
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

  // Main view - show tabs
  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'goals' && styles.tabActive]}
          onPress={() => onTabChange('goals')}
        >
          <Text style={[styles.tabText, activeTab === 'goals' && styles.tabTextActive]}>
            Goals
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'manage-timelines' && styles.tabActive]}
          onPress={() => onTabChange('manage-timelines')}
        >
          <Text style={[styles.tabText, activeTab === 'manage-timelines' && styles.tabTextActive]}>
            Manage
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0078d4',
  },
  timelineInfo: {
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
  metricSeparator: {
    fontSize: 12,
    color: '#9ca3af',
  },
});