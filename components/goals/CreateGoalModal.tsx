import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Target, Calendar, ChevronDown } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, toLocalISOString } from '@/lib/dateUtils';

type TimeframeType = '1year' | '12week' | 'custom';

interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
}

interface Role {
  id: string;
  label: string;
  color?: string;
}

interface Domain {
  id: string;
  name: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
}

interface OneYearGoal {
  id: string;
  title: string;
  year_target_date: string;
}

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  createTwelveWeekGoal: (goalData: {
    title: string;
    description?: string;
  }) => Promise<any>;
  createCustomGoal: (goalData: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }, selectedTimeline?: { id: string; start_date?: string | null; end_date?: string | null }) => Promise<any>;
  selectedTimeline: Timeline | null;
  allTimelines: Timeline[];
}

export function CreateGoalModal({
  visible,
  onClose,
  onSubmitSuccess,
  createTwelveWeekGoal,
  createCustomGoal,
  selectedTimeline,
  allTimelines
}: CreateGoalModalProps) {
  // Timeframe state
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>('12week');
  const [currentYear] = useState(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    notes: '',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    parentGoalId: null as string | null,
    weeklyTarget: '',
    totalTarget: '',
    completionReward: '',
  });

  // Data states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [oneYearGoals, setOneYearGoals] = useState<OneYearGoal[]>([]);
  const [activeGlobalTimelines, setActiveGlobalTimelines] = useState<Timeline[]>([]);
  const [customTimelines, setCustomTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Timeline selection state
  const [selectedGlobalTimelineId, setSelectedGlobalTimelineId] = useState<string | null>(null);
  const [selectedCustomTimelineId, setSelectedCustomTimelineId] = useState<string | null>(null);

  // Custom timeline creation state
  const [showCreateCustomTimeline, setShowCreateCustomTimeline] = useState(false);
  const [newTimelineName, setNewTimelineName] = useState('');
  const [newTimelineStartDate, setNewTimelineStartDate] = useState('');
  const [newTimelineEndDate, setNewTimelineEndDate] = useState('');

  useEffect(() => {
    if (visible) {
      fetchData();
      setDefaultSelections();
    } else {
      resetForm();
    }
  }, [visible]);

  const setDefaultSelections = () => {
    // Check if after October 1st
    const today = new Date();
    const isAfterOct1 = today.getMonth() >= 9;

    if (isAfterOct1) {
      setShowYearPicker(true);
    }

    // Auto-select active global timeline if only one exists
    if (allTimelines.length === 1 && allTimelines[0].source === 'global') {
      setSelectedGlobalTimelineId(allTimelines[0].id);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData },
        { data: oneYearGoalsData },
        { data: globalTimelinesData },
        { data: customTimelinesData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id),
        supabase
          .from('0008-ap-goals-1y')
          .select('id, title, year_target_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('title'),
        supabase
          .from('0008-ap-user-global-timelines')
          .select('id, global_cycle_id, status')
          .eq('user_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('0008-ap-custom-timelines')
          .select('id, name, start_date, end_date, timeline_type')
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .order('name')
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(krData || []);
      setOneYearGoals(oneYearGoalsData || []);

      // Process global timelines
      const globalTimelines: Timeline[] = [];
      if (globalTimelinesData) {
        for (const ugt of globalTimelinesData) {
          const { data: cycleData } = await supabase
            .from('0008-ap-global-cycles')
            .select('title, start_date, end_date')
            .eq('id', ugt.global_cycle_id)
            .single();

          if (cycleData) {
            globalTimelines.push({
              id: ugt.id,
              source: 'global',
              title: cycleData.title,
              start_date: cycleData.start_date,
              end_date: cycleData.end_date,
            });
          }
        }
      }
      setActiveGlobalTimelines(globalTimelines);

      // Auto-select first global timeline
      if (globalTimelines.length > 0 && !selectedGlobalTimelineId) {
        setSelectedGlobalTimelineId(globalTimelines[0].id);
      }

      // Process custom timelines
      const customTls: Timeline[] = (customTimelinesData || []).map(ct => ({
        id: ct.id,
        source: 'custom' as const,
        title: ct.name,
        start_date: ct.start_date,
        end_date: ct.end_date,
        timeline_type: ct.timeline_type,
      }));
      setCustomTimelines(customTls);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      notes: '',
      selectedRoleIds: [],
      selectedDomainIds: [],
      selectedKeyRelationshipIds: [],
      parentGoalId: null,
      weeklyTarget: '',
      totalTarget: '',
      completionReward: '',
    });
    setSelectedTimeframe('12week');
    setSelectedGlobalTimelineId(null);
    setSelectedCustomTimelineId(null);
    setShowCreateCustomTimeline(false);
    setNewTimelineName('');
    setNewTimelineStartDate('');
    setNewTimelineEndDate('');
    setShowYearPicker(false);
    setSelectedYear(currentYear);
  };

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleCreateCustomTimeline = async () => {
    if (!newTimelineName.trim() || !newTimelineStartDate || !newTimelineEndDate) {
      Alert.alert('Error', 'Please fill in all custom timeline fields');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { data: newTimeline, error } = await supabase
        .from('0008-ap-custom-timelines')
        .insert({
          user_id: user.id,
          name: newTimelineName.trim(),
          start_date: newTimelineStartDate,
          end_date: newTimelineEndDate,
          timeline_type: 'custom',
        })
        .select()
        .single();

      if (error) throw error;

      // Add to custom timelines list
      const newTl: Timeline = {
        id: newTimeline.id,
        source: 'custom',
        title: newTimeline.name,
        start_date: newTimeline.start_date,
        end_date: newTimeline.end_date,
        timeline_type: newTimeline.timeline_type,
      };
      setCustomTimelines(prev => [...prev, newTl]);
      setSelectedCustomTimelineId(newTimeline.id);
      setShowCreateCustomTimeline(false);
      setNewTimelineName('');
      setNewTimelineStartDate('');
      setNewTimelineEndDate('');

      Alert.alert('Success', 'Custom timeline created');
    } catch (error) {
      console.error('Error creating custom timeline:', error);
      Alert.alert('Error', 'Failed to create custom timeline');
    }
  };

  const handleCreateGoal = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    // Validate timeline selection
    if (selectedTimeframe === '12week' && !selectedGlobalTimelineId) {
      Alert.alert('Error', 'Please select a 12-week timeline');
      return;
    }

    if (selectedTimeframe === 'custom' && !selectedCustomTimelineId) {
      Alert.alert('Error', 'Please select or create a custom timeline');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      let goalId: string;
      let parentType: string;

      // Create goal based on selected timeframe
      if (selectedTimeframe === '1year') {
        // Create 1-year goal
        const targetDate = `${selectedYear}-12-31`;
        const { data: newGoal, error } = await supabase
          .from('0008-ap-goals-1y')
          .insert({
            user_id: user.id,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            year_target_date: targetDate,
            status: 'active',
          })
          .select()
          .single();

        if (error) throw error;
        goalId = newGoal.id;
        parentType = '1y_goal';

      } else if (selectedTimeframe === '12week') {
        // Verify global timeline is active
        if (!selectedGlobalTimelineId) {
          throw new Error('No global timeline selected');
        }

        const { data: timelineCheck } = await supabase
          .from('0008-ap-user-global-timelines')
          .select('status')
          .eq('id', selectedGlobalTimelineId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!timelineCheck || timelineCheck.status !== 'active') {
          Alert.alert('Timeline Inactive', 'This timeline is no longer active.');
          setSaving(false);
          return;
        }

        // Create 12-week goal
        const { data: newGoal, error } = await supabase
          .from('0008-ap-goals-12wk')
          .insert({
            user_id: user.id,
            user_global_timeline_id: selectedGlobalTimelineId,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            status: 'active',
            weekly_target: formData.weeklyTarget ? parseInt(formData.weeklyTarget) : null,
            total_target: formData.totalTarget ? parseInt(formData.totalTarget) : null,
            completion_reward: formData.completionReward.trim() || null,
            parent_goal_id: formData.parentGoalId,
            parent_goal_type: formData.parentGoalId ? '1y' : null,
          })
          .select()
          .single();

        if (error) throw error;
        goalId = newGoal.id;
        parentType = 'goal';

      } else {
        // Create custom goal
        if (!selectedCustomTimelineId) {
          throw new Error('No custom timeline selected');
        }

        const selectedCustomTimeline = customTimelines.find(t => t.id === selectedCustomTimelineId);
        if (!selectedCustomTimeline) {
          throw new Error('Selected timeline not found');
        }

        const { data: newGoal, error } = await supabase
          .from('0008-ap-goals-custom')
          .insert({
            user_id: user.id,
            custom_timeline_id: selectedCustomTimelineId,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            status: 'active',
            weekly_target: formData.weeklyTarget ? parseInt(formData.weeklyTarget) : null,
            total_target: formData.totalTarget ? parseInt(formData.totalTarget) : null,
            completion_reward: formData.completionReward.trim() || null,
            parent_goal_id: formData.parentGoalId,
            parent_goal_type: formData.parentGoalId ? '1y' : null,
          })
          .select()
          .single();

        if (error) throw error;
        goalId = newGoal.id;
        parentType = 'custom_goal';
      }

      // Insert role joins
      if (formData.selectedRoleIds.length > 0) {
        const roleJoins = formData.selectedRoleIds.map(roleId => ({
          parent_id: goalId,
          parent_type: parentType,
          role_id: roleId,
          user_id: user.id,
        }));
        const { error: roleError } = await supabase
          .from('0008-ap-universal-roles-join')
          .insert(roleJoins);
        if (roleError) throw roleError;
      }

      // Insert domain joins
      if (formData.selectedDomainIds.length > 0) {
        const domainJoins = formData.selectedDomainIds.map(domainId => ({
          parent_id: goalId,
          parent_type: parentType,
          domain_id: domainId,
          user_id: user.id,
        }));
        const { error: domainError } = await supabase
          .from('0008-ap-universal-domains-join')
          .insert(domainJoins);
        if (domainError) throw domainError;
      }

      // Insert key relationship joins
      if (formData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = formData.selectedKeyRelationshipIds.map(krId => ({
          parent_id: goalId,
          parent_type: parentType,
          key_relationship_id: krId,
          user_id: user.id,
        }));
        const { error: krError } = await supabase
          .from('0008-ap-universal-key-relationships-join')
          .insert(krJoins);
        if (krError) throw krError;
      }

      // Insert note if provided
      if (formData.notes.trim()) {
        const { data: newNote, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: formData.notes.trim(),
          })
          .select()
          .single();
        if (noteError) throw noteError;

        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            parent_id: goalId,
            parent_type: parentType,
            note_id: newNote.id,
            user_id: user.id,
          });
        if (noteJoinError) throw noteJoinError;
      }

      Alert.alert('Success', 'Goal created successfully!');
      onSubmitSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const getTimelineInfo = (timeline: Timeline) => {
    if (!timeline.start_date || !timeline.end_date) return '';
    const start = new Date(timeline.start_date);
    const end = new Date(timeline.end_date);
    const today = new Date();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const weeksRemaining = Math.ceil(remainingDays / 7);
    return `${weeksRemaining} weeks remaining`;
  };

  const renderTimeframeSelector = () => (
    <View style={styles.field}>
      <Text style={styles.label}>What's your timeframe? *</Text>

      <TouchableOpacity
        style={[styles.radioOption, selectedTimeframe === '1year' && styles.radioOptionSelected]}
        onPress={() => {
          setSelectedTimeframe('1year');
          const today = new Date();
          if (today.getMonth() >= 9) {
            setShowYearPicker(true);
          }
        }}
      >
        <View style={styles.radio}>
          {selectedTimeframe === '1year' && <View style={styles.radioInner} />}
        </View>
        <View style={styles.radioContent}>
          <Text style={styles.radioLabel}>This Year</Text>
          <Text style={styles.radioSubtext}>Dec 31, {selectedYear}</Text>
        </View>
      </TouchableOpacity>

      {selectedTimeframe === '1year' && showYearPicker && (
        <View style={styles.yearPickerContainer}>
          <Text style={styles.yearPickerLabel}>Which year?</Text>
          <View style={styles.yearButtons}>
            <TouchableOpacity
              style={[styles.yearButton, selectedYear === currentYear && styles.yearButtonActive]}
              onPress={() => setSelectedYear(currentYear)}
            >
              <Text style={[styles.yearButtonText, selectedYear === currentYear && styles.yearButtonTextActive]}>
                This Year ({currentYear})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.yearButton, selectedYear === currentYear + 1 && styles.yearButtonActive]}
              onPress={() => setSelectedYear(currentYear + 1)}
            >
              <Text style={[styles.yearButtonText, selectedYear === currentYear + 1 && styles.yearButtonTextActive]}>
                Next Year ({currentYear + 1})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.radioOption, selectedTimeframe === '12week' && styles.radioOptionSelected]}
        onPress={() => setSelectedTimeframe('12week')}
      >
        <View style={styles.radio}>
          {selectedTimeframe === '12week' && <View style={styles.radioInner} />}
        </View>
        <View style={styles.radioContent}>
          <Text style={styles.radioLabel}>This 12-Week Cycle</Text>
          <Text style={styles.radioSubtext}>Default option</Text>
        </View>
      </TouchableOpacity>

      {selectedTimeframe === '12week' && (
        <View style={styles.timelineDetails}>
          {activeGlobalTimelines.length === 0 ? (
            <View style={styles.noTimelinesMessage}>
              <Text style={styles.noTimelinesText}>
                No active 12-week timeline. Please join or activate a cycle first.
              </Text>
            </View>
          ) : activeGlobalTimelines.length === 1 ? (
            <View style={styles.timelineInfo}>
              <Text style={styles.timelineInfoTitle}>{activeGlobalTimelines[0].title}</Text>
              <Text style={styles.timelineInfoSubtext}>{getTimelineInfo(activeGlobalTimelines[0])}</Text>
            </View>
          ) : (
            <View style={styles.timelineDropdown}>
              <Text style={styles.dropdownLabel}>Select Timeline:</Text>
              {activeGlobalTimelines.map(timeline => (
                <TouchableOpacity
                  key={timeline.id}
                  style={[
                    styles.dropdownOption,
                    selectedGlobalTimelineId === timeline.id && styles.dropdownOptionSelected
                  ]}
                  onPress={() => setSelectedGlobalTimelineId(timeline.id)}
                >
                  <View style={styles.radio}>
                    {selectedGlobalTimelineId === timeline.id && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.radioContent}>
                    <Text style={styles.radioLabel}>{timeline.title}</Text>
                    <Text style={styles.radioSubtext}>{getTimelineInfo(timeline)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.radioOption, selectedTimeframe === 'custom' && styles.radioOptionSelected]}
        onPress={() => setSelectedTimeframe('custom')}
      >
        <View style={styles.radio}>
          {selectedTimeframe === 'custom' && <View style={styles.radioInner} />}
        </View>
        <View style={styles.radioContent}>
          <Text style={styles.radioLabel}>Custom Timeline</Text>
          <Text style={styles.radioSubtext}>Choose or create your own</Text>
        </View>
      </TouchableOpacity>

      {selectedTimeframe === 'custom' && (
        <View style={styles.timelineDetails}>
          {customTimelines.length > 0 && (
            <View style={styles.customTimelineList}>
              {customTimelines.map(timeline => (
                <TouchableOpacity
                  key={timeline.id}
                  style={[
                    styles.dropdownOption,
                    selectedCustomTimelineId === timeline.id && styles.dropdownOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedCustomTimelineId(timeline.id);
                    setShowCreateCustomTimeline(false);
                  }}
                >
                  <View style={styles.radio}>
                    {selectedCustomTimelineId === timeline.id && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.radioContent}>
                    <Text style={styles.radioLabel}>{timeline.title}</Text>
                    {timeline.start_date && timeline.end_date && (
                      <Text style={styles.radioSubtext}>
                        {formatLocalDate(timeline.start_date)} - {formatLocalDate(timeline.end_date)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.createTimelineButton}
            onPress={() => setShowCreateCustomTimeline(!showCreateCustomTimeline)}
          >
            <Text style={styles.createTimelineButtonText}>
              {showCreateCustomTimeline ? '− Cancel' : '+ Create new custom timeline'}
            </Text>
          </TouchableOpacity>

          {showCreateCustomTimeline && (
            <View style={styles.createTimelineForm}>
              <TextInput
                style={styles.input}
                value={newTimelineName}
                onChangeText={setNewTimelineName}
                placeholder="Timeline name"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={styles.input}
                value={newTimelineStartDate}
                onChangeText={setNewTimelineStartDate}
                placeholder="Start date (YYYY-MM-DD)"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={styles.input}
                value={newTimelineEndDate}
                onChangeText={setNewTimelineEndDate}
                placeholder="End date (YYYY-MM-DD)"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                style={styles.createTimelineSubmit}
                onPress={handleCreateCustomTimeline}
              >
                <Text style={styles.createTimelineSubmitText}>Create Timeline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderParentGoalSelector = () => {
    if (selectedTimeframe === '1year' || oneYearGoals.length === 0) return null;

    return (
      <View style={styles.field}>
        <Text style={styles.label}>Contributing to (optional)</Text>
        <Text style={styles.helperText}>Link this goal to a 1-year goal</Text>
        <View style={styles.parentGoalContainer}>
          <TouchableOpacity
            style={[
              styles.parentGoalOption,
              formData.parentGoalId === null && styles.parentGoalOptionSelected
            ]}
            onPress={() => setFormData(prev => ({ ...prev, parentGoalId: null }))}
          >
            <View style={styles.radio}>
              {formData.parentGoalId === null && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioLabel}>None (standalone goal)</Text>
          </TouchableOpacity>

          {oneYearGoals.map(goal => (
            <TouchableOpacity
              key={goal.id}
              style={[
                styles.parentGoalOption,
                formData.parentGoalId === goal.id && styles.parentGoalOptionSelected
              ]}
              onPress={() => setFormData(prev => ({ ...prev, parentGoalId: goal.id }))}
            >
              <View style={styles.radio}>
                {formData.parentGoalId === goal.id && <View style={styles.radioInner} />}
              </View>
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>{goal.title}</Text>
                <Text style={styles.radioSubtext}>
                  Target: {formatLocalDate(goal.year_target_date)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const shouldShowTargets = selectedTimeframe === '12week' || selectedTimeframe === 'custom';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Goal</Text>
          <TouchableOpacity
            style={[styles.saveButton, (!formData.title.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleCreateGoal}
            disabled={!formData.title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0078d4" />
              <Text style={styles.loadingText}>Loading form data...</Text>
            </View>
          ) : (
            <View style={styles.form}>
              {renderTimeframeSelector()}

              <View style={styles.field}>
                <Text style={styles.label}>Goal Title *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                  placeholder="Enter your goal title"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Describe your goal and why it matters..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              {renderParentGoalSelector()}

              {shouldShowTargets && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Weekly Target (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.weeklyTarget}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, weeklyTarget: text }))}
                      placeholder="e.g., 5"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Total Target (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.totalTarget}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, totalTarget: text }))}
                      placeholder="e.g., 60"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Completion Reward (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.completionReward}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, completionReward: text }))}
                      placeholder="What will you celebrate with?"
                      placeholderTextColor="#9ca3af"
                      maxLength={200}
                    />
                  </View>
                </>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Wellness Domains</Text>
                <View style={styles.checkboxContainer}>
                  {allDomains.map(domain => {
                    const isSelected = formData.selectedDomainIds.includes(domain.id);
                    return (
                      <TouchableOpacity
                        key={domain.id}
                        style={styles.checkboxRowGrid}
                        onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabelGrid}>{domain.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Active Roles</Text>
                <View style={styles.checkboxContainer}>
                  {allRoles.map(role => {
                    const isSelected = formData.selectedRoleIds.includes(role.id);
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={styles.checkboxRowGrid}
                        onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabelGrid}>{role.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {filteredKeyRelationships.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Key Relationships</Text>
                  <View style={styles.checkboxContainer}>
                    {filteredKeyRelationships.map(kr => {
                      const isSelected = formData.selectedKeyRelationshipIds.includes(kr.id);
                      return (
                        <TouchableOpacity
                          key={kr.id}
                          style={styles.checkboxRowGrid}
                          onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.checkboxLabelGrid}>{kr.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  placeholder="Additional notes for this goal..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
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
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  radioOptionSelected: {
    borderColor: '#0078d4',
    backgroundColor: '#eff6ff',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0078d4',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0078d4',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  radioSubtext: {
    fontSize: 13,
    color: '#6b7280',
  },
  yearPickerContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    marginLeft: 32,
  },
  yearPickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  yearButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  yearButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  yearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  yearButtonTextActive: {
    color: '#ffffff',
  },
  timelineDetails: {
    marginLeft: 32,
    marginTop: 8,
  },
  timelineInfo: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  timelineInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timelineInfoSubtext: {
    fontSize: 13,
    color: '#6b7280',
  },
  timelineDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    paddingLeft: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  dropdownOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  customTimelineList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  createTimelineButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  createTimelineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0078d4',
  },
  createTimelineForm: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  createTimelineSubmit: {
    backgroundColor: '#0078d4',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createTimelineSubmitText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  parentGoalContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
  },
  parentGoalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  parentGoalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  noTimelinesMessage: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
  },
  noTimelinesText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  checkboxRowGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '25%',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 3,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  checkboxLabelGrid: {
    fontSize: 11,
    color: '#1f2937',
    flex: 1,
    lineHeight: 14,
  },
});
