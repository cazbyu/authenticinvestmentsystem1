import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Compass, Users, Sparkles, ChevronLeft } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useNorthStarVisit } from '@/hooks/NorthStarVisits';

// Tab Components
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

// Header colors - matching your existing red theme
const HEADER_COLORS = {
  background: '#B91C1C',
  text: '#FFFFFF',
  accent: '#FEE2E2',
};

export default function NorthStarPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { score } = useAuthenticScore();
  const { recordVisit } = useNorthStarVisit();
  
  // State
  const [activeTab, setActiveTab] = useState<TabKey>('vision');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCoach, setHasCoach] = useState(false);
  const [coachRelationships, setCoachRelationships] = useState<CoachRelationship[]>([]);

  // Record visit on mount
  useEffect(() => {
    recordVisit('full_page');
  }, []);

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
      conditional: true,
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: HEADER_COLORS.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER_COLORS.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={HEADER_COLORS.text} />
          <Text style={[styles.loadingText, { color: HEADER_COLORS.accent }]}>
            Loading North Star...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: HEADER_COLORS.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_COLORS.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: HEADER_COLORS.background }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={handleBack} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={HEADER_COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: HEADER_COLORS.text }]}>
              North Star
            </Text>
            <Text style={[styles.headerSubtitle, { color: HEADER_COLORS.accent }]}>
              Your Strategic Foundation
            </Text>
          </View>

          {/* Authentic Score Badge */}
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreLabel, { color: HEADER_COLORS.accent }]}>Score</Text>
            <Text style={[styles.scoreValue, { color: HEADER_COLORS.text }]}>{score}</Text>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabContainer}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const IconComponent = tab.icon;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  isActive && styles.tabButtonActive,
                ]}
                onPress={() => handleTabChange(tab.key)}
                activeOpacity={0.7}
              >
                <IconComponent 
                  size={18} 
                  color={isActive ? HEADER_COLORS.text : HEADER_COLORS.accent} 
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? HEADER_COLORS.text : HEADER_COLORS.accent },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content Area */}
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={HEADER_COLORS.background}
            />
          }
        >
          {renderTabContent()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
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
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Tab Bar
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
});