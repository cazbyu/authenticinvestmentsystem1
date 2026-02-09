import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  Image,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Crosshair,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  HelpCircle,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString, formatLocalDate } from '@/lib/dateUtils';
import TacticalDayRows, { EnrichedItem, WeekDay } from './TacticalDayRows';
import TacticalDelegateCard, { DelegateContact } from './TacticalDelegateCard';
import GoalCampaignsCard from './GoalCampaignsCard';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { AlignmentEscortCard } from './AlignmentEscortCard';
import { WeekPlanReview } from './WeekPlanReview';
import { updateStepTimestamp } from '@/lib/weeklyAlignment';

const CalendarImage = require('@/assets/images/calendar.png');
const TaskListImage = require('@/assets/images/task-list.png');

const DEPLOY_COLOR = '#FFD700';
const DEPLOY_COLOR_LIGHT = '#FFD70015';
const DEPLOY_COLOR_BORDER = '#FFD70040';

interface TacticalDeploymentStepProps {
  userId: string;
  colors: any;
  onComplete: (contractData: WeeklyContractData) => void;
  onBack: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  capturedData: {
    missionReflection?: string;
    roleHealthFlags?: Record<string, string>;
    flaggedWellnessZones?: string[];
    laggingGoals?: string[];
    keyFocusGoal?: string;
    wellnessZoneFocus?: Array<{ zoneId: string; zoneName: string; focusText: string }>;
    roleFocus?: Array<{ roleId: string; roleLabel: string; focusText: string }>;
  };
  guidedModeEnabled?: boolean;
  weekPlanItems?: import('@/types/weekPlan').WeekPlanItem[];
  onAddWeekPlanItem?: (item: Omit<import('@/types/weekPlan').WeekPlanItem, 'id' | 'created_at'>) => void;
  onRemoveWeekPlanItem?: (id: string) => void;
  weekStartDate: string;
  weekEndDate: string;
}

export interface WeeklyContractData {
  committed_tasks: string[];
  committed_events: string[];
  delegated_tasks: string[];
  personal_commitment: string;
  signed_at: string;
}

export function TacticalDeploymentStep({
  userId,
  colors,
  onComplete,
  onBack,
  onRegisterBackHandler,
  capturedData,
  guidedModeEnabled = true,
  weekPlanItems = [],
  onAddWeekPlanItem,
  onRemoveWeekPlanItem,
  weekStartDate,
  weekEndDate,
}: TacticalDeploymentStepProps) {
  const [loading, setLoading] = useState(true);
  const [enrichedTasks, setEnrichedTasks] = useState<EnrichedItem[]>([]);
  const [enrichedEvents, setEnrichedEvents] = useState<EnrichedItem[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [delegates, setDelegates] = useState<DelegateContact[]>([]);

  const [committedTaskIds, setCommittedTaskIds] = useState<Set<string>>(new Set());
  const [committedEventIds, setCommittedEventIds] = useState<Set<string>>(new Set());
  const [delegatedMap, setDelegatedMap] = useState<
    Map<string, { delegateId: string; delegateName: string }>
  >(new Map());
  const [personalCommitment, setPersonalCommitment] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  const [showFocusAreas, setShowFocusAreas] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  const [editingItem, setEditingItem] = useState<EnrichedItem | null>(null);

  // Quick-add inline form state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);

  async function handleQuickAdd(type: 'task' | 'event') {
    if (!quickAddTitle.trim() || !userId) return;
    setSavingQuickAdd(true);
    try {
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      const insertData: Record<string, any> = {
        user_id: userId,
        title: quickAddTitle.trim(),
        type,
        status: 'pending',
      };

      if (type === 'task') {
        insertData.due_date = today;
        insertData.is_anytime = true;
      } else {
        insertData.start_date = today;
        insertData.is_anytime = false;
      }

      await supabase.from('0008-ap-tasks').insert(insertData);

      if (onAddWeekPlanItem) {
        onAddWeekPlanItem({
          type,
          title: quickAddTitle.trim(),
          source_step: 5,
          source_context: 'Quick add from Deployment',
        });
      }

      setQuickAddTitle('');
    } catch (error) {
      console.error('Error quick-adding item:', error);
    } finally {
      setSavingQuickAdd(false);
    }
  }

  useEffect(() => {
    loadWeekData();
  }, []);

  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => false);
    }
  }, []);

  // Write step_5_started on mount
  useEffect(() => {
    if (userId && weekStartDate && weekEndDate) {
      updateStepTimestamp(userId, weekStartDate, weekEndDate, 'step_5_started');
    }
  }, [userId, weekStartDate, weekEndDate]);

  async function loadWeekData() {
    try {
      const supabase = getSupabaseClient();

      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startStr = toLocalISOString(startOfWeek).split('T')[0];
      const endStr = toLocalISOString(endOfWeek).split('T')[0];

      const days: WeekDay[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push({
          date: formatLocalDate(d),
          label: d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        });
      }
      setWeekDays(days);

      const [taskRes, eventRes] = await Promise.all([
        supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_time, is_urgent, is_important')
          .eq('user_id', userId)
          .eq('type', 'task')
          .is('completed_at', null)
          .is('deleted_at', null)
          .gte('due_date', startStr)
          .lte('due_date', endStr)
          .order('due_date', { ascending: true }),
        supabase
          .from('0008-ap-tasks')
          .select('id, title, type, start_date, start_time, end_time')
          .eq('user_id', userId)
          .eq('type', 'event')
          .is('completed_at', null)
          .is('deleted_at', null)
          .gte('start_date', startStr)
          .lte('start_date', endStr)
          .order('start_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ]);

      const rawTasks = taskRes.data || [];
      const rawEvents = eventRes.data || [];
      const allIds = [...rawTasks.map((t) => t.id), ...rawEvents.map((e) => e.id)];

      let roleJoins: any[] = [];
      let domainJoins: any[] = [];
      let goalJoins: any[] = [];
      let delegateJoins: any[] = [];
      let allRoles: any[] = [];
      let allDomains: any[] = [];
      let allDelegates: any[] = [];

      if (allIds.length > 0) {
        const [rj, dj, gj, dlj] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id, role_id')
            .eq('parent_type', 'task')
            .in('parent_id', allIds),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id, domain_id')
            .eq('parent_type', 'task')
            .in('parent_id', allIds),
          supabase
            .from('0008-ap-universal-goals-join')
            .select('parent_id, twelve_wk_goal_id, custom_goal_id')
            .in('parent_id', allIds),
          supabase
            .from('0008-ap-universal-delegates-join')
            .select('parent_id, delegate_id')
            .eq('parent_type', 'task')
            .in('parent_id', allIds),
        ]);
        roleJoins = rj.data || [];
        domainJoins = dj.data || [];
        goalJoins = gj.data || [];
        delegateJoins = dlj.data || [];
      }

      const roleIds = [...new Set(roleJoins.map((r: any) => r.role_id).filter(Boolean))];
      const domainIds = [...new Set(domainJoins.map((d: any) => d.domain_id).filter(Boolean))];
      const goalIds12 = [
        ...new Set(goalJoins.map((g: any) => g.twelve_wk_goal_id).filter(Boolean)),
      ];
      const goalIdsCustom = [
        ...new Set(goalJoins.map((g: any) => g.custom_goal_id).filter(Boolean)),
      ];
      const delegateIdsList = [
        ...new Set(delegateJoins.map((d: any) => d.delegate_id).filter(Boolean)),
      ];

      const [rolesRes, domainsRes, goals12Res, goalsCustomRes, delegatesJoinedRes, delegatesRes] =
        await Promise.all([
          roleIds.length > 0
            ? supabase.from('0008-ap-roles').select('id, label, color').in('id', roleIds)
            : { data: [] },
          domainIds.length > 0
            ? supabase.from('0008-ap-domains').select('id, name').in('id', domainIds)
            : { data: [] },
          goalIds12.length > 0
            ? supabase.from('0008-ap-goals-12wk').select('id, title').in('id', goalIds12)
            : { data: [] },
          goalIdsCustom.length > 0
            ? supabase.from('0008-ap-goals-custom').select('id, title').in('id', goalIdsCustom)
            : { data: [] },
          delegateIdsList.length > 0
            ? supabase.from('0008-ap-delegates').select('id, name').in('id', delegateIdsList)
            : { data: [] },
          supabase
            .from('0008-ap-delegates')
            .select('id, name, email, phone')
            .eq('user_id', userId)
            .order('name', { ascending: true }),
        ]);

      allRoles = rolesRes.data || [];
      allDomains = domainsRes.data || [];
      allDelegates = delegatesRes.data || [];

      const rolesById = new Map(allRoles.map((r: any) => [r.id, r]));
      const domainsById = new Map(allDomains.map((d: any) => [d.id, d]));
      const goalsById = new Map<string, { id: string; title: string }>();
      for (const g of goals12Res.data || []) goalsById.set(g.id, g);
      for (const g of goalsCustomRes.data || []) goalsById.set(g.id, g);
      const delegatesById = new Map(
        (delegatesJoinedRes.data || []).map((d: any) => [d.id, d])
      );

      const rolesByParent = new Map<string, any[]>();
      for (const rj of roleJoins) {
        const list = rolesByParent.get(rj.parent_id) || [];
        const role = rolesById.get(rj.role_id);
        if (role) list.push(role);
        rolesByParent.set(rj.parent_id, list);
      }

      const domainsByParent = new Map<string, any[]>();
      for (const dj of domainJoins) {
        const list = domainsByParent.get(dj.parent_id) || [];
        const domain = domainsById.get(dj.domain_id);
        if (domain) list.push(domain);
        domainsByParent.set(dj.parent_id, list);
      }

      const goalsByParent = new Map<string, any[]>();
      for (const gj of goalJoins) {
        const list = goalsByParent.get(gj.parent_id) || [];
        const goal =
          goalsById.get(gj.twelve_wk_goal_id) || goalsById.get(gj.custom_goal_id);
        if (goal) list.push(goal);
        goalsByParent.set(gj.parent_id, list);
      }

      const delegatesByParent = new Map<string, any[]>();
      for (const dlj of delegateJoins) {
        const list = delegatesByParent.get(dlj.parent_id) || [];
        const del = delegatesById.get(dlj.delegate_id);
        if (del) list.push(del);
        delegatesByParent.set(dlj.parent_id, list);
      }

      function enrichItem(raw: any, type: 'task' | 'event'): EnrichedItem {
        const delegates = delegatesByParent.get(raw.id) || [];
        return {
          ...raw,
          type,
          roles: rolesByParent.get(raw.id) || [],
          domains: domainsByParent.get(raw.id) || [],
          goals: goalsByParent.get(raw.id) || [],
          has_delegates: delegates.length > 0,
          delegateName: delegates[0]?.name,
        };
      }

      const eTasks = rawTasks.map((t) => enrichItem(t, 'task'));
      const eEvents = rawEvents.map((e) => enrichItem(e, 'event'));

      setEnrichedTasks(eTasks);
      setEnrichedEvents(eEvents);

      const urgentImportant = new Set(
        rawTasks.filter((t) => t.is_urgent && t.is_important).map((t) => t.id)
      );
      setCommittedTaskIds(urgentImportant);
      setCommittedEventIds(new Set(rawEvents.map((e) => e.id)));

      const uniqueDelegates = new Map<string, DelegateContact>();
      for (const d of allDelegates) {
        if (!uniqueDelegates.has(d.name)) {
          uniqueDelegates.set(d.name, d);
        }
      }
      setDelegates(Array.from(uniqueDelegates.values()));

    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleTask(taskId: string) {
    setCommittedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function toggleEvent(eventId: string) {
    setCommittedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleDelegateTask(taskId: string, delegateName: string, delegateEmail?: string) {
    const supabase = getSupabaseClient();
    const task = enrichedTasks.find((t) => t.id === taskId);

    const { data: assignment } = await supabase
      .from('0008-ap-delegates')
      .insert({
        user_id: userId,
        name: delegateName,
        email: delegateEmail || null,
        task_id: taskId,
        due_date: task?.due_date || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (!assignment) return;

    await Promise.all([
      supabase.from('0008-ap-universal-delegates-join').insert({
        parent_id: taskId,
        parent_type: 'task',
        delegate_id: assignment.id,
        user_id: userId,
      }),
      supabase.from('0008-ap-tasks').update({ delegated_to: assignment.id }).eq('id', taskId),
    ]);

    setDelegatedMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, { delegateId: assignment.id, delegateName });
      return next;
    });
  }

  async function refreshDelegates() {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('0008-ap-delegates')
      .select('id, name, email, phone')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    const unique = new Map<string, DelegateContact>();
    for (const d of data || []) {
      if (!unique.has(d.name)) unique.set(d.name, d);
    }
    setDelegates(Array.from(unique.values()));
  }

  function handleEditItem(item: EnrichedItem) {
    setEditingItem(item);
  }

  function handleEditComplete() {
    setEditingItem(null);
    loadWeekData();
  }

  async function handleSignContract() {
    if (committedTaskIds.size === 0 && committedEventIds.size === 0) {
      Alert.alert('Commitment Required', 'Please commit to at least one task or event.');
      return;
    }

    setIsSigning(true);
    try {
      // Write step_5_ended when contract is signed
      updateStepTimestamp(userId, weekStartDate, weekEndDate, 'step_5_ended');

      const contractData: WeeklyContractData = {
        committed_tasks: Array.from(committedTaskIds),
        committed_events: Array.from(committedEventIds),
        delegated_tasks: Array.from(delegatedMap.keys()),
        personal_commitment: personalCommitment.trim(),
        signed_at: new Date().toISOString(),
      };

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onComplete(contractData);
    } catch (error) {
      console.error('Error signing contract:', error);
      Alert.alert('Error', 'Failed to save your weekly contract. Please try again.');
    } finally {
      setIsSigning(false);
    }
  }

  const wellnessZoneFocuses = capturedData.wellnessZoneFocus || [];
  const roleFocuses = capturedData.roleFocus || [];
  const hasFocusAreas = wellnessZoneFocuses.length > 0 || roleFocuses.length > 0;
  const totalCommitments = committedTaskIds.size + committedEventIds.size;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DEPLOY_COLOR} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Preparing your deployment...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.iconContainer, { backgroundColor: DEPLOY_COLOR_LIGHT }]}>
            <Crosshair size={36} color={DEPLOY_COLOR} strokeWidth={1.8} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.stepLabel, { color: DEPLOY_COLOR }]}>Step 5</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Deployment</Text>
          </View>
          <TouchableOpacity
            style={styles.tooltipBtn}
            onPress={() => setShowTooltip(!showTooltip)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HelpCircle size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showTooltip && (
          <View
            style={[
              styles.tooltipBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              Review your calendar, delegate what others can own, commit to what you will do, and
              check your goal coverage.
            </Text>
          </View>
        )}
      </View>

      {/* Escort: Opening message for Step 5 */}
      {guidedModeEnabled && weekPlanItems.length > 0 && (
        <AlignmentEscortCard
          type="celebrate"
          message={`You've captured ${weekPlanItems.length} aligned action${weekPlanItems.length !== 1 ? 's' : ''} across your roles, wellness, and goals. Let's review your week and lock it in.`}
          stepColor="#f5a623"
        />
      )}
      {guidedModeEnabled && weekPlanItems.length === 0 && !showQuickAdd && (
        <AlignmentEscortCard
          type="nudge"
          message="Before you sign off on your week, take a moment to add at least a few tasks or events that connect to what you've reflected on."
          actionLabel="Add Actions Now"
          stepColor="#f5a623"
          onAction={() => setShowQuickAdd(true)}
        />
      )}

      {/* Inline Quick-Add Form */}
      {showQuickAdd && (
        <View style={[quickAddStyles.container, { backgroundColor: colors.surface, borderColor: DEPLOY_COLOR_BORDER }]}>
          <TextInput
            style={[quickAddStyles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            placeholder="What do you want to do this week?"
            placeholderTextColor={colors.textSecondary}
            value={quickAddTitle}
            onChangeText={setQuickAddTitle}
            autoFocus
          />
          <View style={quickAddStyles.buttonRow}>
            <TouchableOpacity
              style={[quickAddStyles.saveButton, { backgroundColor: DEPLOY_COLOR, opacity: quickAddTitle.trim() ? 1 : 0.5 }]}
              onPress={() => handleQuickAdd('task')}
              disabled={!quickAddTitle.trim() || savingQuickAdd}
            >
              <Text style={quickAddStyles.saveButtonText}>Save as Task</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[quickAddStyles.saveButton, { backgroundColor: '#8B5CF6', opacity: quickAddTitle.trim() ? 1 : 0.5 }]}
              onPress={() => handleQuickAdd('event')}
              disabled={!quickAddTitle.trim() || savingQuickAdd}
            >
              <Text style={quickAddStyles.saveButtonText}>Save as Event</Text>
            </TouchableOpacity>
          </View>
          {savingQuickAdd && <ActivityIndicator size="small" color={DEPLOY_COLOR} style={{ marginTop: 8 }} />}
        </View>
      )}

      {/* Week Plan Review - Show accumulated items from steps 2-4 */}
      {guidedModeEnabled && weekPlanItems.length > 0 && onRemoveWeekPlanItem && (
        <WeekPlanReview
          items={weekPlanItems}
          onRemoveItem={onRemoveWeekPlanItem}
          onAddMore={() => setShowQuickAdd(true)}
          colors={colors}
        />
      )}

      {/* Focus Areas */}
      {hasFocusAreas && (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.surface, borderColor: DEPLOY_COLOR_BORDER },
          ]}
        >
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowFocusAreas(!showFocusAreas)}
          >
            <Target size={20} color={DEPLOY_COLOR} />
            <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
              Your Weekly Focus Areas
            </Text>
            <View style={[styles.countBadge, { backgroundColor: DEPLOY_COLOR }]}>
              <Text style={styles.countBadgeText}>
                {wellnessZoneFocuses.length + roleFocuses.length}
              </Text>
            </View>
            {showFocusAreas ? (
              <ChevronUp size={20} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {showFocusAreas && (
            <View style={styles.focusList}>
              {wellnessZoneFocuses.map((wz) => (
                <View
                  key={`wz-${wz.zoneId}`}
                  style={[
                    styles.focusItem,
                    { backgroundColor: '#39b54a10', borderColor: '#39b54a40' },
                  ]}
                >
                  <View style={styles.focusItemHeader}>
                    <View style={[styles.focusBadge, { backgroundColor: '#39b54a' }]}>
                      <Text style={styles.focusBadgeText}>WZ</Text>
                    </View>
                    <Text style={[styles.focusLabel, { color: colors.text }]}>{wz.zoneName}</Text>
                  </View>
                  <Text style={[styles.focusText, { color: colors.textSecondary }]}>
                    "{wz.focusText}"
                  </Text>
                </View>
              ))}
              {roleFocuses.map((role) => (
                <View
                  key={`role-${role.roleId}`}
                  style={[
                    styles.focusItem,
                    { backgroundColor: '#9370DB10', borderColor: '#9370DB40' },
                  ]}
                >
                  <View style={styles.focusItemHeader}>
                    <View style={[styles.focusBadge, { backgroundColor: '#9370DB' }]}>
                      <Text style={styles.focusBadgeText}>R</Text>
                    </View>
                    <Text style={[styles.focusLabel, { color: colors.text }]}>
                      {role.roleLabel}
                    </Text>
                  </View>
                  <Text style={[styles.focusText, { color: colors.textSecondary }]}>
                    "{role.focusText}"
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Events Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setShowEvents(!showEvents)}
        >
          <Image source={CalendarImage} style={styles.sectionImage} resizeMode="contain" />
          <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
            Events This Week ({enrichedEvents.length})
          </Text>
          <Text style={[styles.commitCount, { color: '#10B981' }]}>
            {committedEventIds.size} committed
          </Text>
          {showEvents ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {showEvents && (
          <TacticalDayRows
            items={enrichedEvents}
            dateField="start_date"
            weekDays={weekDays}
            committedIds={committedEventIds}
            onToggleCommit={toggleEvent}
            onEditItem={handleEditItem}
            colors={colors}
          />
        )}
      </View>

      {/* Tasks Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setShowTasks(!showTasks)}
        >
          <Image source={TaskListImage} style={styles.sectionImage} resizeMode="contain" />
          <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
            Tasks This Week ({enrichedTasks.length})
          </Text>
          <Text style={[styles.commitCount, { color: '#10B981' }]}>
            {committedTaskIds.size} committed
          </Text>
          {showTasks ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {showTasks && (
          <TacticalDayRows
            items={enrichedTasks}
            dateField="due_date"
            weekDays={weekDays}
            committedIds={committedTaskIds}
            onToggleCommit={toggleTask}
            onEditItem={handleEditItem}
            colors={colors}
            showPriority
          />
        )}
      </View>

      {/* Delegate Section */}
      <TacticalDelegateCard
        tasks={enrichedTasks.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date }))}
        delegates={delegates}
        userId={userId}
        colors={colors}
        onDelegateTask={handleDelegateTask}
        delegatedMap={delegatedMap}
        onDelegatesRefresh={refreshDelegates}
      />

      {/* Goal Campaigns */}
      <GoalCampaignsCard userId={userId} colors={colors} />

      {/* Personal Commitment */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Sparkles size={20} color="#10B981" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Personal Commitment (Optional)
          </Text>
        </View>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Any personal promise you want to make to yourself this week?
        </Text>
        <TextInput
          style={[
            styles.commitInput,
            { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="e.g., I will prioritize sleep over screens..."
          placeholderTextColor={colors.textSecondary}
          value={personalCommitment}
          onChangeText={setPersonalCommitment}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Contract Summary */}
      <View
        style={[
          styles.contractBox,
          { backgroundColor: DEPLOY_COLOR_LIGHT, borderColor: DEPLOY_COLOR_BORDER },
        ]}
      >
        <Text style={[styles.contractTitle, { color: colors.text }]}>Weekly Contract Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Total Commitments:
          </Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            {totalCommitments} items
          </Text>
        </View>
        {delegatedMap.size > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Delegated Tasks:
            </Text>
            <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>
              {delegatedMap.size} delegated
            </Text>
          </View>
        )}
        {hasFocusAreas && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Focus Areas:
            </Text>
            <Text style={[styles.summaryValue, { color: DEPLOY_COLOR }]}>
              {wellnessZoneFocuses.length + roleFocuses.length} defined
            </Text>
          </View>
        )}
      </View>

      {/* Sign Button */}
      <TouchableOpacity
        style={[styles.signBtn, { backgroundColor: DEPLOY_COLOR }, isSigning && styles.signDisabled]}
        onPress={handleSignContract}
        disabled={isSigning}
        activeOpacity={0.8}
      >
        {isSigning ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <>
            <Text style={styles.signText}>Sign Weekly Contract</Text>
            <ChevronRight size={24} color="#000000" />
          </>
        )}
      </TouchableOpacity>

      <Text style={[styles.legalText, { color: colors.textSecondary }]}>
        By signing, you commit to honoring this contract with yourself.
      </Text>

      <View style={{ height: 40 }} />

      {/* Edit Modal */}
      {editingItem && (
        <Modal visible animationType="slide" presentationStyle="fullScreen">
          <TaskEventForm
            mode="edit"
            initialData={{
              ...editingItem,
              type: editingItem.type,
              roles: editingItem.roles,
              domains: editingItem.domains,
              goals: editingItem.goals,
            }}
            onClose={() => setEditingItem(null)}
            onSubmitSuccess={handleEditComplete}
          />
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  tooltipBtn: {
    padding: 8,
  },
  tooltipBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionImage: {
    width: 24,
    height: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  commitCount: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  countBadgeText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  focusList: {
    marginTop: 12,
    gap: 10,
  },
  focusItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  focusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  focusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  focusLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  focusText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  commitInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  contractBox: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  contractTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  signDisabled: {
    opacity: 0.6,
  },
  signText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

const quickAddStyles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default TacticalDeploymentStep;
