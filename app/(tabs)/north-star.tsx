import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useNorthStarData } from '@/hooks/useNorthStarData';
import { useNorthStarVisit } from '@/hooks/useNorthStarVisit';
import { DraggableFab } from '@/components/ui/DraggableFab';

// Tab type
type NorthStarTab = 'actions' | 'ideas' | 'journal' | 'analytics';

// Header colors - Red theme for NorthStar
const HEADER_COLORS = {
  background: '#B91C1C', // Red-700
  text: '#FFFFFF',
  accent: '#FEE2E2', // Red-100
};

export default function NorthStarPage() {
  const { colors } = useTheme();
  const router = useRouter();
  const { score } = useAuthenticScore();
  const { recordVisit } = useNorthStarVisit();
  const {
    core,
    activeGoals,
    completedGoals,
    powerQuotes,
    powerQuestions,
    isLoading,
    refreshData,
  } = useNorthStarData();

  const [activeTab, setActiveTab] = useState<NorthStarTab>('actions');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Record visit on mount
  useEffect(() => {
    recordVisit('full_page');
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  }, [refreshData]);

  const handleBack = () => {
    router.back();
  };

  const handleFabPress = () => {
    // Open create form based on active tab
    switch (activeTab) {
      case 'actions':
        // Open 1-Year Goal creation modal
        router.push('/goals/create-1y-goal');
        break;
      case 'ideas':
        // Open deposit idea form
        break;
      case 'journal':
        // Open power quote/question form
        break;
      default:
        break;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'actions':
        return <ActionsTab activeGoals={activeGoals} completedGoals={completedGoals} />;
      case 'ideas':
        return <IdeasTab />;
      case 'journal':
        return <JournalTab quotes={powerQuotes} questions={powerQuestions} />;
      case 'analytics':
        return <AnalyticsTab />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: HEADER_COLORS.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_COLORS.background} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: HEADER_COLORS.background }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={HEADER_COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Ionicons name="star" size={20} color="#C9A227" />
            <Text style={[styles.headerTitle, { color: HEADER_COLORS.text }]}>
              North Star
            </Text>
          </View>
          
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreLabel, { color: HEADER_COLORS.accent }]}>Score</Text>
            <Text style={[styles.scoreValue, { color: HEADER_COLORS.text }]}>{score}</Text>
          </View>
        </View>

        {/* Mission Preview */}
        {core?.life_motto && (
          <View style={styles.mottoContainer}>
            <Text style={styles.mottoText}>"{core.life_motto}"</Text>
          </View>
        )}

        {/* Tab Toggle */}
        <View style={styles.tabContainer}>
          {(['actions', 'ideas', 'journal', 'analytics'] as NorthStarTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? HEADER_COLORS.text : HEADER_COLORS.accent },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
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
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={HEADER_COLORS.background}
            />
          }
        >
          {renderTabContent()}
        </ScrollView>
      </View>

      {/* FAB */}
      {activeTab !== 'analytics' && (
        <DraggableFab
          onPress={handleFabPress}
          icon="add"
          color={HEADER_COLORS.background}
        />
      )}
    </SafeAreaView>
  );
}

// Actions Tab - 1-Year Goals
function ActionsTab({ 
  activeGoals, 
  completedGoals 
}: { 
  activeGoals: any[]; 
  completedGoals: any[];
}) {
  const { colors } = useTheme();
  const router = useRouter();

  if (activeGoals.length === 0 && completedGoals.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="flag-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No 1-Year Goals Yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Create your first campaign to start your journey toward your North Star.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Active Campaigns */}
      {activeGoals.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Active Campaigns ({activeGoals.length})
          </Text>
          {activeGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </View>
      )}

      {/* Completed Campaigns */}
      {completedGoals.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Completed ({completedGoals.length})
          </Text>
          {completedGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} isCompleted />
          ))}
        </View>
      )}
    </View>
  );
}

// Goal Card Component
function GoalCard({ goal, isCompleted = false }: { goal: any; isCompleted?: boolean }) {
  const { colors } = useTheme();
  
  const targetDate = goal.year_target_date 
    ? new Date(goal.year_target_date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      })
    : null;

  return (
    <TouchableOpacity 
      style={[
        styles.goalCard, 
        { 
          backgroundColor: colors.card,
          opacity: isCompleted ? 0.7 : 1,
        }
      ]}
    >
      <View style={styles.goalHeader}>
        <View style={[
          styles.goalStatus, 
          { backgroundColor: isCompleted ? '#10B981' : '#B91C1C' }
        ]} />
        <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={2}>
          {goal.title}
        </Text>
      </View>
      
      {goal.description && (
        <Text 
          style={[styles.goalDescription, { color: colors.textSecondary }]} 
          numberOfLines={2}
        >
          {goal.description}
        </Text>
      )}
      
      {targetDate && (
        <View style={styles.goalFooter}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.goalDate, { color: colors.textSecondary }]}>
            Target: {targetDate}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Ideas Tab - Placeholder
function IdeasTab() {
  const { colors } = useTheme();
  
  return (
    <View style={styles.placeholderContainer}>
      <Ionicons name="bulb-outline" size={64} color={colors.textSecondary} />
      <Text style={[styles.placeholderTitle, { color: colors.text }]}>
        Ideas Coming Soon
      </Text>
      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
        This is where your North Star-related ideas will live.
      </Text>
    </View>
  );
}

// Journal Tab - Power Quotes & Questions
function JournalTab({ 
  quotes, 
  questions 
}: { 
  quotes: any[]; 
  questions: any[];
}) {
  const { colors } = useTheme();

  if (quotes.length === 0 && questions.length === 0) {
    return (
      <View style={styles.placeholderContainer}>
        <Ionicons name="book-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>
          Inspirational Content
        </Text>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Add quotes and questions from your coach or create your own to inspire your journey.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {quotes.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Power Quotes ({quotes.length})
          </Text>
          {quotes.map((quote) => (
            <View key={quote.id} style={[styles.quoteCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.quoteText, { color: colors.text }]}>
                "{quote.quote_text}"
              </Text>
              {quote.attribution && (
                <Text style={[styles.quoteAttribution, { color: colors.textSecondary }]}>
                  — {quote.attribution}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {questions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Power Questions ({questions.length})
          </Text>
          {questions.map((question) => (
            <View key={question.id} style={[styles.questionCard, { backgroundColor: colors.card }]}>
              <Ionicons name="help-circle-outline" size={20} color="#B91C1C" />
              <Text style={[styles.questionText, { color: colors.text }]}>
                {question.question_text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Analytics Tab - Placeholder
function AnalyticsTab() {
  const { colors } = useTheme();
  
  return (
    <View style={styles.placeholderContainer}>
      <Ionicons name="analytics-outline" size={64} color={colors.textSecondary} />
      <Text style={[styles.placeholderTitle, { color: colors.text }]}>
        Analytics Coming Soon
      </Text>
      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
        Track your progress toward your North Star over time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  mottoContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  mottoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
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
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  goalCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  goalStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  goalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  goalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginLeft: 20,
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    marginLeft: 20,
  },
  goalDate: {
    fontSize: 12,
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  quoteCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  quoteAttribution: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});