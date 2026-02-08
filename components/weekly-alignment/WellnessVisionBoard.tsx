import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import {
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

const TaskListIcon = require('@/assets/images/task-list.png');
const CalendarIcon = require('@/assets/images/calendar.png');
const DepositIdeaIcon = require('@/assets/images/deposit-idea.png');
const ReflectionsIcon = require('@/assets/images/reflections-72.png');
const RoseIcon = require('@/assets/images/rose-81.png');
const ThornIcon = require('@/assets/images/thorn-81.png');

const ROSE_COLOR = '#E11D48';
const THORN_COLOR = '#6B7280';

interface WellnessZone {
  id: string;
  domain_id: string;
  name: string;
  description?: string;
  icon?: string;
  priority_order?: number | null;
  fulfillment_vision?: string;
  dream?: string;
  purpose?: string;
  user_zone_id?: string;
}

interface Task {
  id: string;
  title: string;
  type: 'task' | 'event';
  status: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_anytime?: boolean;
  one_thing?: boolean;
}

interface DepositIdea {
  id: string;
  title: string;
  one_thing?: boolean;
}

interface ReflectionItem {
  id: string;
  content: string;
  created_at: string;
}

interface IntrospectionQuestion {
  id: string;
  question_text: string;
  question_context?: string;
}

interface IntrospectionResponse {
  id: string;
  question_text?: string;
  response_text: string;
  created_at: string;
}

interface WellnessVisionBoardProps {
  zone: WellnessZone;
  userId: string;
  colors: any;
  weekStartDate: string;
  priorityIndex: number;
  onBack: () => void;
  onZoneUpdated: (zone: WellnessZone) => void;
}

function getZoneColor(zoneName: string): string {
  switch (zoneName?.toLowerCase()) {
    case 'physical': return '#EF4444';
    case 'emotional': return '#EC4899';
    case 'intellectual': return '#3B82F6';
    case 'social': return '#F59E0B';
    case 'spiritual': return '#8B5CF6';
    case 'financial': return '#10B981';
    case 'recreational': return '#06B6D4';
    case 'community': return '#6366F1';
    default: return '#6B7280';
  }
}

function getZoneEmoji(zoneName: string): string {
  switch (zoneName?.toLowerCase()) {
    case 'physical': return '\u{1F4AA}';
    case 'emotional': return '\u{2764}\u{FE0F}';
    case 'intellectual': return '\u{1F9E0}';
    case 'social': return '\u{1F465}';
    case 'spiritual': return '\u{2728}';
    case 'financial': return '\u{1F4B0}';
    case 'recreational': return '\u{1F3AE}';
    case 'community': return '\u{1F30D}';
    default: return '\u{1F33F}';
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getWeekDates(weekStart: string): { label: string; value: string }[] {
  const start = new Date(weekStart + 'T12:00:00');
  const dates: { label: string; value: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      value: `${yyyy}-${mm}-${dd}`,
    });
  }
  return dates;
}

export function WellnessVisionBoard({
  zone,
  userId,
  colors,
  weekStartDate,
  priorityIndex,
  onBack,
  onZoneUpdated,
}: WellnessVisionBoardProps) {
  const zoneColor = getZoneColor(zone.name);
  const weekDates = weekStartDate ? getWeekDates(weekStartDate) : [];

  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});

  const [oneThingText, setOneThingText] = useState('');
  const [existingOneThingTask, setExistingOneThingTask] = useState<Task | null>(null);
  const [savingOneThing, setSavingOneThing] = useState(false);
  const [takeActionType, setTakeActionType] = useState<'task' | 'event' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedEndTime, setSelectedEndTime] = useState('10:00');

  const [ideaText, setIdeaText] = useState('');
  const [savingIdea, setSavingIdea] = useState(false);

  const [activeReflectionTab, setActiveReflectionTab] = useState<'rose' | 'thorn' | 'reflection'>('rose');
  const [roseText, setRoseText] = useState('');
  const [savingRose, setSavingRose] = useState(false);
  const [thornText, setThornText] = useState('');
  const [savingThorn, setSavingThorn] = useState(false);
  const [thoughtText, setThoughtText] = useState('');
  const [savingThought, setSavingThought] = useState(false);

  const [dreamResponse, setDreamResponse] = useState('');
  const [editingDream, setEditingDream] = useState(false);
  const [savingDream, setSavingDream] = useState(false);
  const [purposeResponse, setPurposeResponse] = useState('');
  const [editingPurpose, setEditingPurpose] = useState(false);
  const [savingPurpose, setSavingPurpose] = useState(false);

  const [visionQuestion, setVisionQuestion] = useState<IntrospectionQuestion | null>(null);
  const [visionAnswer, setVisionAnswer] = useState('');
  const [savingVisionAnswer, setSavingVisionAnswer] = useState(false);
  const [visionIntrospectionOpen, setVisionIntrospectionOpen] = useState(false);
  const [visionResponses, setVisionResponses] = useState<IntrospectionResponse[]>([]);
  const [allVisionAnswered, setAllVisionAnswered] = useState(false);

  const [missionQuestion, setMissionQuestion] = useState<IntrospectionQuestion | null>(null);
  const [missionAnswer, setMissionAnswer] = useState('');
  const [savingMissionAnswer, setSavingMissionAnswer] = useState(false);
  const [missionIntrospectionOpen, setMissionIntrospectionOpen] = useState(false);
  const [missionResponses, setMissionResponses] = useState<IntrospectionResponse[]>([]);
  const [allMissionAnswered, setAllMissionAnswered] = useState(false);

  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editingResponseText, setEditingResponseText] = useState('');
  const [savingEditResponse, setSavingEditResponse] = useState(false);

  const [zoneTasks, setZoneTasks] = useState<Task[]>([]);
  const [zoneIdeas, setZoneIdeas] = useState<DepositIdea[]>([]);
  const [weekRoses, setWeekRoses] = useState<ReflectionItem[]>([]);
  const [weekThorns, setWeekThorns] = useState<ReflectionItem[]>([]);
  const [weekReflections, setWeekReflections] = useState<ReflectionItem[]>([]);
  const [showTasksList, setShowTasksList] = useState(false);
  const [showIdeasList, setShowIdeasList] = useState(false);
  const [showReflectionsList, setShowReflectionsList] = useState(false);

  const [localZone, setLocalZone] = useState<WellnessZone>(zone);

  useEffect(() => {
    loadAllData();
  }, [zone.id, weekStartDate]);

  async function loadAllData() {
    setLoading(true);
    try {
      await Promise.all([
        loadZoneItemsData(),
        loadIntrospectionData('vision'),
        loadIntrospectionData('mission'),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadZoneItemsData() {
    try {
      const supabase = getSupabaseClient();

      const { data: taskJoins } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('parent_id')
        .eq('parent_type', 'task')
        .eq('domain_id', zone.domain_id)
        .eq('user_id', userId);

      const taskIds = taskJoins?.map(tj => tj.parent_id) || [];

      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, due_date, start_date, start_time, end_time, is_anytime, one_thing')
          .in('id', taskIds)
          .is('deleted_at', null)
          .not('status', 'in', '(completed,cancelled)')
          .order('created_at', { ascending: false });

        setZoneTasks(tasks || []);
        const existing = (tasks || []).find(t => t.one_thing);
        setExistingOneThingTask(existing || null);
      } else {
        setZoneTasks([]);
        setExistingOneThingTask(null);
      }

      const { data: ideaJoins } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('parent_id')
        .eq('parent_type', 'depositIdea')
        .eq('domain_id', zone.domain_id)
        .eq('user_id', userId);

      const ideaIds = ideaJoins?.map(ij => ij.parent_id) || [];
      if (ideaIds.length > 0) {
        const { data: ideas } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, one_thing')
          .in('id', ideaIds)
          .eq('is_active', true)
          .eq('archived', false)
          .order('created_at', { ascending: false });
        setZoneIdeas(ideas || []);
      } else {
        setZoneIdeas([]);
      }

      const { data: reflJoins } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('parent_id')
        .eq('parent_type', 'reflection')
        .eq('domain_id', zone.domain_id)
        .eq('user_id', userId);

      const reflIds = reflJoins?.map(rj => rj.parent_id) || [];
      if (reflIds.length > 0) {
        const weekEnd = new Date(weekStartDate + 'T12:00:00');
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;

        const { data: roses } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at')
          .in('id', reflIds)
          .eq('daily_rose', true)
          .gte('date', weekStartDate)
          .lt('date', weekEndStr)
          .order('created_at', { ascending: false });
        setWeekRoses(roses || []);

        const { data: thorns } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at')
          .in('id', reflIds)
          .eq('daily_thorn', true)
          .gte('date', weekStartDate)
          .lt('date', weekEndStr)
          .order('created_at', { ascending: false });
        setWeekThorns(thorns || []);

        const { data: refls } = await supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at')
          .in('id', reflIds)
          .eq('reflection_type', 'reflection')
          .eq('daily_rose', false)
          .eq('daily_thorn', false)
          .gte('date', weekStartDate)
          .lt('date', weekEndStr)
          .order('created_at', { ascending: false });
        setWeekReflections(refls || []);
      } else {
        setWeekRoses([]);
        setWeekThorns([]);
        setWeekReflections([]);
      }
    } catch (error) {
      console.error('Error loading zone items:', error);
    }
  }

  async function loadIntrospectionData(strategyType: 'vision' | 'mission') {
    try {
      const supabase = getSupabaseClient();

      const { data: questions } = await supabase
        .from('0008-ap-power-questions')
        .select('id, question_text, question_context')
        .eq('wz_type', 'wz')
        .eq('wellness_zone', zone.name.toLowerCase())
        .eq('strategy_type', strategyType)
        .eq('question_type', 'introspection')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      const { data: responses } = await supabase
        .from('0008-ap-question-responses')
        .select('id, question_id, response_text, created_at')
        .eq('user_id', userId)
        .eq('context_type', 'weekly_alignment')
        .eq('domain', 'wellness')
        .order('created_at', { ascending: false });

      const answeredIds = new Set((responses || []).map(r => r.question_id));
      const unanswered = (questions || []).filter(q => !answeredIds.has(q.id));

      const enrichedResponses: IntrospectionResponse[] = (responses || [])
        .filter(r => (questions || []).some(q => q.id === r.question_id))
        .map(r => ({
          ...r,
          question_text: (questions || []).find(q => q.id === r.question_id)?.question_text,
        }));

      if (strategyType === 'vision') {
        setVisionQuestion(unanswered[0] || null);
        setVisionResponses(enrichedResponses.slice(0, 5));
        setAllVisionAnswered(unanswered.length === 0 && (questions || []).length > 0);
      } else {
        setMissionQuestion(unanswered[0] || null);
        setMissionResponses(enrichedResponses.slice(0, 5));
        setAllMissionAnswered(unanswered.length === 0 && (questions || []).length > 0);
      }
    } catch (error) {
      console.error(`Error loading ${strategyType} introspection:`, error);
    }
  }

  function showSavedFeedback(key: string) {
    setSavedItems(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setSavedItems(prev => ({ ...prev, [key]: false })), 2000);
  }

  function showErrorAlert(message: string) {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Error', message);
    }
  }

  function openDatePicker(type: 'task' | 'event') {
    setTakeActionType(type);
    setSelectedDate(weekDates[0]?.value || '');
    setSelectedTime('09:00');
    setSelectedEndTime('10:00');
    setShowDatePicker(true);
  }

  async function confirmSaveOneThing() {
    if (!oneThingText.trim() || !selectedDate || !takeActionType) return;
    setSavingOneThing(true);
    setShowDatePicker(false);
    try {
      const supabase = getSupabaseClient();
      const isEvent = takeActionType === 'event';

      const taskPayload: Record<string, any> = {
        user_id: userId,
        title: oneThingText.trim(),
        type: takeActionType,
        one_thing: true,
        status: 'pending',
      };

      if (isEvent) {
        taskPayload.start_date = selectedDate;
        taskPayload.start_time = selectedTime;
        taskPayload.end_time = selectedEndTime;
      } else {
        taskPayload.due_date = selectedDate;
        taskPayload.is_anytime = true;
      }

      const { data: newTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert(taskPayload)
        .select('id, title, type, status, due_date, start_date, start_time, end_time, is_anytime, one_thing')
        .single();

      if (taskError) throw taskError;

      const { error: joinError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert({
          parent_type: 'task',
          parent_id: newTask.id,
          domain_id: zone.domain_id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setExistingOneThingTask(newTask);
      setOneThingText('');
      setTakeActionType(null);
      showSavedFeedback('oneThing');
      await loadZoneItemsData();
    } catch (error) {
      console.error('Error saving ONE Thing:', error);
      showErrorAlert('Failed to save. Please try again.');
    } finally {
      setSavingOneThing(false);
    }
  }

  async function saveDepositIdea() {
    if (!ideaText.trim()) return;
    setSavingIdea(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newIdea, error: ideaError } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({
          user_id: userId,
          title: ideaText.trim(),
          is_active: true,
          one_thing: true,
        })
        .select('id')
        .single();

      if (ideaError) throw ideaError;

      const { error: joinError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert({
          parent_type: 'depositIdea',
          parent_id: newIdea.id,
          domain_id: zone.domain_id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setIdeaText('');
      showSavedFeedback('idea');
      await loadZoneItemsData();
    } catch (error) {
      console.error('Error saving idea:', error);
      showErrorAlert('Failed to save idea.');
    } finally {
      setSavingIdea(false);
    }
  }

  async function saveRose() {
    if (!roseText.trim()) return;
    setSavingRose(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newRefl, error: insertError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: roseText.trim(),
          reflection_type: 'rose',
          daily_rose: true,
          one_thing: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const { error: joinError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert({
          parent_type: 'reflection',
          parent_id: newRefl.id,
          domain_id: zone.domain_id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setRoseText('');
      showSavedFeedback('rose');
      await loadZoneItemsData();
    } catch (error) {
      console.error('Error saving rose:', error);
      showErrorAlert('Failed to save rose.');
    } finally {
      setSavingRose(false);
    }
  }

  async function saveThorn() {
    if (!thornText.trim()) return;
    setSavingThorn(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newRefl, error: insertError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: thornText.trim(),
          reflection_type: 'thorn',
          daily_thorn: true,
          one_thing: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const { error: joinError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert({
          parent_type: 'reflection',
          parent_id: newRefl.id,
          domain_id: zone.domain_id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setThornText('');
      showSavedFeedback('thorn');
      await loadZoneItemsData();
    } catch (error) {
      console.error('Error saving thorn:', error);
      showErrorAlert('Failed to save thorn.');
    } finally {
      setSavingThorn(false);
    }
  }

  async function saveThought() {
    if (!thoughtText.trim()) return;
    setSavingThought(true);
    try {
      const supabase = getSupabaseClient();

      const { data: newRefl, error: insertError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: thoughtText.trim(),
          reflection_type: 'reflection',
          one_thing: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const { error: joinError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert({
          parent_type: 'reflection',
          parent_id: newRefl.id,
          domain_id: zone.domain_id,
          user_id: userId,
        });

      if (joinError) throw joinError;

      setThoughtText('');
      showSavedFeedback('thought');
      await loadZoneItemsData();
    } catch (error) {
      console.error('Error saving thought:', error);
      showErrorAlert('Failed to save thought.');
    } finally {
      setSavingThought(false);
    }
  }

  async function saveZoneDream() {
    if (!dreamResponse.trim()) return;
    setSavingDream(true);
    try {
      const supabase = getSupabaseClient();

      if (localZone.user_zone_id) {
        const { error } = await supabase
          .from('0008-ap-user-wellness-zones')
          .update({ dream: dreamResponse.trim(), updated_at: new Date().toISOString() })
          .eq('id', localZone.user_zone_id);
        if (error) throw error;
      } else {
        const { data: newZone, error } = await supabase
          .from('0008-ap-user-wellness-zones')
          .insert({
            user_id: userId,
            domain_id: zone.domain_id,
            dream: dreamResponse.trim(),
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setLocalZone(prev => ({ ...prev, user_zone_id: newZone.id }));
      }

      const updated = { ...localZone, dream: dreamResponse.trim() };
      setLocalZone(updated);
      onZoneUpdated(updated);
      setEditingDream(false);
      showSavedFeedback('dream');
    } catch (error) {
      console.error('Error saving dream:', error);
      showErrorAlert('Failed to save dream.');
    } finally {
      setSavingDream(false);
    }
  }

  async function saveZonePurpose() {
    if (!purposeResponse.trim()) return;
    setSavingPurpose(true);
    try {
      const supabase = getSupabaseClient();

      if (localZone.user_zone_id) {
        const { error } = await supabase
          .from('0008-ap-user-wellness-zones')
          .update({ purpose: purposeResponse.trim(), updated_at: new Date().toISOString() })
          .eq('id', localZone.user_zone_id);
        if (error) throw error;
      } else {
        const { data: newZone, error } = await supabase
          .from('0008-ap-user-wellness-zones')
          .insert({
            user_id: userId,
            domain_id: zone.domain_id,
            purpose: purposeResponse.trim(),
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setLocalZone(prev => ({ ...prev, user_zone_id: newZone.id }));
      }

      const updated = { ...localZone, purpose: purposeResponse.trim() };
      setLocalZone(updated);
      onZoneUpdated(updated);
      setEditingPurpose(false);
      showSavedFeedback('purpose');
    } catch (error) {
      console.error('Error saving purpose:', error);
      showErrorAlert('Failed to save purpose.');
    } finally {
      setSavingPurpose(false);
    }
  }

  async function saveIntrospectionAnswer(strategyType: 'vision' | 'mission') {
    const question = strategyType === 'vision' ? visionQuestion : missionQuestion;
    const answer = strategyType === 'vision' ? visionAnswer : missionAnswer;
    if (!question || !answer.trim()) return;

    const setSaving = strategyType === 'vision' ? setSavingVisionAnswer : setSavingMissionAnswer;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-question-responses')
        .insert({
          user_id: userId,
          question_id: question.id,
          response_text: answer.trim(),
          context_type: 'weekly_alignment',
          domain: 'wellness',
          week_start: weekStartDate,
        });

      if (error) throw error;

      if (strategyType === 'vision') {
        setVisionAnswer('');
      } else {
        setMissionAnswer('');
      }

      await loadIntrospectionData(strategyType);
      showSavedFeedback(`${strategyType}Answer`);
    } catch (error) {
      console.error(`Error saving ${strategyType} answer:`, error);
      showErrorAlert('Failed to save response.');
    } finally {
      setSaving(false);
    }
  }

  async function updateIntrospectionAnswer(responseId: string, strategyType: 'vision' | 'mission') {
    if (!editingResponseText.trim()) return;
    setSavingEditResponse(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-question-responses')
        .update({ response_text: editingResponseText.trim() })
        .eq('id', responseId)
        .eq('user_id', userId);
      if (error) throw error;
      setEditingResponseId(null);
      setEditingResponseText('');
      await loadIntrospectionData(strategyType);
      showSavedFeedback(`${strategyType}Edit`);
    } catch (error) {
      console.error('Error updating response:', error);
      showErrorAlert('Failed to update response.');
    } finally {
      setSavingEditResponse(false);
    }
  }

  function renderSavedBadge(key: string) {
    if (!savedItems[key]) return null;
    return (
      <View style={[st.savedBadge, { backgroundColor: '#10b981' }]}>
        <Check size={12} color="#FFFFFF" />
        <Text style={st.savedBadgeText}>Saved</Text>
      </View>
    );
  }

  function renderCircleAction(
    icon: any,
    label: string,
    color: string,
    onPress: () => void,
    disabled: boolean,
    saving?: boolean,
  ) {
    return (
      <TouchableOpacity
        style={[st.circleActionWrap, { opacity: disabled ? 0.4 : 1 }]}
        onPress={onPress}
        disabled={disabled || saving}
        activeOpacity={0.7}
      >
        <View style={[st.circleIcon, { borderColor: color, backgroundColor: `${color}10` }]}>
          {saving ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Image source={icon} style={st.circleIconImage} resizeMode="contain" />
          )}
        </View>
        <Text style={[st.circleActionLabel, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function renderIntrospectionSection(
    strategyType: 'vision' | 'mission',
    question: IntrospectionQuestion | null,
    answer: string,
    setAnswer: (v: string) => void,
    saving: boolean,
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    responses: IntrospectionResponse[],
    allAnswered: boolean,
  ) {
    return (
      <>
        <TouchableOpacity
          style={[st.introspectionToggle, { borderColor: colors.border }]}
          onPress={() => setOpen(!isOpen)}
          activeOpacity={0.7}
        >
          <Text style={[st.introspectionToggleText, { color: zoneColor }]}>Deeper Introspection</Text>
          {isOpen ? <ChevronUp size={18} color={zoneColor} /> : <ChevronDown size={18} color={zoneColor} />}
        </TouchableOpacity>

        {isOpen && (
          <View style={st.introspectionContent}>
            {allAnswered ? (
              <Text style={[st.allAnsweredText, { color: colors.textSecondary }]}>
                You have answered all introspection questions for this zone's {strategyType}.
              </Text>
            ) : question ? (
              <>
                <Text style={[st.introspectionQuestion, { color: colors.text }]}>{question.question_text}</Text>
                <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[st.textInputSmall, { color: colors.text }]}
                    placeholder="Your reflection..."
                    placeholderTextColor={colors.textSecondary}
                    value={answer}
                    onChangeText={setAnswer}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
                <TouchableOpacity
                  style={[st.inlineSaveButton, { backgroundColor: answer.trim() ? zoneColor : colors.border, opacity: saving ? 0.7 : 1 }]}
                  onPress={() => saveIntrospectionAnswer(strategyType)}
                  disabled={saving || !answer.trim()}
                  activeOpacity={0.8}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <Text style={st.inlineSaveButtonText}>Save Response</Text>
                  )}
                </TouchableOpacity>
                {renderSavedBadge(`${strategyType}Answer`)}
              </>
            ) : (
              <Text style={[st.allAnsweredText, { color: colors.textSecondary }]}>
                No introspection questions available for this zone yet.
              </Text>
            )}

            {responses.length > 0 && (
              <View style={st.introspectionJournal}>
                <Text style={[st.journalSubheader, { color: zoneColor }]}>
                  {zone.name} {strategyType === 'vision' ? 'Vision' : 'Purpose'} Reflections
                </Text>
                {responses.map((resp) => (
                  <View key={resp.id} style={[st.journalEntry, { borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      {resp.question_text ? (
                        <Text style={{ color: zoneColor, fontSize: 13, fontWeight: '600', marginBottom: 4, fontStyle: 'italic', flex: 1, marginRight: 8 }}>
                          {resp.question_text}
                        </Text>
                      ) : <View style={{ flex: 1 }} />}
                      {editingResponseId !== resp.id && (
                        <TouchableOpacity
                          onPress={() => { setEditingResponseId(resp.id); setEditingResponseText(resp.response_text); }}
                          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        >
                          <Pencil size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {editingResponseId === resp.id ? (
                      <View style={{ marginTop: 4 }}>
                        <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <TextInput
                            style={[st.textInputSmall, { color: colors.text }]}
                            value={editingResponseText}
                            onChangeText={setEditingResponseText}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            autoFocus
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={[st.inlineSaveButton, { backgroundColor: editingResponseText.trim() ? zoneColor : colors.border, opacity: savingEditResponse ? 0.7 : 1 }]}
                            onPress={() => updateIntrospectionAnswer(resp.id, strategyType)}
                            disabled={savingEditResponse || !editingResponseText.trim()}
                            activeOpacity={0.8}
                          >
                            {savingEditResponse ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                              <Text style={st.inlineSaveButtonText}>Update</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                            onPress={() => { setEditingResponseId(null); setEditingResponseText(''); }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text style={[st.journalEntryText, { color: colors.text }]} numberOfLines={3}>{resp.response_text}</Text>
                        <Text style={[st.journalEntryDate, { color: colors.textSecondary }]}>{new Date(resp.created_at).toLocaleDateString()}</Text>
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </>
    );
  }

  function renderCollapsibleList(
    items: { id: string; content?: string; title?: string; created_at?: string }[],
    label: string,
    isOpen: boolean,
    toggle: () => void,
    emptyLabel: string,
    icon?: any,
    badgeColor?: string,
  ) {
    return (
      <>
        <TouchableOpacity
          style={[st.collapsibleHeader, { borderTopColor: colors.border }]}
          onPress={toggle}
          activeOpacity={0.7}
        >
          <Text style={[st.collapsibleLabel, { color: colors.textSecondary }]}>
            {label} ({items.length})
          </Text>
          {isOpen ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
        </TouchableOpacity>

        {isOpen && (
          <View style={{ marginTop: 8 }}>
            {items.length === 0 ? (
              <Text style={[st.emptyListText, { color: colors.textSecondary }]}>{emptyLabel}</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} style={[st.listRow, { borderBottomColor: colors.border }]}>
                  {icon && <Image source={icon} style={{ width: 16, height: 16 }} resizeMode="contain" />}
                  <View style={{ flex: 1 }}>
                    <Text style={[st.listRowText, { color: colors.text }]}>{item.title || item.content}</Text>
                    {item.created_at && (
                      <Text style={[st.listRowMeta, { color: colors.textSecondary }]}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </>
    );
  }

  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator size="large" color={zoneColor} />
        <Text style={[st.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={st.container}
        contentContainerStyle={st.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={st.headerSection}>
          <View style={st.headerRow}>
            <View style={[st.compassContainer, { backgroundColor: `${zoneColor}15` }]}>
              <Text style={st.largeEmoji}>{getZoneEmoji(zone.name)}</Text>
            </View>
            <View style={st.headerTextContainer}>
              <Text style={[st.stepLabel, { color: zoneColor }]}>My Living Vision Board</Text>
              <Text style={[st.stepTitle, { color: colors.text }]}>{zone.name}</Text>
            </View>
            <TouchableOpacity
              style={st.tooltipButton}
              onPress={() => setShowTooltip(!showTooltip)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <HelpCircle size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {showTooltip && (
            <View style={[st.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[st.tooltipText, { color: colors.text }]}>
                Use this board to stay intentional about your {zone.name.toLowerCase()} wellness each week.
              </Text>
            </View>
          )}
        </View>

        {/* SECTION 1: ONE THING THIS WEEK */}
        <View style={[st.card, { backgroundColor: `${zoneColor}08`, borderColor: `${zoneColor}30` }]}>
          <View style={st.cardHeader}>
            <View style={st.cardHeaderLeft}>
              <Image source={TaskListIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
              <Text style={[st.cardLabel, { color: zoneColor, marginLeft: 6 }]}>ONE THING THIS WEEK</Text>
            </View>
            {renderSavedBadge('oneThing')}
          </View>

          <Text style={[st.questionText, { color: colors.text }]}>
            What is the ONE thing I can do for my {zone.name.toLowerCase()} well-being this week?
          </Text>

          {existingOneThingTask ? (
            <View style={[st.existingItemCard, { backgroundColor: colors.surface, borderColor: `${zoneColor}30` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  {existingOneThingTask.type === 'event' ? (
                    <Image source={CalendarIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  ) : (
                    <Image source={TaskListIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  )}
                  <Text style={[st.existingItemText, { color: colors.text }]} numberOfLines={2}>
                    {existingOneThingTask.title}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setExistingOneThingTask(null);
                    setOneThingText(existingOneThingTask.title || '');
                  }}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  style={{ marginLeft: 8 }}
                >
                  <Pencil size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {(existingOneThingTask.due_date || existingOneThingTask.start_date) && (
                <Text style={[st.existingItemMeta, { color: colors.textSecondary }]}>
                  {formatShortDate((existingOneThingTask.due_date || existingOneThingTask.start_date || '').split('T')[0])}
                  {existingOneThingTask.type === 'event' && existingOneThingTask.start_time
                    ? ` \u2022 ${existingOneThingTask.start_time.slice(0, 5)}\u2013${(existingOneThingTask.end_time || '').slice(0, 5)}`
                    : ''}
                  {` \u2022 ${existingOneThingTask.type}`}
                </Text>
              )}
            </View>
          ) : (
            <>
              <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[st.textInput, { color: colors.text }]}
                  placeholder="My ONE thing this week is..."
                  placeholderTextColor={colors.textSecondary}
                  value={oneThingText}
                  onChangeText={setOneThingText}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>

              <Text style={[st.sectionDividerLabel, { color: colors.textSecondary }]}>TAKE ACTION</Text>
              <View style={st.circleActionsRow}>
                {renderCircleAction(TaskListIcon, 'Task', '#3B82F6', () => openDatePicker('task'), !oneThingText.trim(), savingOneThing)}
                {renderCircleAction(CalendarIcon, 'Event', '#8B5CF6', () => openDatePicker('event'), !oneThingText.trim(), savingOneThing)}
              </View>
            </>
          )}

          {renderCollapsibleList(
            zoneTasks.map(t => ({ id: t.id, title: t.title, created_at: t.due_date || t.start_date })),
            'Pending Tasks & Events',
            showTasksList,
            () => setShowTasksList(!showTasksList),
            'No pending tasks or events for this zone.',
            TaskListIcon,
          )}
        </View>

        {/* SECTION 2: ADD IDEA */}
        <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={st.cardHeader}>
            <View style={st.cardHeaderLeft}>
              <Image source={DepositIdeaIcon} style={{ width: 16, height: 16 }} resizeMode="contain" />
              <Text style={[st.cardLabel, { color: '#F59E0B', marginLeft: 6 }]}>ADD IDEA</Text>
            </View>
            {renderSavedBadge('idea')}
          </View>

          <Text style={[st.questionText, { color: colors.text }]}>
            Put down an idea that you are unable to do this week, but would like to in the future!
          </Text>

          <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[st.textInputSmall, { color: colors.text }]}
              placeholder="Capture your idea..."
              placeholderTextColor={colors.textSecondary}
              value={ideaText}
              onChangeText={setIdeaText}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={st.circleActionsRow}>
            {renderCircleAction(DepositIdeaIcon, 'Save Idea', '#F59E0B', saveDepositIdea, !ideaText.trim(), savingIdea)}
          </View>

          {renderCollapsibleList(
            zoneIdeas.map(i => ({ id: i.id, title: i.title })),
            'Pending Ideas',
            showIdeasList,
            () => setShowIdeasList(!showIdeasList),
            'No ideas captured for this zone yet.',
            DepositIdeaIcon,
          )}
        </View>

        {/* SECTION 3: ROSES / THORNS / REFLECT (3 tabs) */}
        <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[st.reflectionTabBar, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[
                st.reflectionTab,
                activeReflectionTab === 'rose' && { backgroundColor: ROSE_COLOR },
                activeReflectionTab !== 'rose' && { borderWidth: 1, borderColor: `${ROSE_COLOR}30` },
              ]}
              onPress={() => setActiveReflectionTab('rose')}
              activeOpacity={0.7}
            >
              <Image source={RoseIcon} style={[st.reflectionTabIcon, { opacity: activeReflectionTab === 'rose' ? 1 : 0.6 }]} resizeMode="contain" />
              <Text style={[st.reflectionTabText, { color: activeReflectionTab === 'rose' ? '#FFFFFF' : ROSE_COLOR, fontWeight: activeReflectionTab === 'rose' ? '700' : '500' }]}>Rose</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                st.reflectionTab,
                activeReflectionTab === 'thorn' && { backgroundColor: '#4B5563' },
                activeReflectionTab !== 'thorn' && { borderWidth: 1, borderColor: `${THORN_COLOR}30` },
              ]}
              onPress={() => setActiveReflectionTab('thorn')}
              activeOpacity={0.7}
            >
              <Image source={ThornIcon} style={[st.reflectionTabIcon, { opacity: activeReflectionTab === 'thorn' ? 1 : 0.6 }]} resizeMode="contain" />
              <Text style={[st.reflectionTabText, { color: activeReflectionTab === 'thorn' ? '#FFFFFF' : THORN_COLOR, fontWeight: activeReflectionTab === 'thorn' ? '700' : '500' }]}>Thorn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                st.reflectionTab,
                activeReflectionTab === 'reflection' && { backgroundColor: '#10B981' },
                activeReflectionTab !== 'reflection' && { borderWidth: 1, borderColor: '#10B98130' },
              ]}
              onPress={() => setActiveReflectionTab('reflection')}
              activeOpacity={0.7}
            >
              <Image source={ReflectionsIcon} style={[st.reflectionTabIcon, { opacity: activeReflectionTab === 'reflection' ? 1 : 0.6 }]} resizeMode="contain" />
              <Text style={[st.reflectionTabText, { color: activeReflectionTab === 'reflection' ? '#FFFFFF' : '#10B981', fontWeight: activeReflectionTab === 'reflection' ? '700' : '500' }]}>Reflect</Text>
            </TouchableOpacity>
          </View>

          {activeReflectionTab === 'rose' && (
            <View>
              <Text style={[st.hintText, { color: colors.textSecondary }]}>
                What's going well in your {zone.name.toLowerCase()} wellness?
              </Text>
              <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput style={[st.textInputSmall, { color: colors.text }]} placeholder="What's going well..." placeholderTextColor={colors.textSecondary} value={roseText} onChangeText={setRoseText} multiline numberOfLines={2} textAlignVertical="top" />
              </View>
              <View style={st.circleActionsRow}>
                {renderCircleAction(RoseIcon, 'Save Rose', ROSE_COLOR, saveRose, !roseText.trim(), savingRose)}
              </View>
              {renderSavedBadge('rose')}
            </View>
          )}

          {activeReflectionTab === 'thorn' && (
            <View>
              <Text style={[st.hintText, { color: colors.textSecondary }]}>
                What's been challenging in your {zone.name.toLowerCase()} wellness?
              </Text>
              <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput style={[st.textInputSmall, { color: colors.text }]} placeholder="What's been challenging..." placeholderTextColor={colors.textSecondary} value={thornText} onChangeText={setThornText} multiline numberOfLines={2} textAlignVertical="top" />
              </View>
              <View style={st.circleActionsRow}>
                {renderCircleAction(ThornIcon, 'Save Thorn', '#4B5563', saveThorn, !thornText.trim(), savingThorn)}
              </View>
              {renderSavedBadge('thorn')}
            </View>
          )}

          {activeReflectionTab === 'reflection' && (
            <View>
              <Text style={[st.hintText, { color: colors.textSecondary }]}>
                Any other insights about your {zone.name.toLowerCase()} wellness?
              </Text>
              <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput style={[st.textInputSmall, { color: colors.text }]} placeholder="Your thoughts..." placeholderTextColor={colors.textSecondary} value={thoughtText} onChangeText={setThoughtText} multiline numberOfLines={2} textAlignVertical="top" />
              </View>
              <View style={st.circleActionsRow}>
                {renderCircleAction(ReflectionsIcon, 'Save Thought', '#10B981', saveThought, !thoughtText.trim(), savingThought)}
              </View>
              {renderSavedBadge('thought')}
            </View>
          )}

          {renderCollapsibleList(
            (activeReflectionTab === 'rose' ? weekRoses : activeReflectionTab === 'thorn' ? weekThorns : weekReflections)
              .map(r => ({ id: r.id, content: r.content, created_at: r.created_at })),
            `This Week's ${activeReflectionTab === 'rose' ? 'Roses' : activeReflectionTab === 'thorn' ? 'Thorns' : 'Reflections'}`,
            showReflectionsList,
            () => setShowReflectionsList(!showReflectionsList),
            `No ${activeReflectionTab === 'rose' ? 'roses' : activeReflectionTab === 'thorn' ? 'thorns' : 'reflections'} captured this week yet.`,
          )}
        </View>

        {/* SECTION 4: MY DREAM */}
        <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={st.cardHeader}>
            <Text style={[st.cardLabel, { color: zoneColor }]}>MY DREAM FOR THIS ZONE</Text>
            {localZone.dream && !editingDream && (
              <TouchableOpacity onPress={() => { setEditingDream(true); setDreamResponse(localZone.dream || ''); }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pencil size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {renderSavedBadge('dream')}
          </View>

          <Text style={[st.questionText, { color: colors.text, marginBottom: 12 }]}>
            What is your dream for your {zone.name.toLowerCase()} well-being?
          </Text>

          {localZone.dream && !editingDream ? (
            <Text style={[st.statementText, { color: colors.text }]}>"{localZone.dream}"</Text>
          ) : (
            <>
              <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[st.textInput, { color: colors.text }]}
                  placeholder="My dream for this zone is..."
                  placeholderTextColor={colors.textSecondary}
                  value={dreamResponse}
                  onChangeText={setDreamResponse}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity
                style={[st.inlineSaveButton, { backgroundColor: dreamResponse.trim() ? zoneColor : colors.border, opacity: savingDream ? 0.7 : 1 }]}
                onPress={saveZoneDream}
                disabled={savingDream || !dreamResponse.trim()}
                activeOpacity={0.8}
              >
                {savingDream ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <Text style={st.inlineSaveButtonText}>Save Dream</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {renderIntrospectionSection(
            'vision', visionQuestion, visionAnswer, setVisionAnswer,
            savingVisionAnswer, visionIntrospectionOpen, setVisionIntrospectionOpen,
            visionResponses, allVisionAnswered,
          )}
        </View>

        {/* SECTION 5: MY PURPOSE */}
        <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={st.cardHeader}>
            <Text style={[st.cardLabel, { color: zoneColor }]}>MY PURPOSE IN THIS ZONE</Text>
            {localZone.purpose && !editingPurpose && (
              <TouchableOpacity onPress={() => { setEditingPurpose(true); setPurposeResponse(localZone.purpose || ''); }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pencil size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {renderSavedBadge('purpose')}
          </View>

          {localZone.purpose && !editingPurpose ? (
            <Text style={[st.statementText, { color: colors.text }]}>"{localZone.purpose}"</Text>
          ) : (
            <>
              <Text style={[st.hintText, { color: colors.textSecondary, marginBottom: 12 }]}>
                Describe what success looks like in this zone.
              </Text>
              <View style={[st.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[st.textInput, { color: colors.text }]}
                  placeholder="My purpose in this zone is to..."
                  placeholderTextColor={colors.textSecondary}
                  value={purposeResponse}
                  onChangeText={setPurposeResponse}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity
                style={[st.inlineSaveButton, { backgroundColor: purposeResponse.trim() ? zoneColor : colors.border, opacity: savingPurpose ? 0.7 : 1 }]}
                onPress={saveZonePurpose}
                disabled={savingPurpose || !purposeResponse.trim()}
                activeOpacity={0.8}
              >
                {savingPurpose ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <Text style={st.inlineSaveButtonText}>Save Purpose</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {renderIntrospectionSection(
            'mission', missionQuestion, missionAnswer, setMissionAnswer,
            savingMissionAnswer, missionIntrospectionOpen, setMissionIntrospectionOpen,
            missionResponses, allMissionAnswered,
          )}
        </View>

        {/* Back to Zones */}
        <TouchableOpacity
          style={[st.secondaryButton, { borderColor: zoneColor }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={[st.secondaryButtonText, { color: zoneColor }]}>Back to Zones</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DATE PICKER MODAL */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[st.modalTitle, { color: colors.text }]}>
              {takeActionType === 'event' ? 'Pick Day & Time' : 'Pick a Day'}
            </Text>
            <Text style={[st.modalSubtitle, { color: colors.textSecondary }]}>"{oneThingText}"</Text>

            <View style={st.dayGrid}>
              {weekDates.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[st.dayButton, { backgroundColor: selectedDate === d.value ? zoneColor : colors.surface, borderColor: selectedDate === d.value ? zoneColor : colors.border }]}
                  onPress={() => setSelectedDate(d.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[st.dayButtonText, { color: selectedDate === d.value ? '#FFFFFF' : colors.text }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {takeActionType === 'event' && (
              <View style={st.timeRow}>
                <View style={st.timePickerRow}>
                  <Text style={[st.timePickerLabel, { color: colors.textSecondary }]}>Start</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.timeScroller} contentContainerStyle={st.timeScrollerContent}>
                    {Array.from({ length: 48 }, (_, i) => {
                      const h = String(Math.floor(i / 2)).padStart(2, '0');
                      const m = i % 2 === 0 ? '00' : '30';
                      const val = `${h}:${m}`;
                      const isSelected = selectedTime === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[st.timeChip, { backgroundColor: isSelected ? zoneColor : colors.surface, borderColor: isSelected ? zoneColor : colors.border }]}
                          onPress={() => {
                            setSelectedTime(val);
                            const endH = String((Math.floor(i / 2) + 1) % 24).padStart(2, '0');
                            setSelectedEndTime(`${endH}:${m}`);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[st.timeChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>{val}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                <View style={st.timePickerRow}>
                  <Text style={[st.timePickerLabel, { color: colors.textSecondary }]}>End</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.timeScroller} contentContainerStyle={st.timeScrollerContent}>
                    {Array.from({ length: 48 }, (_, i) => {
                      const h = String(Math.floor(i / 2)).padStart(2, '0');
                      const m = i % 2 === 0 ? '00' : '30';
                      const val = `${h}:${m}`;
                      const isSelected = selectedEndTime === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[st.timeChip, { backgroundColor: isSelected ? zoneColor : colors.surface, borderColor: isSelected ? zoneColor : colors.border }]}
                          onPress={() => setSelectedEndTime(val)}
                          activeOpacity={0.7}
                        >
                          <Text style={[st.timeChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>{val}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            <View style={st.modalButtons}>
              <TouchableOpacity style={[st.modalCancelButton, { borderColor: colors.border }]} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalConfirmButton, { backgroundColor: selectedDate ? zoneColor : colors.border }]}
                onPress={confirmSaveOneThing}
                disabled={!selectedDate || savingOneThing}
                activeOpacity={0.8}
              >
                {savingOneThing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                    Save {takeActionType === 'event' ? 'Event' : 'Task'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 16 },
  headerSection: { marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  compassContainer: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  largeEmoji: { fontSize: 40 },
  headerTextContainer: { flex: 1 },
  stepLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  stepTitle: { fontSize: 24, fontWeight: '700' },
  tooltipButton: { padding: 8 },
  tooltipContent: { marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  tooltipText: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  cardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  questionText: { fontSize: 16, lineHeight: 22, marginBottom: 12 },
  hintText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  statementText: { fontSize: 16, fontStyle: 'italic', lineHeight: 22 },
  inputContainer: { borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  textInput: { padding: 12, fontSize: 16, minHeight: 80 },
  textInputSmall: { padding: 12, fontSize: 15, minHeight: 60 },
  existingItemCard: { padding: 12, borderRadius: 10, borderWidth: 1 },
  existingItemText: { fontSize: 15, fontWeight: '500' },
  existingItemMeta: { fontSize: 12, marginTop: 6 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  savedBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  sectionDividerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  circleActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 4,
  },
  circleActionWrap: {
    alignItems: 'center',
    gap: 8,
  },
  circleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleIconImage: {
    width: 26,
    height: 26,
  },
  circleActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  reflectionTabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  reflectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reflectionTabIcon: {
    width: 16,
    height: 16,
  },
  reflectionTabText: {
    fontSize: 13,
  },

  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 16,
    borderTopWidth: 1,
  },
  collapsibleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyListText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  listRowText: {
    fontSize: 14,
    lineHeight: 20,
  },
  listRowMeta: {
    fontSize: 11,
    marginTop: 2,
  },

  inlineSaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignSelf: 'flex-start' },
  inlineSaveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 2, marginTop: 16 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  introspectionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, marginTop: 16, borderTopWidth: 1 },
  introspectionToggleText: { fontSize: 14, fontWeight: '600' },
  introspectionContent: { paddingTop: 12 },
  introspectionQuestion: { fontSize: 15, lineHeight: 22, marginBottom: 8, fontWeight: '500' },
  introspectionContext: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  allAnsweredText: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  introspectionJournal: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  journalSubheader: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  journalEntry: { paddingVertical: 10, borderBottomWidth: 1 },
  journalEntryText: { fontSize: 14, lineHeight: 20 },
  journalEntryDate: { fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, fontStyle: 'italic', marginBottom: 20 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dayButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  dayButtonText: { fontSize: 13, fontWeight: '600' },
  timeRow: { marginBottom: 16, gap: 12 },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePickerLabel: { fontSize: 13, fontWeight: '600', width: 36 },
  timeScroller: { flex: 1, maxHeight: 44 },
  timeScrollerContent: { gap: 6 },
  timeChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  timeChipText: { fontSize: 13, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelButton: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalConfirmButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
});
