import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getDayDateRange,
  fetchDailyAggregationData,
} from '@/lib/weeklyReflectionData';
import RichTextInput from './RichTextInput';
import RichTextDisplay from './RichTextDisplay';
import { DailyAggregationData, Reflection } from '@/types/reflections';
import { Save, Target, Users, Activity, AlertCircle, X } from 'lucide-react-native';

export default function DailyNotesView() {
  const { colors } = useTheme();
  const [dayRange, setDayRange] = useState(getDayDateRange());
  const [aggregationData, setAggregationData] = useState<DailyAggregationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [questionProud, setQuestionProud] = useState('');
  const [questionImpact, setQuestionImpact] = useState('');
  const [questionProgress, setQuestionProgress] = useState('');
  const [questionWithdrawals, setQuestionWithdrawals] = useState('');



  const [previousNotes, setPreviousNotes] = useState<Reflection[]>([]);
  const [selectedNote, setSelectedNote] = useState<Reflection | null>(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);

  const [currentReflection, setCurrentReflection] = useState<Reflection | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      archiveOldReflections();

      await Promise.all([
        fetchDailyData(),
        fetchCurrentReflection(),
        fetchPreviousNotes(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const archiveOldReflections = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.rpc('archive_old_reflections', { p_user_id: user.id });
    } catch (error) {
      console.error('Error archiving reflections:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchDailyData = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[DailyNotes] No user found');
      return;
    }

    const range = getDayDateRange();
    setDayRange(range);

    console.log('[DailyNotes] Fetching data for date range:', {
      start: range.start,
      end: range.end,
      dateOnly: range.start.split('T')[0],
      userId: user.id,
    });

    const data = await fetchDailyAggregationData(user.id, range.start, range.end);

    console.log('[DailyNotes] Data fetched:', {
      goalSummaries: data.goalSummaries.length,
      roleInvestments: data.roleInvestments.length,
      domainBalance: data.domainBalance.length,
      totalWithdrawals: data.totalWithdrawals,
    });

    if (data.goalSummaries.length === 0 && data.roleInvestments.length === 0) {
      console.warn('[DailyNotes] No data returned - check if tasks are completed today');
    }

    setAggregationData(data);
  };

  const fetchCurrentReflection = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('reflection_type', 'daily')
      .eq('date', today)
      .maybeSingle();

    if (!error && data) {
      setCurrentReflection(data);
      setQuestionProud(data.question_proud || '');
      setQuestionImpact(data.question_impact || '');
      setQuestionProgress(data.question_progress || '');
      setQuestionWithdrawals(data.question_withdrawals || '');
    }
  };


  const fetchPreviousNotes = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('reflection_type', 'daily')
      .eq('archived', false)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(7);

    if (!error && data) {
      setPreviousNotes(data);
    }
  };

  const handleSave = async () => {
    if (!questionProud && !questionImpact && !questionProgress && !questionWithdrawals) {
      Alert.alert('Error', 'Please answer at least one reflective question');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const today = new Date().toISOString().split('T')[0];
      let reflectionId = currentReflection?.id;

      if (currentReflection) {
        const { error } = await supabase
          .from('0008-ap-reflections')
          .update({
            question_proud: questionProud,
            question_impact: questionImpact,
            question_progress: questionProgress,
            question_withdrawals: questionWithdrawals,
            weekly_target_completion: 0,
            total_goals_tracked: aggregationData?.goalSummaries.length || 0,
          })
          .eq('id', currentReflection.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('0008-ap-reflections')
          .insert({
            user_id: user.id,
            reflection_type: 'daily',
            date: today,
            week_start_date: null,
            week_end_date: null,
            content: '',
            question_proud: questionProud,
            question_impact: questionImpact,
            question_progress: questionProgress,
            question_withdrawals: questionWithdrawals,
            weekly_target_completion: 0,
            total_goals_tracked: aggregationData?.goalSummaries.length || 0,
            authentic_score: 0,
          })
          .select()
          .single();

        if (error) throw error;
        reflectionId = data.id;
        setCurrentReflection(data);
      }


      Alert.alert('Success', 'Daily reflection saved successfully');
      fetchPreviousNotes();
    } catch (error) {
      console.error('Error saving reflection:', error);
      Alert.alert('Error', 'Failed to save reflection');
    } finally {
      setSaving(false);
    }
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrentDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.content}>
        <Text style={[styles.weekTitle, { color: colors.text }]}>
          Daily Reflection - {formatCurrentDate()}
        </Text>

        {aggregationData && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Target size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Leading Indicators Review</Text>
              </View>

              {aggregationData.goalSummaries.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You completed no actions towards your goals today.
                </Text>
              ) : (
                <View style={styles.goalsList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    Today, you completed {aggregationData.goalSummaries.reduce((sum, g) => sum + g.action_count, 0)} {aggregationData.goalSummaries.reduce((sum, g) => sum + g.action_count, 0) === 1 ? 'action' : 'actions'} towards {aggregationData.goalSummaries.length} {aggregationData.goalSummaries.length === 1 ? 'goal' : 'goals'}.
                  </Text>
                  {aggregationData.goalSummaries.map(goal => (
                    <Text key={goal.goal_id} style={[styles.goalText, { color: colors.text }]}>
                      For your goal to {goal.goal_title}, you completed {goal.action_count} {goal.action_count === 1 ? 'action' : 'actions'}.
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Users size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Role Investment Summary</Text>
              </View>

              {aggregationData.roleInvestments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You invested in no roles today.
                </Text>
              ) : (
                <View style={styles.rolesList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You invested in the following roles today:
                  </Text>
                  {aggregationData.roleInvestments.map(role => (
                    <Text key={role.role_id} style={[styles.roleText, { color: colors.text }]}>
                      • {role.role_label}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Activity size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Wellness Domain Balance</Text>
              </View>

              {aggregationData.domainBalance.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You invested in no wellness domains today.
                </Text>
              ) : (
                <View style={styles.domainsList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You have invested in the following domains today:
                  </Text>
                  {aggregationData.domainBalance.map(domain => (
                    <Text key={domain.domain_id} style={[styles.domainText, { color: colors.text }]}>
                      • {domain.domain_name}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <AlertCircle size={24} color={aggregationData.totalWithdrawals > 0 ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Withdrawals and Lessons</Text>
              </View>

              {aggregationData.totalWithdrawals === 0 ? (
                <Text style={[styles.successText, { color: '#10b981' }]}>
                  You made no withdrawals today.
                </Text>
              ) : (
                <View>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You made {aggregationData.totalWithdrawals} {aggregationData.totalWithdrawals === 1 ? 'withdrawal' : 'withdrawals'} today{aggregationData.withdrawalRoles.length > 0 || aggregationData.withdrawalDomains.length > 0 ? ' in the following:' : '.'}
                  </Text>
                  {aggregationData.withdrawalRoles.length > 0 && (
                    <View>
                      <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                        Roles:
                      </Text>
                      <View style={styles.withdrawalsList}>
                        {aggregationData.withdrawalRoles.map((role, index) => (
                          <Text key={index} style={[styles.withdrawalText, { color: colors.text }]}>
                            • {role.role_label} ({role.count})
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {aggregationData.withdrawalDomains.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                        Domains:
                      </Text>
                      <View style={styles.withdrawalsList}>
                        {aggregationData.withdrawalDomains.map((domain, index) => (
                          <Text key={index} style={[styles.withdrawalText, { color: colors.text }]}>
                            • {domain.domain_name} ({domain.count})
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Reflective Questions</Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                saving && { backgroundColor: colors.textSecondary }
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={16} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.questionsContainer}>
            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                What were you most proud of today?
              </Text>
              <RichTextInput
                value={questionProud}
                onChangeText={setQuestionProud}
                placeholder="Reflect on your achievements..."
                minHeight={100}
              />
            </View>

            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                Which deposits had the biggest impact?
              </Text>
              <RichTextInput
                value={questionImpact}
                onChangeText={setQuestionImpact}
                placeholder="Consider your most meaningful activities..."
                minHeight={100}
              />
            </View>

            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                What progress did you make towards your goals?
              </Text>
              <RichTextInput
                value={questionProgress}
                onChangeText={setQuestionProgress}
                placeholder="Evaluate your goal progress..."
                minHeight={100}
              />
            </View>

            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                What were my biggest withdrawals and how can I prevent similar withdrawals tomorrow?
              </Text>
              <RichTextInput
                value={questionWithdrawals}
                onChangeText={setQuestionWithdrawals}
                placeholder="Learn from challenges..."
                minHeight={100}
              />
            </View>
          </View>
        </View>


        {previousNotes.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Daily Reflections</Text>

            <View style={styles.notesList}>
              {previousNotes.map(note => (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.noteCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedNote(note);
                    setIsViewModalVisible(true);
                  }}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteDate, { color: colors.text }]}>
                      {formatDate(note.date)}
                    </Text>
                    <Text style={[styles.noteScore, { color: colors.primary }]}>
                      Score: {note.authentic_score}
                    </Text>
                  </View>
                  <Text
                    style={[styles.notePreview, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {note.question_proud?.substring(0, 80) || 'No content'}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      <Modal visible={isViewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedNote && formatDate(selectedNote.date)}
            </Text>
            <TouchableOpacity onPress={() => setIsViewModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedNote && (
              <View>
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    What were you most proud of?
                  </Text>
                  <RichTextDisplay content={selectedNote.question_proud || 'No response'} />
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    Which deposits had the biggest impact?
                  </Text>
                  <RichTextDisplay content={selectedNote.question_impact || 'No response'} />
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    What progress did you make?
                  </Text>
                  <RichTextDisplay content={selectedNote.question_progress || 'No response'} />
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    Withdrawals and lessons learned
                  </Text>
                  <RichTextDisplay content={selectedNote.question_withdrawals || 'No response'} />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  goalsList: {
    gap: 12,
  },
  goalItem: {
    gap: 6,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  goalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalStats: {
    fontSize: 12,
    minWidth: 50,
  },
  rolesList: {
    gap: 12,
  },
  roleItem: {
    gap: 4,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  depositText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  domainsList: {
    gap: 8,
  },
  domainItem: {},
  domainText: {
    fontSize: 14,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  withdrawalsList: {
    gap: 6,
    marginTop: 8,
  },
  withdrawalText: {
    fontSize: 14,
  },
  questionsContainer: {
    gap: 24,
  },
  questionField: {
    gap: 8,
  },
  questionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  checkboxItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesList: {
    gap: 12,
    marginTop: 12,
  },
  noteCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  noteScore: {
    fontSize: 12,
    fontWeight: '500',
  },
  notePreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
});
