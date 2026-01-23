import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { ChevronLeft, ChevronRight, Star, BookOpen, SquareCheck as CheckSquare, Calendar } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import JournalForm from '@/components/reflections/JournalForm';
import { useCoachNotifications } from '@/hooks/useCoachNotifications';
import { archiveOldSparkContent } from '@/lib/archiveSparkContent';

interface PowerContent {
  id: string;
  type: 'quote' | 'question';
  text: string;
  attribution?: string;
  source_type: 'self' | 'coach' | 'system';
  coach_id?: string;
}

const ACTION_ICONS = [
  { id: 'task', Icon: CheckSquare, label: 'Task', type: 'icon' },
  { id: 'event', Icon: Calendar, label: 'Event', type: 'icon' },
  { id: 'idea', image: require('@/assets/images/deposit-idea.png'), label: 'Idea', type: 'image' },
  { id: 'reflect', image: require('@/assets/images/reflections-72.png'), label: 'Reflect', type: 'image' },
  { id: 'rose', image: require('@/assets/images/rose-81.png'), label: 'Rose', type: 'image' },
  { id: 'thorn', image: require('@/assets/images/thorn-81.png'), label: 'Thorn', type: 'image' },
];

const getDomainDisplayName = (domain: string): string => {
  const names: { [key: string]: string } = {
    mission: 'Mission',
    wellness: 'Wellness',
    goals: 'Goals',
    roles: 'Roles',
  };
  return names[domain] || domain;
};

const getDomainIcon = (domain: string): string => {
  const icons: { [key: string]: string } = {
    mission: '⭐',
    wellness: '🌿',
    goals: '🎯',
    roles: '👥',
  };
  return icons[domain] || '📌';
};

export default function NorthStarPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const highlightDomain = params.domain as string | undefined;
  const shouldHighlight = params.highlight === 'true';

  const [loading, setLoading] = useState(true);
  const [currentSpark, setCurrentSpark] = useState<PowerContent | null>(null);
  const [sparkType, setSparkType] = useState<'quote' | 'question'>('quote');
  const [missionText, setMissionText] = useState('');
  const [visionText, setVisionText] = useState('');
  const [isTaskEventFormVisible, setIsTaskEventFormVisible] = useState(false);
  const [taskEventFormType, setTaskEventFormType] = useState<'task' | 'event' | 'depositIdea'>('task');
  const [isJournalFormVisible, setIsJournalFormVisible] = useState(false);
  const [journalFormType, setJournalFormType] = useState<'rose' | 'thorn' | 'reflection'>('reflection');
  const { notifications, markAsRead } = useCoachNotifications();
  const [activeDomain, setActiveDomain] = useState<string | null>(highlightDomain || null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadNorthStarData();
  }, []);

  useEffect(() => {
    markAsRead();
  }, []);

  const loadNorthStarData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      archiveOldSparkContent(user.id).catch(console.error);

      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('mission_text, vision_text')
        .eq('id', user.id)
        .single();

      if (userData) {
        setMissionText(userData.mission_text || '');
        setVisionText(userData.vision_text || '');
      }

      await loadTodaysSpark(user.id, sparkType, activeDomain || undefined);
    } catch (error) {
      console.error('Error loading North Star data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodaysSpark = async (
    userId: string,
    type: 'quote' | 'question',
    priorityDomain?: string
  ) => {
    const supabase = getSupabaseClient();
    const tableName = type === 'quote'
      ? '0008-ap-user-power-quotes'
      : '0008-ap-user-power-questions';

    let query = supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('show_in_spark', true);

    if (priorityDomain) {
      query = query.eq('domain', priorityDomain);
    }

    const { data } = await query
      .order('last_shown_at', { ascending: true, nullsFirst: true })
      .limit(1)
      .single();

    if (data) {
      setCurrentSpark({
        id: data.id,
        type,
        text: type === 'quote' ? data.quote_text : data.question_text,
        attribution: data.attribution,
        source_type: data.source_type,
        coach_id: data.coach_id,
      });

      // Update last_shown_at
      await supabase
        .from(tableName)
        .update({
          last_shown_at: new Date().toISOString(),
          times_shown: (data.times_shown || 0) + 1
        })
        .eq('id', data.id);
    } else {
      setCurrentSpark(null);
    }
  };

  const handleSparkTypeToggle = async (direction: 'left' | 'right') => {
    const newType = sparkType === 'quote' ? 'question' : 'quote';
    setSparkType(newType);

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadTodaysSpark(user.id, newType, activeDomain || undefined);
    }
  };

  const handleActionPress = (actionType: string) => {
    switch (actionType) {
      case 'task':
        setTaskEventFormType('task');
        setIsTaskEventFormVisible(true);
        break;
      case 'event':
        setTaskEventFormType('event');
        setIsTaskEventFormVisible(true);
        break;
      case 'idea':
        setTaskEventFormType('depositIdea');
        setIsTaskEventFormVisible(true);
        break;
      case 'reflect':
        setJournalFormType('reflection');
        setIsJournalFormVisible(true);
        break;
      case 'rose':
        setJournalFormType('rose');
        setIsJournalFormVisible(true);
        break;
      case 'thorn':
        setJournalFormType('thorn');
        setIsJournalFormVisible(true);
        break;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ed1c24" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Section 1: Today's Spark */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Star size={24} color="#ed1c24" />
          <Text style={styles.sectionTitle}>Today's Spark</Text>
          {notifications.total > 0 && (
            <View style={styles.newContentBadge}>
              <Text style={styles.newContentBadgeText}>{notifications.total} New</Text>
            </View>
          )}
        </View>

        <View style={styles.sparkCard}>
          <View style={styles.sparkNavigation}>
            <TouchableOpacity
              onPress={() => handleSparkTypeToggle('left')}
              style={styles.sparkArrow}
            >
              <ChevronLeft size={24} color="#666" />
            </TouchableOpacity>

            <View style={styles.sparkContent}>
              {currentSpark ? (
                <>
                  <Text style={styles.sparkTypeLabel}>
                    {currentSpark.type === 'quote' ? '💭 Quote' : '💡 Question'}
                  </Text>
                  <Text style={styles.sparkText}>{currentSpark.text}</Text>
                  {currentSpark.attribution && (
                    <Text style={styles.sparkAttribution}>
                      — {currentSpark.attribution}
                    </Text>
                  )}
                  {currentSpark.source_type === 'coach' && (
                    <Text style={styles.coachBadge}>From Your Coach</Text>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>
                  No {sparkType}s yet. Add one below to get started!
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleSparkTypeToggle('right')}
              style={styles.sparkArrow}
            >
              <ChevronRight size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Domain Filter Display */}
          {activeDomain && (
            <View style={styles.domainFilterContainer}>
              <Text style={styles.domainFilterLabel}>
                Showing: {getDomainDisplayName(activeDomain)}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setActiveDomain(null);
                  if (userId) {
                    loadTodaysSpark(userId, sparkType, undefined);
                  }
                }}
                style={styles.clearFilterButton}
              >
                <Text style={styles.clearFilterText}>Show All</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons - Same 6 icons from Spark Modal */}
          <View style={styles.actionButtonsContainer}>
            <Text style={styles.actionLabel}>Take Action:</Text>
            <View style={styles.actionsRow}>
              {ACTION_ICONS.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionButton}
                  onPress={() => handleActionPress(action.id)}
                >
                  <View style={styles.actionIconCircle}>
                    {action.type === 'image' ? (
                      <Image
                        source={action.image}
                        style={styles.actionIconImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <action.Icon size={20} color="#ed1c24" />
                    )}
                  </View>
                  <Text style={styles.actionButtonLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Domain Filter Chips */}
          <View style={styles.domainChipsContainer}>
            <Text style={styles.domainChipsLabel}>Filter by domain:</Text>
            <View style={styles.domainChips}>
              {['mission', 'wellness', 'goals', 'roles'].map((domain) => (
                <TouchableOpacity
                  key={domain}
                  onPress={() => {
                    const newDomain = activeDomain === domain ? null : domain;
                    setActiveDomain(newDomain);
                    if (userId) {
                      loadTodaysSpark(userId, sparkType, newDomain || undefined);
                    }
                  }}
                  style={[
                    styles.domainChip,
                    activeDomain === domain && styles.domainChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.domainChipText,
                      activeDomain === domain && styles.domainChipTextActive,
                    ]}
                  >
                    {getDomainIcon(domain)} {getDomainDisplayName(domain)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Section 2: Your Foundation */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Foundation</Text>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.foundationCard}>
          <Text style={styles.foundationLabel}>Mission</Text>
          {missionText ? (
            <Text style={styles.foundationText}>{missionText}</Text>
          ) : (
            <Text style={styles.emptyText}>Define your mission in Settings</Text>
          )}
        </View>

        <View style={styles.foundationCard}>
          <Text style={styles.foundationLabel}>Vision</Text>
          {visionText ? (
            <Text style={styles.foundationText}>{visionText}</Text>
          ) : (
            <Text style={styles.emptyText}>Define your vision in Settings</Text>
          )}
        </View>
      </View>

      {/* Section 3: Power Collection Preview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <BookOpen size={20} color="#666" />
          <Text style={styles.sectionTitle}>Power Collection</Text>
        </View>
        <Text style={styles.comingSoonText}>
          Your curated quotes and questions (Coming soon)
        </Text>
      </View>

      {/* Section 4: Libraries */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Libraries</Text>

        <TouchableOpacity
          onPress={() => router.push('/(sidebar)/north-star/spark-library')}
          style={styles.libraryButton}
        >
          <BookOpen size={20} color="#ed1c24" />
          <View style={styles.libraryButtonContent}>
            <Text style={styles.libraryButtonText}>Spark Library</Text>
            <Text style={styles.libraryButtonSubtext}>
              Your archived quotes & questions by month
            </Text>
          </View>
          <ChevronRight size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <Modal
        visible={isTaskEventFormVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsTaskEventFormVisible(false)}
      >
        <TaskEventForm
          mode="create"
          preSelectedType={taskEventFormType}
          onSubmitSuccess={() => setIsTaskEventFormVisible(false)}
          onClose={() => setIsTaskEventFormVisible(false)}
        />
      </Modal>

      <JournalForm
        visible={isJournalFormVisible}
        mode="create"
        reflectionType={journalFormType}
        onClose={() => setIsJournalFormVisible(false)}
        onSaveSuccess={() => setIsJournalFormVisible(false)}
      />
    </ScrollView>
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
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  sparkCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  sparkNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparkArrow: {
    padding: 8,
  },
  sparkContent: {
    flex: 1,
    alignItems: 'center',
  },
  sparkTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  sparkText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  sparkAttribution: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  coachBadge: {
    fontSize: 12,
    color: '#ed1c24',
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionButtonsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    width: 60,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ed1c24',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  actionIconImage: {
    width: 28,
    height: 28,
  },
  actionButtonLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  domainFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  domainFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  domainChipsContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  domainChipsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  domainChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  domainChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  domainChipActive: {
    backgroundColor: '#ed1c24',
    borderColor: '#ed1c24',
  },
  domainChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  domainChipTextActive: {
    color: '#fff',
  },
  foundationCard: {
    marginBottom: 16,
  },
  foundationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  foundationText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  comingSoonText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  libraryButtonContent: {
    flex: 1,
  },
  libraryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  libraryButtonSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  newContentBadge: {
    backgroundColor: '#ed1c24',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newContentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
