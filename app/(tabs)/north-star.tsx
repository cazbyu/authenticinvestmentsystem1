import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Compass, Users, Sparkles, ChevronLeft } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';

// To (matching your existing folder):
import { MyVisionTab } from '@/components/northStar/MyVisionTab';
import { CoachsCornerTab } from '@/components/northStar/CoachsCornerTab';
import { SparkLibraryTab } from '@/components/northStar/SparkLibraryTab';

// Types
type TabKey = 'vision' | 'coach' | 'sparks';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
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
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { score } = useAuthenticScore();
  
  // State
  const [activeTab, setActiveTab] = useState<TabKey>('vision');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCoach, setHasCoach] = useState(false);
  const [coachRelationships, setCoachRelationships] = useState<CoachRelationship[]>([]);

  // Tab configuration
  const allTabs: TabConfig[] = useMemo(() => [
    {
      key: 'vision',
      label: 'My Vision',
      icon: Compass,
    },
    {
      key: 'coach',
      label: "Coach's Corner",
      icon: Users,
      conditional: true, // Only show if hasCoach is true
    },
    {
      key: 'sparks',
      label: 'Spark Library',
      icon: Sparkles,
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

      // Query coach-client-meta for active relationships where user is the client
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

  // Navigation
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading North Star...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            North Star
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Your Strategic Foundation
          </Text>
        </View>

        {/* Authentic Score Badge */}
        <View style={[styles.scoreBadge, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
            {score ?? 0}
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface }]}>
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const IconComponent = tab.icon;
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive && [styles.tabActive, { borderBottomColor: theme.colors.primary }],
              ]}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <IconComponent 
                size={20} 
                color={isActive ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
});