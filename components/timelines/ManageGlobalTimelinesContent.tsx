import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { TriangleAlert as AlertTriangle, Calendar, TrendingUp, Archive, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { InfoTooltip } from '@/components/InfoTooltip';
import { getSupabaseClient } from '@/lib/supabase';
import { formatDateRange, parseLocalDate, toLocalISOString } from '@/lib/dateUtils';

const formatDateDisplay = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface GlobalCycle {
  id: string;
  title?: string;
  start_date: string;
  end_date: string;
  reflection_start: string;
  reflection_end: string;
  status: string;
  cycle_position: 'active' | '2nd_in_line' | '3rd_in_line' | '4th_in_line' | 'archived' | 'future';
  can_activate: boolean;
  previous_cycle_reflection_start?: string;
}

interface UserGlobalTimeline {
  id: string;
  user_id: string;
  global_cycle_id: string;
  status: string;
  week_start_day: string;
  activated_at: string;
  created_at: string;
  updated_at: string;
  global_cycle: GlobalCycle;
  goals?: Array<{ id: string; status: string }>;
}

interface ActiveTimelineWithCycle extends UserGlobalTimeline {
  isAlreadyActivated?: boolean;
  isCurrent?: boolean;
}

interface ManageGlobalTimelinesContentProps {
  onUpdate?: () => void;
}

export function ManageGlobalTimelinesContent({ onUpdate }: ManageGlobalTimelinesContentProps) {
  const [activeTimelines, setActiveTimelines] = useState<UserGlobalTimeline[]>([]);
  const [availableCycles, setAvailableCycles] = useState<ActiveTimelineWithCycle[]>([]);
  const [pastTimelines, setPastTimelines] = useState<UserGlobalTimeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showPastCycles, setShowPastCycles] = useState(false);

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveConfirmTimeline, setArchiveConfirmTimeline] = useState<UserGlobalTimeline | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmTimeline, setDeleteConfirmTimeline] = useState<UserGlobalTimeline | null>(null);

  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);
  const [timelineToDeactivate, setTimelineToDeactivate] = useState<UserGlobalTimeline | null>(null);

  const [showWeekStartModal, setShowWeekStartModal] = useState(false);
  const [selectedCycleToActivate, setSelectedCycleToActivate] = useState<GlobalCycle | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTimelines.length >= 0) {
      fetchAvailableCycles();
    }
  }, [activeTimelines.length]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await fetchActiveTimeline();
      await fetchPastTimelines();
      await fetchAvailableCycles();
    } catch (error) {
      console.error('[ManageGlobalTimelinesContent] Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTimeline = async (retryCount = 0) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[ManageGlobalTimelinesContent] No authenticated user found');
        return;
      }

      const { data, error } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          id,
          user_id,
          global_cycle_id,
          status,
          week_start_day,
          activated_at,
          created_at,
          updated_at,
          global_cycle:0008-ap-global-cycles!inner(
            id,
            title,
            start_date,
            end_date,
            reflection_start,
            reflection_end,
            status
          ),
          goals:0008-ap-goals-12wk(id, status)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        if (retryCount < 1 && (error.message?.includes('network') || error.message?.includes('timeout'))) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchActiveTimeline(retryCount + 1);
        }
        throw error;
      }

      const now = new Date();
      const timelinesData = Array.isArray(data) ? data : [];

      // Filter to only show timelines that haven't ended yet
      const currentTimelines = timelinesData.filter(timeline => {
        const endDate = timeline.global_cycle?.end_date ? new Date(timeline.global_cycle.end_date) : null;
        return !endDate || endDate >= now;
      });

      setActiveTimelines(currentTimelines);
    } catch (error) {
      console.error('[ManageGlobalTimelinesContent] Error fetching active timelines:', error);
      if (retryCount === 0) {
        Alert.alert('Error Loading Timelines', 'Failed to load active timelines. Please try again.');
      }
    }
  };

  const fetchPastTimelines = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          id,
          user_id,
          global_cycle_id,
          status,
          week_start_day,
          activated_at,
          created_at,
          updated_at,
          global_cycle:0008-ap-global-cycles!inner(
            id,
            title,
            start_date,
            end_date,
            reflection_start,
            reflection_end,
            status
          ),
          goals:0008-ap-goals-12wk(id, status)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const pastTimelinesData = (data || []).filter(timeline => {
        const endDate = timeline.global_cycle?.end_date ? new Date(timeline.global_cycle.end_date) : null;
        return endDate && endDate < now;
      });

      setPastTimelines(pastTimelinesData);
    } catch (error) {
      console.error('[ManageGlobalTimelinesContent] Error fetching past timelines:', error);
    }
  };

  const fetchAvailableCycles = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cycleData, error } = await supabase
        .from('v_global_cycles')
        .select('*')
        .in('cycle_position', ['active', '2nd_in_line', '3rd_in_line', '4th_in_line'])
        .order('start_date', { ascending: true });

      if (error) throw error;

      const availableCyclesWithStatus: ActiveTimelineWithCycle[] = [];

      if (cycleData) {
        const activatedCycleIds = activeTimelines.map(t => t.global_cycle_id);

        cycleData.forEach(cycle => {
          const isAlreadyActivated = activatedCycleIds.includes(cycle.global_cycle_id);
          const isCurrent = cycle.cycle_position === 'active';

          availableCyclesWithStatus.push({
            ...cycle,
            id: cycle.global_cycle_id,
            isAlreadyActivated,
            isCurrent,
            user_id: user.id,
            global_cycle_id: cycle.global_cycle_id,
            week_start_day: 'sunday',
            activated_at: '',
            created_at: cycle.created_at,
            updated_at: '',
            global_cycle: {
              id: cycle.global_cycle_id,
              title: cycle.title,
              start_date: cycle.start_date,
              end_date: cycle.end_date,
              reflection_start: cycle.reflection_start,
              reflection_end: cycle.reflection_end,
              status: cycle.status,
              cycle_position: cycle.cycle_position,
              can_activate: cycle.can_activate,
              previous_cycle_reflection_start: cycle.previous_cycle_reflection_start
            } as GlobalCycle
          } as ActiveTimelineWithCycle);
        });
      }

      setAvailableCycles(availableCyclesWithStatus);
    } catch (error) {
      console.error('[ManageGlobalTimelinesContent] Error fetching available cycles:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleArchiveTimeline = (timeline: UserGlobalTimeline) => {
    const isPastTimeline = timeline.global_cycle?.end_date ? new Date(timeline.global_cycle.end_date) < new Date() : false;

    if (!isPastTimeline) {
      Alert.alert(
        'Cannot Archive',
        'Only timelines that have passed their end date can be archived. This timeline is still active.'
      );
      return;
    }

    setArchiveConfirmTimeline(timeline);
    setShowArchiveConfirm(true);
  };

  const confirmArchive = async () => {
    if (!archiveConfirmTimeline) return;

    setShowArchiveConfirm(false);
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-user-global-timelines')
        .update({
          status: 'archived',
          updated_at: toLocalISOString(new Date()),
        })
        .eq('id', archiveConfirmTimeline.id);

      if (error) throw error;

      Alert.alert('Success', 'Timeline archived successfully');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error archiving timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setArchiveConfirmTimeline(null);
    }
  };

  const handleDeleteTimeline = (timeline: UserGlobalTimeline) => {
    setDeleteConfirmTimeline(timeline);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTimeline = async () => {
    if (!deleteConfirmTimeline) return;

    setShowDeleteConfirm(false);
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-user-global-timelines')
        .delete()
        .eq('id', deleteConfirmTimeline.id);

      if (error) throw error;

      Alert.alert('Success', 'Timeline permanently deleted');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setDeleteConfirmTimeline(null);
    }
  };

  const handleDeactivateTimeline = (timeline: UserGlobalTimeline) => {
    if (!timeline) return;
    setTimelineToDeactivate(timeline);
    setShowDeactivationWarning(true);
  };

  const confirmDeactivation = async () => {
    if (!timelineToDeactivate) return;

    setDeactivating(true);
    setShowDeactivationWarning(false);

    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase.rpc('fn_deactivate_user_global_timeline', {
        p_user_global_timeline_id: timelineToDeactivate.id
      });

      if (error) throw error;

      Alert.alert('Success', 'Global timeline deactivated successfully!');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error deactivating timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setDeactivating(false);
      setTimelineToDeactivate(null);
    }
  };

  const handleActivateButtonPress = (cycle: GlobalCycle) => {
    setSelectedCycleToActivate(cycle);
    setShowWeekStartModal(true);
  };

  const handleWeekStartSelection = async (weekStartDay: 'sunday' | 'monday') => {
    if (!selectedCycleToActivate) return;

    setActivating(true);
    setShowWeekStartModal(false);

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('fn_activate_user_global_timeline', {
        p_global_cycle_id: selectedCycleToActivate.id,
        p_week_start_day: weekStartDay
      });

      if (error) {
        if (error.message?.includes('already activated') || error.code === 'P0001') {
          await fetchData();
          onUpdate?.();
          Alert.alert('Already Active', 'This timeline is already activated and appears in your Active Timelines.');
          return;
        }

        throw error;
      }

      Alert.alert('Success', 'Global timeline activated successfully!');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('[ManageGlobalTimelinesContent] Error activating timeline:', error);
      Alert.alert(
        'Activation Error',
        `Failed to activate timeline: ${(error as Error).message}\n\nPlease try again or contact support if the problem persists.`
      );
    } finally {
      setActivating(false);
      setSelectedCycleToActivate(null);
    }
  };

  const renderActiveTimelines = () => {
    if (activeTimelines.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Calendar size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Active Cycles</Text>
          <Text style={styles.emptyText}>
            Join upcoming cycles below to start tracking your 12-week goals
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.activeTimelinesList}>
        {activeTimelines.map((timeline) => {
          const startDate = timeline.global_cycle?.start_date ? new Date(timeline.global_cycle.start_date) : null;
          const endDate = timeline.global_cycle?.end_date ? new Date(timeline.global_cycle.end_date) : null;
          let daysRemaining = 0;
          let progress = 0;

          if (startDate && endDate) {
            const now = new Date();
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            progress = Math.min(100, Math.max(0, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100));
          }

          const displayTitle = timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'Global Timeline';
          const goalCount = timeline.goals?.filter(g => g.status === 'active').length || 0;

          return (
            <View key={timeline.id} style={styles.activeTimelineCard}>
              <View style={styles.activeTimelineHeader}>
                <View style={styles.activeTimelineInfo}>
                  <Text style={styles.activeTimelineTitle}>{displayTitle}</Text>
                  <Text style={styles.activeTimelineDates}>
                    {timeline.global_cycle?.start_date && timeline.global_cycle?.end_date
                      ? formatDateRange(timeline.global_cycle.start_date, timeline.global_cycle.end_date)
                      : 'Invalid date'}
                  </Text>
                  <Text style={styles.activeTimelineStats}>
                    {goalCount} active goals • {daysRemaining} days remaining
                  </Text>
                  <Text style={styles.weekStartInfo}>
                    Week starts: {timeline.week_start_day === 'sunday' ? 'Sunday' : 'Monday'}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.timelineButtonsContainer}>
                {timeline.global_cycle?.end_date && new Date(timeline.global_cycle.end_date) < new Date() && (
                  <TouchableOpacity
                    style={styles.archiveButton}
                    onPress={() => handleArchiveTimeline(timeline)}
                    disabled={deactivating}
                  >
                    <Archive size={16} color="#f59e0b" />
                    <Text style={styles.archiveButtonText}>Archive</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTimeline(timeline)}
                  disabled={deactivating}
                >
                  <Trash2 size={16} color="#dc2626" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deactivateButton}
                  onPress={() => handleDeactivateTimeline(timeline)}
                  disabled={deactivating}
                >
                  {deactivating ? (
                    <ActivityIndicator size="small" color="#6b7280" />
                  ) : (
                    <>
                      <X size={16} color="#6b7280" />
                      <Text style={styles.deactivateButtonText}>Deactivate</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderAvailableCycles = () => {
    const unactivatedCycles = availableCycles.filter(cycle => !cycle.isAlreadyActivated);

    if (unactivatedCycles.length === 0) {
      return (
        <View style={styles.emptySection}>
          <TrendingUp size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Upcoming Cycles</Text>
          <Text style={styles.emptyText}>
            Check back later for new global 12-week cycles
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.availableCyclesList}>
        {unactivatedCycles.map(cycle => {
          const displayTitle = cycle.global_cycle?.title || cycle.title || 'Global 12-Week Cycle';
          const isActivated = cycle.isAlreadyActivated === true;
          const isCurrent = cycle.isCurrent === true;
          const canActivate = cycle.global_cycle?.can_activate || cycle.can_activate || false;
          const cyclePosition = cycle.global_cycle?.cycle_position || cycle.cycle_position;

          let positionBadgeText = '';
          if (cyclePosition === '2nd_in_line') positionBadgeText = 'Next';
          else if (cyclePosition === '3rd_in_line') positionBadgeText = '3rd';
          else if (cyclePosition === '4th_in_line') positionBadgeText = '4th';

          let lockedMessage = '';
          if (!canActivate && !isActivated) {
            if (cyclePosition === '2nd_in_line') {
              const reflectionStart = cycle.global_cycle?.previous_cycle_reflection_start || cycle.previous_cycle_reflection_start;
              const formattedDate = reflectionStart ? formatDateDisplay(reflectionStart) : '';
              lockedMessage = formattedDate
                ? `Available starting ${formattedDate} (during current cycle's reflection week)`
                : 'This cycle will become available during the current cycle\'s reflection week';
            } else if (cyclePosition === '3rd_in_line' || cyclePosition === '4th_in_line') {
              lockedMessage = 'This cycle will become available when it moves to next in line';
            }
          }

          return (
            <View key={cycle.global_cycle_id || cycle.id} style={styles.availableCycleCard}>
              <View style={styles.cycleCardHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.cycleTitle}>{displayTitle}</Text>
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                  {!isCurrent && positionBadgeText && (
                    <View style={styles.positionBadge}>
                      <Text style={styles.positionBadgeText}>{positionBadgeText}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cycleDates}>
                  {formatDateRange(
                    cycle.global_cycle?.start_date || cycle.start_date,
                    cycle.global_cycle?.end_date || cycle.end_date
                  )}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.activateButton,
                  !canActivate && styles.activateButtonDisabled
                ]}
                onPress={() => handleActivateButtonPress(cycle.global_cycle || cycle)}
                disabled={activating || !canActivate}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[
                    styles.activateButtonText,
                    !canActivate && styles.activateButtonTextDisabled
                  ]}>
                    {canActivate ? 'Activate' : 'Locked'}
                  </Text>
                )}
              </TouchableOpacity>
              {lockedMessage && (
                <View style={styles.lockedMessage}>
                  <Text style={styles.lockedMessageText}>{lockedMessage}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderPastTimelines = () => {
    if (pastTimelines.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Archive size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Past Cycles</Text>
          <Text style={styles.emptyText}>
            Completed cycles will appear here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.pastTimelinesList}>
        {pastTimelines.map((timeline) => {
          const displayTitle = timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'Global Timeline';
          const goalCount = timeline.goals?.filter(g => g.status === 'active').length || 0;

          return (
            <View key={timeline.id} style={styles.pastTimelineCard}>
              <View style={styles.pastTimelineHeader}>
                <View style={styles.pastTimelineInfo}>
                  <Text style={styles.pastTimelineTitle}>{displayTitle}</Text>
                  <Text style={styles.pastTimelineDates}>
                    {timeline.global_cycle?.start_date && timeline.global_cycle?.end_date
                      ? formatDateRange(timeline.global_cycle.start_date, timeline.global_cycle.end_date)
                      : 'Invalid date'}
                  </Text>
                  <Text style={styles.pastTimelineStats}>
                    {goalCount} goals • Completed
                  </Text>
                </View>
              </View>

              <View style={styles.timelineButtonsContainer}>
                <TouchableOpacity
                  style={styles.archiveButton}
                  onPress={() => handleArchiveTimeline(timeline)}
                  disabled={deactivating}
                >
                  <Archive size={16} color="#f59e0b" />
                  <Text style={styles.archiveButtonText}>Archive</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTimeline(timeline)}
                  disabled={deactivating}
                >
                  <Trash2 size={16} color="#dc2626" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Standardized 12 Week Timelines</Text>
          <InfoTooltip
            content="These 12 Week timelines are synchronized to align with the standard year. Each goal-setting period is built with 12 weeks of action and 1 week of reflection and preparation for the next 12 week period."
            iconSize={18}
            iconColor="#6b7280"
            maxWidth={320}
          />
        </View>
        <Text style={styles.headerSubtitle}>
          Manage your global 12-week cycles and timelines
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0078d4" />
          <Text style={styles.loadingText}>Loading cycles...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE CYCLES</Text>
            <Text style={styles.sectionSubtitle}>
              Your currently enrolled 12-week cycles
            </Text>
            {renderActiveTimelines()}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>UPCOMING CYCLES</Text>
              <InfoTooltip
                content="These 12-week timelines sync with a global community calendar. Join upcoming cycles to align your goal-setting with the standardized year structure. The current cycle and next cycle (during reflection week) can be joined."
                iconSize={18}
                iconColor="#6b7280"
                maxWidth={320}
              />
            </View>
            <Text style={styles.sectionSubtitle}>
              Join current and upcoming standardized 12-week cycles
            </Text>
            {renderAvailableCycles()}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.pastCyclesHeader}
              onPress={() => setShowPastCycles(!showPastCycles)}
            >
              <Text style={styles.sectionTitle}>PAST CYCLES</Text>
              {showPastCycles ? (
                <ChevronUp size={24} color="#1f2937" />
              ) : (
                <ChevronDown size={24} color="#1f2937" />
              )}
            </TouchableOpacity>
            {showPastCycles && (
              <>
                <Text style={styles.sectionSubtitle}>
                  Completed 12-week cycles
                </Text>
                {renderPastTimelines()}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* Deactivation Warning Modal */}
      <Modal
        visible={showDeactivationWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeactivationWarning(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.warningModal}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={32} color="#dc2626" />
              <Text style={styles.warningTitle}>Warning: Data Loss</Text>
            </View>

            <Text style={styles.warningMessage}>
              Deactivating this timeline will permanently delete all associated goals and actions.
            </Text>

            <Text style={styles.warningDetails}>
              This timeline has {timelineToDeactivate?.goals?.length || 0} active goals that will be permanently deleted.
            </Text>

            <View style={styles.warningButtons}>
              <TouchableOpacity
                style={styles.warningCancelButton}
                onPress={() => setShowDeactivationWarning(false)}
              >
                <Text style={styles.warningCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningConfirmButton}
                onPress={confirmDeactivation}
                disabled={deactivating}
              >
                {deactivating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.warningConfirmText}>Deactivate Anyway</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal visible={showArchiveConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.warningModal}>
            <View style={styles.warningHeader}>
              <Archive size={32} color="#f59e0b" />
              <Text style={[styles.warningTitle, { color: '#f59e0b' }]}>Archive Timeline</Text>
            </View>

            <Text style={styles.warningMessage}>
              This timeline is past its end date. Archive it to move it out of your active timelines?
            </Text>

            {archiveConfirmTimeline && (
              <Text style={styles.warningDetails}>
                Timeline: {archiveConfirmTimeline.global_cycle?.title || archiveConfirmTimeline.global_cycle?.cycle_label}
                {archiveConfirmTimeline.goals?.length ? `\n${archiveConfirmTimeline.goals.length} goals will be archived with this timeline.` : ''}
              </Text>
            )}

            <Text style={styles.warningNote}>
              You can restore this timeline later from Timeline Archive.
            </Text>

            <View style={styles.warningButtons}>
              <TouchableOpacity
                style={styles.warningCancelButton}
                onPress={() => {
                  setShowArchiveConfirm(false);
                  setArchiveConfirmTimeline(null);
                }}
              >
                <Text style={styles.warningCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningArchiveButton}
                onPress={confirmArchive}
              >
                <Text style={styles.warningArchiveText}>Archive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.warningModal}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={32} color="#dc2626" />
              <Text style={styles.warningTitle}>Delete Timeline</Text>
            </View>

            <Text style={styles.warningMessage}>
              Warning: Deleting this timeline will permanently remove all associated goals and actions. This cannot be undone.
            </Text>

            {deleteConfirmTimeline && (
              <Text style={styles.warningDetails}>
                Timeline: {deleteConfirmTimeline.global_cycle?.title || deleteConfirmTimeline.global_cycle?.cycle_label}
                {deleteConfirmTimeline.goals?.length ? `\n${deleteConfirmTimeline.goals.length} goals will be permanently deleted.` : ''}
              </Text>
            )}

            <View style={styles.warningButtons}>
              <TouchableOpacity
                style={styles.warningCancelButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmTimeline(null);
                }}
              >
                <Text style={styles.warningCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningDeleteButton}
                onPress={confirmDeleteTimeline}
              >
                <Text style={styles.warningDeleteText}>Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Week Start Day Selection Modal */}
      <Modal visible={showWeekStartModal} transparent animationType="fade">
        <View style={styles.weekStartOverlay}>
          <View style={styles.weekStartModal}>
            <Text style={styles.weekStartTitle}>
              Would you like your week start day to be:
            </Text>

            <View style={styles.weekStartButtonsContainer}>
              <TouchableOpacity
                style={styles.weekStartDayButton}
                onPress={() => handleWeekStartSelection('sunday')}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#0078d4" />
                ) : (
                  <Text style={styles.weekStartDayButtonText}>Sunday</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.weekStartDayButton}
                onPress={() => handleWeekStartSelection('monday')}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#0078d4" />
                ) : (
                  <Text style={styles.weekStartDayButtonText}>Monday</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.weekStartCancelButton}
              onPress={() => {
                setShowWeekStartModal(false);
                setSelectedCycleToActivate(null);
              }}
              disabled={activating}
            >
              <Text style={styles.weekStartCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptySection: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  activeTimelinesList: {
    gap: 12,
  },
  activeTimelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0078d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeTimelineHeader: {
    marginBottom: 12,
  },
  activeTimelineInfo: {
    flex: 1,
  },
  activeTimelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  activeTimelineDates: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
    marginBottom: 4,
  },
  activeTimelineStats: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  weekStartInfo: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0078d4',
    borderRadius: 3,
  },
  timelineButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  archiveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  archiveButtonText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  deactivateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#9ca3af',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deactivateButtonText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  availableCyclesList: {
    gap: 12,
  },
  availableCycleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cycleCardHeader: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  cycleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  currentBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  positionBadge: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  positionBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  cycleDates: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
  },
  activateButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  activateButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  activateButtonTextDisabled: {
    color: '#e5e7eb',
  },
  lockedMessage: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginTop: 8,
  },
  lockedMessageText: {
    color: '#92400e',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
    marginTop: 8,
  },
  warningMessage: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  warningDetails: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  warningNote: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  warningButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  warningCancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  warningConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningConfirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningArchiveButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningArchiveText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningDeleteButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningDeleteText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  weekStartOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  weekStartModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  weekStartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  weekStartButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  weekStartDayButton: {
    flex: 1,
    backgroundColor: '#0078d4',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  weekStartDayButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  weekStartCancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  weekStartCancelText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  pastCyclesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pastTimelinesList: {
    gap: 12,
  },
  pastTimelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#9ca3af',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  pastTimelineHeader: {
    marginBottom: 12,
  },
  pastTimelineInfo: {
    flex: 1,
  },
  pastTimelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  pastTimelineDates: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
  },
  pastTimelineStats: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
