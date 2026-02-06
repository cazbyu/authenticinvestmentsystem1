import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import { GoalIcon } from '@/components/icons/CustomIcons';
import { getSupabaseClient } from '@/lib/supabase';
import {
  fetchPlannedActionsForWeek,
} from '@/hooks/fetchPlannedActionsforWeek';

const GOAL_BLUE = '#3B82F6';
const GOAL_BLUE_BORDER = '#3B82F640';

interface GoalAction {
  id: string;
  title: string;
  targetDays: number;
  actualDays: number;
  isComplete: boolean;
  type: 'leading' | 'boost';
}

interface Campaign {
  id: string;
  title: string;
  progress: number;
  goalType: '12week' | 'custom';
  actions: GoalAction[];
}

interface GoalCampaignsCardProps {
  userId: string;
  colors: any;
}

function getProgressColor(progress: number): string {
  if (progress >= 75) return '#10B981';
  if (progress >= 50) return '#3B82F6';
  if (progress >= 25) return '#F59E0B';
  return '#6B7280';
}

export default function GoalCampaignsCard({ userId, colors }: GoalCampaignsCardProps) {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      const supabase = getSupabaseClient();

      const [goals12Res, goalsCustomRes, plannedActions] = await Promise.all([
        supabase
          .from('0008-ap-goals-12wk')
          .select('id, title, status, progress')
          .eq('user_id', userId)
          .eq('status', 'active'),
        supabase
          .from('0008-ap-goals-custom')
          .select('id, title, status, progress')
          .eq('user_id', userId)
          .eq('status', 'active'),
        fetchPlannedActionsForWeek(),
      ]);

      const goals12 = (goals12Res.data || []).map((g) => ({
        ...g,
        goalType: '12week' as const,
      }));
      const goalsCustom = (goalsCustomRes.data || []).map((g) => ({
        ...g,
        goalType: 'custom' as const,
      }));
      const allGoals = [...goals12, ...goalsCustom];

      const actionsByGoal = new Map<string, GoalAction[]>();

      for (const li of plannedActions.leadingIndicators.actions) {
        if (li.goalId) {
          const list = actionsByGoal.get(li.goalId) || [];
          list.push({
            id: li.id,
            title: li.title,
            targetDays: li.targetDays,
            actualDays: li.actualDays,
            isComplete: li.actualDays >= li.targetDays,
            type: 'leading',
          });
          actionsByGoal.set(li.goalId, list);
        }
      }

      for (const ba of plannedActions.boostActions.actions) {
        if (ba.goalId) {
          const list = actionsByGoal.get(ba.goalId) || [];
          list.push({
            id: ba.id,
            title: ba.title,
            targetDays: 1,
            actualDays: ba.completed ? 1 : 0,
            isComplete: ba.completed,
            type: 'boost',
          });
          actionsByGoal.set(ba.goalId, list);
        }
      }

      const campaignList: Campaign[] = allGoals.map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.progress || 0,
        goalType: g.goalType,
        actions: actionsByGoal.get(g.id) || [],
      }));

      setCampaigns(campaignList);
    } catch (error) {
      console.error('Error loading goal campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const totalActions = campaigns.reduce((sum, c) => sum + c.actions.length, 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: GOAL_BLUE_BORDER }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <GoalIcon size={22} color={GOAL_BLUE} />
        <Text style={[styles.title, { color: colors.text, flex: 1 }]}>
          Goal Campaigns ({campaigns.length})
        </Text>
        {totalActions > 0 && (
          <Text style={[styles.actionCount, { color: GOAL_BLUE }]}>
            {totalActions} {totalActions === 1 ? 'action' : 'actions'}
          </Text>
        )}
        {expanded ? (
          <ChevronUp size={20} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={GOAL_BLUE}
              style={{ paddingVertical: 16 }}
            />
          ) : campaigns.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No active goal campaigns
            </Text>
          ) : (
            <>
              {campaigns.map((campaign) => {
                const isExpanded = expandedCampaigns[campaign.id] ?? false;
                const progressColor = getProgressColor(campaign.progress);
                return (
                  <View
                    key={campaign.id}
                    style={[styles.campaignCard, { borderColor: colors.border }]}
                  >
                    <TouchableOpacity
                      style={styles.campaignHeader}
                      onPress={() => toggleCampaign(campaign.id)}
                    >
                      <View style={styles.campaignTitleRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor:
                                campaign.goalType === '12week' ? '#3B82F620' : '#F59E0B20',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              {
                                color:
                                  campaign.goalType === '12week' ? '#3B82F6' : '#F59E0B',
                              },
                            ]}
                          >
                            {campaign.goalType === '12week' ? '12W' : 'Custom'}
                          </Text>
                        </View>
                        <Text
                          style={[styles.campaignTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {campaign.title}
                        </Text>
                      </View>

                      <View style={styles.campaignMeta}>
                        <View style={styles.progressRow}>
                          <View
                            style={[styles.progressBarBg, { backgroundColor: colors.border }]}
                          >
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  backgroundColor: progressColor,
                                  width: `${campaign.progress}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.progressText, { color: progressColor }]}>
                            {campaign.progress}%
                          </Text>
                        </View>
                        <View style={styles.campaignExpandRow}>
                          <Text
                            style={[styles.campaignActionCount, { color: colors.textSecondary }]}
                          >
                            {campaign.actions.length}{' '}
                            {campaign.actions.length === 1 ? 'action' : 'actions'}
                          </Text>
                          {isExpanded ? (
                            <ChevronUp size={16} color={colors.textSecondary} />
                          ) : (
                            <ChevronDown size={16} color={colors.textSecondary} />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && campaign.actions.length > 0 && (
                      <View
                        style={[styles.actionsContainer, { borderTopColor: colors.border }]}
                      >
                        {campaign.actions.map((action) => (
                          <View key={action.id} style={styles.actionRow}>
                            <View
                              style={[
                                styles.actionCheck,
                                action.isComplete
                                  ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                                  : { borderColor: colors.border },
                              ]}
                            >
                              {action.isComplete && <Check size={10} color="#FFFFFF" />}
                            </View>
                            <Text
                              style={[styles.actionTitle, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {action.title}
                            </Text>
                            <Text
                              style={[
                                styles.actionProgress,
                                {
                                  color: action.isComplete
                                    ? '#10B981'
                                    : colors.textSecondary,
                                },
                              ]}
                            >
                              {action.actualDays}/{action.targetDays}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {isExpanded && campaign.actions.length === 0 && (
                      <View
                        style={[styles.actionsContainer, { borderTopColor: colors.border }]}
                      >
                        <Text
                          style={[styles.noActionsText, { color: colors.textSecondary }]}
                        >
                          No supporting actions this week
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              <Text style={[styles.returnHint, { color: colors.textSecondary }]}>
                If you want to add supporting actions, return to Step 4
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  content: {
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  campaignCard: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  campaignHeader: {
    padding: 12,
  },
  campaignTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  campaignTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  campaignMeta: {
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  campaignExpandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  campaignActionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsContainer: {
    borderTopWidth: 1,
    padding: 10,
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  actionProgress: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
  noActionsText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },
  returnHint: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
});
