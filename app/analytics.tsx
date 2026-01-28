import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, BarChart3, TrendingUp, Award, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';

export default function Analytics() {
  const router = useRouter();
  const { colors } = useTheme();
  const { authenticScore } = useAuthenticScore();

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Score Hero Section */}
        <View style={[styles.scoreHero, { backgroundColor: colors.primary }]}>
          <Text style={styles.scoreLabel}>Your Authentic Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
          <Text style={styles.scoreSubtext}>Keep investing in what matters most</Text>
        </View>

        {/* Placeholder Cards */}
        <View style={styles.placeholderSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Coming Soon</Text>
          
          <View style={[styles.placeholderCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
              <TrendingUp size={24} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Score Trends</Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                Track how your Authentic Score changes over time
              </Text>
            </View>
          </View>

          <View style={[styles.placeholderCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#10b981' + '20' }]}>
              <BarChart3 size={24} color="#10b981" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Role Breakdown</Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                See your investment across different life roles
              </Text>
            </View>
          </View>

          <View style={[styles.placeholderCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#8b5cf6' + '20' }]}>
              <Award size={24} color="#8b5cf6" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Achievements</Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                Celebrate milestones and streaks
              </Text>
            </View>
          </View>

          <View style={[styles.placeholderCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#f59e0b' + '20' }]}>
              <Calendar size={24} color="#f59e0b" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Reports</Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                Review your weekly progress and patterns
              </Text>
            </View>
          </View>
        </View>

        {/* Motivational Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Analytics features are being developed to help you gain deeper insights into your authentic living journey.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  scoreHero: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  scoreSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
  },
  placeholderSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
});