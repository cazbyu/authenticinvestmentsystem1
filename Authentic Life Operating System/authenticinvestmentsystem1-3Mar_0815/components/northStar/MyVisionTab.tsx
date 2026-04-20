import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import {
  Target,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { VisionBlock } from '@/components/common/VisionBlock';
import { toLocalISOString } from '@/lib/dateUtils';

interface OneYearGoal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  year_target_date: string | null;
  priority: number;
  campaigns: Campaign[];
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  goal_type: '12wk' | 'custom';
  progress: number;
  start_date: string | null;
  end_date: string | null;
}

interface NorthStarData {
  mission_statement: string | null;
  five_year_vision: string | null;
  life_motto: string | null;
}

interface UserValue {
  id: string;
  value_word: string;
  sort_order: number | null;
}

interface MyVisionTabProps {
  onRefresh?: () => void;
}

const MAX_VALUES = 7;
const NORTH_STAR_ACCENT = '#8b0000';

export function MyVisionTab({ onRefresh }: MyVisionTabProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [northStarData, setNorthStarData] = useState<NorthStarData | null>(null);
  const [oneYearGoals, setOneYearGoals] = useState<OneYearGoal[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [userValues, setUserValues] = useState<UserValue[]>([]);
  const [valueInput, setValueInput] = useState('');
  const [addingValue, setAddingValue] = useState(false);

  const fetchNorthStarData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, life_motto')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching North Star:', error);
        return;
      }

      if (data) {
        setNorthStarData({
          mission_statement: data.mission_statement,
          five_year_vision: data['5yr_vision'],
          life_motto: data.life_motto,
        });
      } else {
        setNorthStarData({
          mission_statement: null,
          five_year_vision: null,
          life_motto: null,
        });
      }
    } catch (err) {
      console.error('Error in fetchNorthStarData:', err);
    }
  }, []);

  const fetchUserValues = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-user-values')
        .select('id, value_word, sort_order')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching user values:', error);
        return;
      }

      setUserValues(data || []);
    } catch (err) {
      console.error('Error in fetchUserValues:', err);
    }
  }, []);

  const fetchOneYearGoals = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: goalsData, error: goalsError } = await supabase
        .from('0008-ap-goals-1y')
        .select('id, title, description, status, year_target_date, priority')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: true });

      if (goalsError) {
        console.error('Error fetching 1Y goals:', goalsError);
        return;
      }

      const goals = goalsData || [];

      const goalsWithCampaigns = await Promise.all(
        goals.map(async (goal) => {
          const { data: twelveCampaigns } = await supabase
            .from('0008-ap-goals-12wk')
            .select('id, title, status, progress, start_date, end_date')
            .eq('parent_goal_id', goal.id)
            .eq('parent_goal_type', '1y')
            .order('start_date', { ascending: false });

          const { data: customCampaigns } = await supabase
            .from('0008-ap-goals-custom')
            .select('id, title, status, progress, start_date, end_date')
            .eq('parent_goal_id', goal.id)
            .eq('parent_goal_type', '1y')
            .order('start_date', { ascending: false });

          const campaigns: Campaign[] = [
            ...(twelveCampaigns || []).map(c => ({ ...c, goal_type: '12wk' as const })),
            ...(customCampaigns || []).map(c => ({ ...c, goal_type: 'custom' as const })),
          ];

          return { ...goal, campaigns };
        })
      );

      setOneYearGoals(goalsWithCampaigns);
    } catch (err) {
      console.error('Error in fetchOneYearGoals:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchNorthStarData(),
        fetchOneYearGoals(),
        fetchUserValues(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchNorthStarData, fetchOneYearGoals, fetchUserValues]);

  const toggleGoalExpansion = useCallback((goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  }, []);

  const saveNorthStarField = useCallback(async (field: string, value: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('0008-ap-north-star')
          .update({
            [field]: value,
            updated_at: toLocalISOString(new Date()),
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({
            user_id: user.id,
            [field]: value,
            updated_at: toLocalISOString(new Date()),
          });
      }

      await fetchNorthStarData();
    } catch (error) {
      console.error('Error saving north star field:', error);
    }
  }, [fetchNorthStarData]);

  const handleAddValue = useCallback(async () => {
    const trimmed = valueInput.trim();
    if (!trimmed) return;
    if (userValues.length >= MAX_VALUES) return;

    setAddingValue(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nextSortOrder = userValues.length > 0
        ? Math.max(...userValues.map(v => v.sort_order ?? 0)) + 1
        : 1;

      const { error } = await supabase
        .from('0008-ap-user-values')
        .insert({
          user_id: user.id,
          value_word: trimmed,
          sort_order: nextSortOrder,
          is_active: true,
        });

      if (error) {
        console.error('Error adding user value:', error);
        Alert.alert('Error', 'Failed to add value. Please try again.');
        return;
      }

      setValueInput('');
      await fetchUserValues();
    } catch (err) {
      console.error('Error in handleAddValue:', err);
    } finally {
      setAddingValue(false);
    }
  }, [valueInput, userValues, fetchUserValues]);

  const handleDeleteValue = useCallback(async (value: UserValue) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Remove "${value.value_word}" from core values?`)
      : true;
    if (!confirmed) return;

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('0008-ap-user-values')
        .update({ is_active: false })
        .eq('id', value.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting user value:', error);
        return;
      }

      await fetchUserValues();
    } catch (err) {
      console.error('Error in handleDeleteValue:', err);
    }
  }, [fetchUserValues]);

  const handleManageGoals = useCallback(() => {
    router.push('/(tabs)/goals');
  }, [router]);

  const handleAddGoal = useCallback(() => {
    router.push('/(tabs)/goals');
  }, [router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#16a34a';
      case 'active': return '#0078d4';
      case 'paused': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={NORTH_STAR_ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mission Statement */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <VisionBlock
          label="Mission Statement"
          value={northStarData?.mission_statement ?? null}
          onSave={(text) => saveNorthStarField('mission_statement', text)}
          accentColor={NORTH_STAR_ACCENT}
          placeholder="What is your life's mission?"
        />
      </View>

      {/* 5-Year Vision */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <VisionBlock
          label="5-Year Vision"
          value={northStarData?.five_year_vision ?? null}
          onSave={(text) => saveNorthStarField('5yr_vision', text)}
          accentColor={NORTH_STAR_ACCENT}
          placeholder="Where will you be in 5 years?"
        />
      </View>

      {/* Life Motto */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <VisionBlock
          label="Life Motto"
          value={northStarData?.life_motto ?? null}
          onSave={(text) => saveNorthStarField('life_motto', text)}
          accentColor={NORTH_STAR_ACCENT}
          placeholder="The phrase that anchors your life..."
        />
      </View>

      {/* Core Values */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={styles.valuesHeader}>CORE VALUES</Text>
        {userValues.length === 0 ? (
          <Text style={styles.valuesEmpty}>Add your core values</Text>
        ) : (
          <View style={styles.valueChipsRow}>
            {userValues.map(v => (
              <View key={v.id} style={styles.valueChip}>
                <Text style={styles.valueChipText}>{v.value_word}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteValue(v)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  style={styles.valueChipRemove}
                >
                  <X size={12} color={NORTH_STAR_ACCENT} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {userValues.length < MAX_VALUES ? (
          <View style={styles.valueAddRow}>
            <TextInput
              value={valueInput}
              onChangeText={setValueInput}
              placeholder="Add a core value..."
              placeholderTextColor="#9ca3af"
              style={styles.valueAddInput}
              onSubmitEditing={handleAddValue}
              returnKeyType="done"
              maxLength={32}
              editable={!addingValue}
            />
            <TouchableOpacity
              onPress={handleAddValue}
              disabled={!valueInput.trim() || addingValue}
              style={[
                styles.valueAddButton,
                (!valueInput.trim() || addingValue) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.valueAddButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.valueCapText}>7 of 7 values added</Text>
        )}
      </View>

      {/* 1-Year Goals Section */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Target size={20} color="#8b5cf6" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>1-Year Goals</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleAddGoal} style={styles.addButton}>
              <Plus size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleManageGoals}
              style={[styles.editButton, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {oneYearGoals.length > 0 ? (
          <View style={styles.goalsList}>
            {oneYearGoals.map((goal, index) => {
              const isExpanded = expandedGoals.has(goal.id);
              const hasCampaigns = goal.campaigns.length > 0;
              const completedCampaigns = goal.campaigns.filter(c => c.status === 'completed').length;

              return (
                <View key={goal.id} style={styles.goalItem}>
                  <TouchableOpacity
                    style={styles.goalHeader}
                    onPress={() => hasCampaigns && toggleGoalExpansion(goal.id)}
                    activeOpacity={hasCampaigns ? 0.7 : 1}
                  >
                    <View style={styles.goalNumber}>
                      <Text style={styles.goalNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={2}>
                        {goal.title}
                      </Text>
                      {hasCampaigns && (
                        <Text style={[styles.campaignCount, { color: colors.textSecondary }]}>
                          {completedCampaigns}/{goal.campaigns.length} campaigns
                        </Text>
                      )}
                      {goal.year_target_date && (
                        <Text style={[styles.targetDate, { color: colors.textSecondary }]}>
                          Target: {new Date(goal.year_target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                    {hasCampaigns && (
                      <View style={styles.expandIcon}>
                        {isExpanded ? (
                          <ChevronDown size={20} color={colors.textSecondary} />
                        ) : (
                          <ChevronRight size={20} color={colors.textSecondary} />
                        )}
                      </View>
                    )}
                  </TouchableOpacity>

                  {isExpanded && hasCampaigns && (
                    <View style={styles.campaignsContainer}>
                      {goal.campaigns.map((campaign) => (
                        <View
                          key={campaign.id}
                          style={[styles.campaignItem, { backgroundColor: colors.background }]}
                        >
                          <View
                            style={[
                              styles.campaignTypeBadge,
                              { backgroundColor: campaign.goal_type === '12wk' ? '#dbeafe' : '#fef3c7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.campaignTypeText,
                                { color: campaign.goal_type === '12wk' ? '#1e40af' : '#92400e' },
                              ]}
                            >
                              {campaign.goal_type === '12wk' ? '12-Week' : 'Custom'}
                            </Text>
                          </View>
                          <Text style={[styles.campaignTitle, { color: colors.text }]} numberOfLines={1}>
                            {campaign.title}
                          </Text>
                          <View style={styles.campaignProgress}>
                            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                              <View
                                style={[
                                  styles.progressFill,
                                  {
                                    width: `${campaign.progress || 0}%`,
                                    backgroundColor: getStatusColor(campaign.status),
                                  },
                                ]}
                              />
                            </View>
                            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                              {campaign.progress || 0}%
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Set your top goals for the year that bridge your 5-year vision to daily actions.
            </Text>
            <TouchableOpacity onPress={handleAddGoal} style={styles.getStartedButton}>
              <Text style={styles.getStartedButtonText}>Add Your First Goal</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#8b5cf6',
  },

  emptyState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  getStartedButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#B91C1C',
  },
  getStartedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  valuesHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#8b0000',
    marginBottom: 10,
  },
  valuesEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#9ca3af',
    marginBottom: 12,
  },
  valueChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8b0000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ffffff',
  },
  valueChipText: {
    fontSize: 13,
    color: '#8b0000',
    fontWeight: '500',
  },
  valueChipRemove: {
    padding: 2,
  },
  valueAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueAddInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#1f2937',
  },
  valueAddButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8b0000',
    backgroundColor: '#ffffff',
  },
  valueAddButtonText: {
    fontSize: 13,
    color: '#8b0000',
    fontWeight: '600',
  },
  valueCapText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },

  goalsList: {
    gap: 12,
  },
  goalItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  goalNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  campaignCount: {
    fontSize: 12,
    marginBottom: 2,
  },
  targetDate: {
    fontSize: 12,
  },
  expandIcon: {
    padding: 4,
  },

  campaignsContainer: {
    marginLeft: 40,
    marginTop: 8,
    gap: 8,
  },
  campaignItem: {
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  campaignTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  campaignTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  campaignTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  campaignProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    width: 36,
    textAlign: 'right',
  },
});
