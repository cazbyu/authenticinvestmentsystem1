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
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import JournalForm from '@/components/reflections/JournalForm';
import { useCoachNotifications } from '@/hooks/useCoachNotifications';

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

export default function NorthStarPage() {
  const router = useRouter();
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

      // Load Mission & Vision from existing table
      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('mission_text, vision_text')
        .eq('id', user.id)
        .single();

      if (userData) {
        setMissionText(userData.mission_text || '');
        setVisionText(userData.vision_text || '');
      }

      // Load Today's Spark
      await loadTodaysSpark(user.id, sparkType);
    } catch (error) {
      console.error('Error loading North Star data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodaysSpark = async (userId: string, type: 'quote' | 'question') => {
    const supabase = getSupabaseClient();
    const tableName = type === 'quote'
      ? '0008-ap-user-power-quotes'
      : '0008-ap-user-power-questions';

    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('show_in_spark', true)
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
      await loadTodaysSpark(user.id, newType);
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
        <TouchableOpacity
          onPress={() => router.push('/(sidebar)/north-star/spark-library')}
          style={styles.libraryButton}
        >
          <BookOpen size={20} color="#ed1c24" />
          <Text style={styles.libraryButtonText}>Spark Library</Text>
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
  libraryButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
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
