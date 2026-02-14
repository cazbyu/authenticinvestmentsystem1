import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { 
  FileText, 
  TrendingUp, 
  Target, 
  ChevronRight, 
  ChevronDown,
  Plus,
  Edit3,
  X,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

// Types
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
  core_values: string[];
}

interface MyVisionTabProps {
  onRefresh?: () => void;
}

export function MyVisionTab({ onRefresh }: MyVisionTabProps) {
  const router = useRouter();
  const { colors } = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [northStarData, setNorthStarData] = useState<NorthStarData | null>(null);
  const [oneYearGoals, setOneYearGoals] = useState<OneYearGoal[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editingField, setEditingField] = useState<'mission' | 'vision' | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch North Star data (Mission, Vision, Values)
  const fetchNorthStarData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, life_motto, core_values')
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
          core_values: data.core_values || [],
        });
      }
    } catch (err) {
      console.error('Error in fetchNorthStarData:', err);
    }
  }, []);

  // Fetch 1-Year Goals with nested campaigns
  const fetchOneYearGoals = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch 1-Year Goals
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

      // For each goal, fetch linked 12-Week and Custom campaigns
      const goalsWithCampaigns = await Promise.all(
        goals.map(async (goal) => {
          // Fetch 12-Week campaigns
          const { data: twelveCampaigns } = await supabase
            .from('0008-ap-goals-12wk')
            .select('id, title, status, progress, start_date, end_date')
            .eq('parent_goal_id', goal.id)
            .eq('parent_goal_type', '1y')
            .order('start_date', { ascending: false });

          // Fetch Custom campaigns (if parent linking exists)
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

          return {
            ...goal,
            campaigns,
          };
        })
      );

      setOneYearGoals(goalsWithCampaigns);
    } catch (err) {
      console.error('Error in fetchOneYearGoals:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchNorthStarData(), fetchOneYearGoals()]);
      setLoading(false);
    };
    loadData();
  }, [fetchNorthStarData, fetchOneYearGoals]);

  // Toggle goal expansion
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

  // Inline edit handlers
  const handleEditMission = useCallback(() => {
    setEditText(northStarData?.mission_statement?.trim() || '');
    setEditingField('mission');
  }, [northStarData]);

  const handleEditVision = useCallback(() => {
    setEditText(northStarData?.five_year_vision?.trim() || '');
    setEditingField('vision');
  }, [northStarData]);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditText('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingField || !editText.trim()) return;
    setSavingEdit(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fieldName = editingField === 'vision' ? '5yr_vision' : 'mission_statement';

      // First check if a row exists for this user
      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Row exists — UPDATE only the edited field (preserves other columns)
        const { error } = await supabase
          .from('0008-ap-north-star')
          .update({
            [fieldName]: editText.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // No row yet — INSERT with just this field
        const { error } = await supabase
          .from('0008-ap-north-star')
          .insert({
            user_id: user.id,
            [fieldName]: editText.trim(),
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Refresh data
      await fetchNorthStarData();
      setEditingField(null);
      setEditText('');
    } catch (error) {
      console.error('Error saving edit:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }, [editingField, editText, fetchNorthStarData]);

  const handleManageGoals = useCallback(() => {
    router.push('/(tabs)/goals');
  }, [router]);

  const handleAddGoal = useCallback(() => {
    router.push('/(tabs)/goals');
  }, [router]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#16a34a';
      case 'active':
        return '#0078d4';
      case 'paused':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B91C1C" />
      </View>
    );
  }

  const hasMission = northStarData?.mission_statement?.trim();
  const hasVision = northStarData?.five_year_vision?.trim();

  return (
    <View style={styles.container}>
      {/* Mission Statement Card */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <FileText size={20} color="#0078d4" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Mission Statement
            </Text>
          </View>
          {editingField !== 'mission' && (
            <TouchableOpacity 
              onPress={handleEditMission}
              style={[styles.editButton, { backgroundColor: colors.background }]}
            >
              <Edit3 size={14} color={colors.textSecondary} />
              <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {editingField === 'mission' ? (
          <View style={styles.inlineEditContainer}>
            <TextInput
              style={[styles.inlineEditInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              value={editText}
              onChangeText={setEditText}
              placeholder="My mission is to..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.inlineEditButtons}>
              <TouchableOpacity style={[styles.inlineEditCancel, { borderColor: colors.border }]} onPress={handleCancelEdit}>
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.inlineEditCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineEditSave, { backgroundColor: '#0078d4', opacity: editText.trim() ? 1 : 0.5 }]}
                onPress={handleSaveEdit}
                disabled={!editText.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" />
                    <Text style={styles.inlineEditSaveText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : hasMission ? (
          <Text 
            style={[styles.cardContent, { color: colors.text }]} 
            numberOfLines={6}
          >
            {northStarData.mission_statement}
          </Text>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Define your personal mission statement — your core purpose, values, and the impact you want to make.
            </Text>
            <TouchableOpacity 
              onPress={handleEditMission}
              style={styles.getStartedButton}
            >
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 5-Year Vision Card */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <TrendingUp size={20} color="#16a34a" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              5-Year Vision
            </Text>
          </View>
          {editingField !== 'vision' && (
            <TouchableOpacity 
              onPress={handleEditVision}
              style={[styles.editButton, { backgroundColor: colors.background }]}
            >
              <Edit3 size={14} color={colors.textSecondary} />
              <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {editingField === 'vision' ? (
          <View style={styles.inlineEditContainer}>
            <TextInput
              style={[styles.inlineEditInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              value={editText}
              onChangeText={setEditText}
              placeholder="In 5 years, I envision..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.inlineEditButtons}>
              <TouchableOpacity style={[styles.inlineEditCancel, { borderColor: colors.border }]} onPress={handleCancelEdit}>
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.inlineEditCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineEditSave, { backgroundColor: '#16a34a', opacity: editText.trim() ? 1 : 0.5 }]}
                onPress={handleSaveEdit}
                disabled={!editText.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" />
                    <Text style={styles.inlineEditSaveText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : hasVision ? (
          <Text 
            style={[styles.cardContent, { color: colors.text }]} 
            numberOfLines={6}
          >
            {northStarData.five_year_vision}
          </Text>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Paint a vivid picture of where you want to be in 5 years across personal growth, career, relationships, and lifestyle.
            </Text>
            <TouchableOpacity 
              onPress={handleEditVision}
              style={styles.getStartedButton}
            >
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 1-Year Goals Section */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Target size={20} color="#8b5cf6" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              1-Year Goals
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={handleAddGoal}
              style={styles.addButton}
            >
              <Plus size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleManageGoals}
              style={[styles.editButton, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>
                Manage
              </Text>
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
                      <Text 
                        style={[styles.goalTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {goal.title}
                      </Text>
                      
                      {hasCampaigns && (
                        <Text style={[styles.campaignCount, { color: colors.textSecondary }]}>
                          {completedCampaigns}/{goal.campaigns.length} campaigns
                        </Text>
                      )}
                      
                      {goal.year_target_date && (
                        <Text style={[styles.targetDate, { color: colors.textSecondary }]}>
                          Target: {new Date(goal.year_target_date).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric'
                          })}
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

                  {/* Expanded Campaigns */}
                  {isExpanded && hasCampaigns && (
                    <View style={styles.campaignsContainer}>
                      {goal.campaigns.map((campaign) => (
                        <View 
                          key={campaign.id} 
                          style={[
                            styles.campaignItem,
                            { backgroundColor: colors.background }
                          ]}
                        >
                          <View 
                            style={[
                              styles.campaignTypeBadge,
                              { 
                                backgroundColor: campaign.goal_type === '12wk' 
                                  ? '#dbeafe' 
                                  : '#fef3c7' 
                              }
                            ]}
                          >
                            <Text 
                              style={[
                                styles.campaignTypeText,
                                { 
                                  color: campaign.goal_type === '12wk' 
                                    ? '#1e40af' 
                                    : '#92400e' 
                                }
                              ]}
                            >
                              {campaign.goal_type === '12wk' ? '12-Week' : 'Custom'}
                            </Text>
                          </View>
                          
                          <Text 
                            style={[styles.campaignTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {campaign.title}
                          </Text>
                          
                          <View style={styles.campaignProgress}>
                            <View 
                              style={[
                                styles.progressBar,
                                { backgroundColor: colors.border }
                              ]}
                            >
                              <View 
                                style={[
                                  styles.progressFill,
                                  { 
                                    width: `${campaign.progress || 0}%`,
                                    backgroundColor: getStatusColor(campaign.status)
                                  }
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
            <TouchableOpacity 
              onPress={handleAddGoal}
              style={styles.getStartedButton}
            >
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

  // Card Styles
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
  cardContent: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Empty State
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

  // Goals List
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

  // Campaigns
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
  // Inline edit styles
  inlineEditContainer: {
    gap: 12,
  },
  inlineEditInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    lineHeight: 22,
  },
  inlineEditButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineEditCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineEditCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlineEditSave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  inlineEditSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});