import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useNorthStarVisit } from '@/hooks/NorthStarVisits';
import { UniversalHeader } from '@/components/UniversalHeader';
import { SettingsSidebar } from '@/components/SettingsSidebar';

// Tab Components
import { MyVisionTab } from '@/components/northStar/MyVisionTab';
import { CoachsCornerTab } from '@/components/northStar/CoachsCornerTab';
import { SparkLibraryTab } from '@/components/northStar/SparkLibraryTab';

// Types
type TabKey = 'vision' | 'coach' | 'sparks';

interface TabConfig {
  key: TabKey;
  label: string;
  conditional?: boolean;
}

interface CoachRelationship {
  id: string;
  coach_id: string;
  is_primary: boolean;
  status: string;
  coach_role: string | null;
}

export default function NorthStarPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { recordVisit } = useNorthStarVisit();
  
  // State
  const [activeTab, setActiveTab] = useState<TabKey>('vision');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCoach, setHasCoach] = useState(false);
  const [coachRelationships, setCoachRelationships] = useState<CoachRelationship[]>([]);
  const [settingsSidebarVisible, setSettingsSidebarVisible] = useState(false);

  // Record visit on mount
  useEffect(() => {
    recordVisit('full_page');
  }, []);

  // Tab configuration - text only, no icons
  const allTabs: TabConfig[] = useMemo(() => [
    {
      key: 'vision',
      label: 'My Vision',
    },
    {
      key: 'coach',
      label: "Coach's Corner",
      conditional: true,
    },
    {
      key: 'sparks',
      label: 'Spark Library',
    },
  ], []);

  // Filter tabs based on conditions
  const visibleTabs = useMemo(() => {
    return allTabs.filter(tab => {
      if (tab.conditional && tab.key === 'coach') {
        return hasCoach;
      }
      return true;
    });
  }, [allTabs, hasCoach]);

  // Check for active coach relationships
  const checkCoachRelationships = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-coach-client-meta')
        .select(`
          id,
          coach_id,
          is_primary,
          status,
          coach_role
        `)
        .eq('client_id', user.id)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching coach relationships:', error);
        return;
      }

      const relationships = data || [];
      setCoachRelationships(relationships);
      setHasCoach(relationships.length > 0);

    } catch (err) {
      console.error('Error checking coach relationships:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      await checkCoachRelationships();
      setLoading(false);
    };

    initializePage();
  }, [checkCoachRelationships]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkCoachRelationships();
    setRefreshing(false);
  }, [checkCoachRelationships]);

  // Tab change handler
  const handleTabChange = useCallback((tabKey: TabKey) => {
    setActiveTab(tabKey);
  }, []);

  // Render tab content
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'vision':
        return <MyVisionTab onRefresh={handleRefresh} />;
      case 'coach':
        return hasCoach ? (
          <CoachsCornerTab 
            relationships={coachRelationships} 
            onRefresh={handleRefresh} 
          />
        ) : null;
      case 'sparks':
        return <SparkLibraryTab onRefresh={handleRefresh} />;
      default:
        return <MyVisionTab onRefresh={handleRefresh} />;
    }
  }, [activeTab, hasCoach, coachRelationships, handleRefresh]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
        <SettingsSidebar
          visible={settingsSidebarVisible}
          onClose={() => setSettingsSidebarVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Universal Header - same as Dashboard */}
      <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />

      {/* Tab Bar - Simple text tabs like Dashboard */}
      <View style={styles.subHeaderContainer}>
        <View style={styles.tabsRow}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.subTab,
                  isActive && styles.subTabActive,
                ]}
                onPress={() => handleTabChange(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.subTabText,
                    isActive && styles.subTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>

      {/* Settings Sidebar - same as Dashboard */}
      <SettingsSidebar
        visible={settingsSidebarVisible}
        onClose={() => setSettingsSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },

  // Sub-header tabs - matching Dashboard style exactly
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
  subTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  subTabActive: {
    backgroundColor: '#0078d4',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  subTabTextActive: {
    color: '#ffffff',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
});