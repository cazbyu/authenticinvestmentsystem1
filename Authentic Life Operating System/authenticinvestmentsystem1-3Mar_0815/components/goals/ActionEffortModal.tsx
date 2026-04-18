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
  Switch,
  Platform,
} from 'react-native';
import { X, Lock, ChevronDown, ChevronUp, Paperclip, Image as ImageIcon, File, Dumbbell, DollarSign, Ruler, BookOpen, ListChecks, Plus as PlusIcon } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getSupabaseClient } from '@/lib/supabase';
import { Timeline } from '@/hooks/useGoals';
import { TEMPLATE_TYPES, TEMPLATE_CONFIGS, TemplateType } from '@/lib/activityTemplates';
import { processWeeksWithAvailability, getEffectiveTargetDays, ProcessedWeek } from '@/lib/weekUtils';
import { ExerciseFormRow, ExerciseFormData } from '@/components/goals/ExerciseFormRow';
import { createSession, addExerciseToSession, getExercisesForSession, updateSession, updateExercise, removeExerciseFromSession, SessionExercise } from '@/services/sessionService';
import {
  getDefaultStartTime,
  getDefaultEndTime,
  formatTimeDisplay,
  formatTimeForDB,
  parseDBTime,
  generateTimeOptions,
} from '@/lib/timePickerUtils';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';

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

interface TwelveWeekGoal {
  id: string;
  title: string;
  description?: string;
  goal_type?: '12week' | 'custom';
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
}

interface CycleWeek {
  week_number: number;
  start_date: string;
  end_date: string;
}

interface AttachedFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  isExisting?: boolean;
  id?: string;
  noteId?: string;
  filePath?: string;
}

interface ActionEffortModalProps {
  visible: boolean;
  onClose: () => void;
  goal: TwelveWeekGoal | null;
  cycleWeeks: CycleWeek[];
  timeline: Timeline | null;
  createTaskWithWeekPlan: (taskData: any, timeline: Timeline) => Promise<any>;
  onDelete?: (actionId: string) => Promise<void>;
  initialData?: {
    milestone_id?: string | null;
    [key: string]: any;
  };
  mode?: 'create' | 'edit';
  // Quick Add mode props (for Weekly Alignment)
  quickAddMode?: boolean;
  currentWeekData?: {
    weekNumber: number;
    startDate: string;
    endDate: string;
  };
}

// Translate a form-side exercise row to the DB-side write shape.
// (muscle_group string[] → comma-joined string, name trimmed)
const formRowToDbShape = (ex: ExerciseFormData) => ({
  name: ex.name.trim(),
  muscle_group: ex.muscle_group.length > 0 ? ex.muscle_group.join(', ') : null,
  exercise_type: ex.exercise_type,
  target_sets: ex.target_sets,
  target_reps: ex.target_reps,
  target_value: ex.target_value,
  unit: ex.unit,
  sort_order: ex.sort_order,
});

const ActionEffortModal: React.FC<ActionEffortModalProps> = ({
  visible,
  onClose,
  goal,
  cycleWeeks,
  timeline,
  createTaskWithWeekPlan,
  onDelete,
  initialData,
  mode = 'create',
  quickAddMode = false,
  currentWeekData,
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [selectedCustomDays, setSelectedCustomDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Multi-select states
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  // Track inherited (locked) items
  const [inheritedRoleIds, setInheritedRoleIds] = useState<string[]>([]);
  const [inheritedDomainIds, setInheritedDomainIds] = useState<string[]>([]);

  // Collapsible section states
  const [domainsExpanded, setDomainsExpanded] = useState(false);
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const [keyRelationshipsExpanded, setKeyRelationshipsExpanded] = useState(false);

  // Detail tracking template state
  const [trackingTemplate, setTrackingTemplate] = useState<TemplateType | null>(null);
  const [dataSchemaCategories, setDataSchemaCategories] = useState<string[]>([]);
  const [newCategoryText, setNewCategoryText] = useState('');
  const [trackingExpanded, setTrackingExpanded] = useState(false);

  // Exercise builder state (workout template)
  const [exercises, setExercises] = useState<ExerciseFormData[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [originalExerciseIds, setOriginalExerciseIds] = useState<string[]>([]);
  // Attachment state (matching TaskEventForm pattern)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Time picker state (for custom frequency)
  const [isAnytime, setIsAnytime] = useState(true);
  const [startTimeHours, setStartTimeHours] = useState(9);
  const [startTimeMinutes, setStartTimeMinutes] = useState(0);
  const [endTimeHours, setEndTimeHours] = useState(9);
  const [endTimeMinutes, setEndTimeMinutes] = useState(30);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Processed weeks with availability info
  const [processedWeeks, setProcessedWeeks] = useState<ProcessedWeek[]>([]);

  // Data fetching states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate time options for pickers
  const timeOptions = generateTimeOptions();

  useEffect(() => {
    if (visible) {
      fetchData();
      if (mode === 'create') {
        resetForm();
        // Quick Add Mode: Auto-select current week
        if (quickAddMode && currentWeekData) {
          setSelectedWeeks([currentWeekData.weekNumber]);
        }
      } else if (mode === 'edit' && initialData) {
        loadInitialData();
      }

      // Process weeks with availability information
      if (cycleWeeks && cycleWeeks.length > 0) {
        const timelineSource = timeline?.source || 'global';
        const processed = processWeeksWithAvailability(cycleWeeks, timelineSource);
        setProcessedWeeks(processed);
      } else {
        setProcessedWeeks([]);
      }
    }
  }, [visible, goal, mode, initialData, cycleWeeks, timeline]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rolesData } = await supabase
        .from('0008-ap-roles')
        .select('id, label, color')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('label');

      setAllRoles(rolesData || []);

      const { data: domainsData } = await supabase
        .from('0008-ap-domains')
        .select('id, name')
        .order('name');

      setAllDomains(domainsData || []);

      const { data: krData } = await supabase
        .from('0008-ap-key-relationships')
        .select('id, name, role_id')
        .eq('user_id', user.id);

      setAllKeyRelationships(krData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setSelectedWeeks([]);
    setRecurrenceType('daily');
    setSelectedCustomDays([]);
    setAttachedFiles([]);

    // Reset tracking template
    setTrackingTemplate(null);
    setDataSchemaCategories([]);
    setNewCategoryText('');
    setTrackingExpanded(false);
    setExercises([]);
    setOriginalExerciseIds([]);

    // Reset collapsed states
    setDomainsExpanded(false);
    setRolesExpanded(false);
    setKeyRelationshipsExpanded(false);

    // Reset time picker to defaults
    const defaultStart = getDefaultStartTime();
    const defaultEnd = getDefaultEndTime(defaultStart.hours, defaultStart.minutes);
    setStartTimeHours(defaultStart.hours);
    setStartTimeMinutes(defaultStart.minutes);
    setEndTimeHours(defaultEnd.hours);
    setEndTimeMinutes(defaultEnd.minutes);
    setIsAnytime(true);

    // Pre-select inherited items from goal and track them as locked
    if (goal) {
      console.log('[ActionEffortModal] Pre-filling from goal:', {
        goal_id: goal.id,
        goal_title: goal.title,
        goal_type: goal.goal_type,
        roles: goal.roles,
        domains: goal.domains,
        keyRelationships: goal.keyRelationships
      });

      const roleIds = goal.roles?.map(r => r.id) || [];
      const domainIds = goal.domains?.map(d => d.id) || [];
      const krIds = goal.keyRelationships?.map(kr => kr.id) || [];

      console.log('[ActionEffortModal] Extracted IDs:', { roleIds, domainIds, krIds });

      // Set as selected AND track as inherited (locked)
      setSelectedRoleIds(roleIds);
      setSelectedDomainIds(domainIds);
      setSelectedKeyRelationshipIds(krIds);

      setInheritedRoleIds(roleIds);
      setInheritedDomainIds(domainIds);

      // Auto-expand sections if they have inherited items (but not in quick add mode)
      if (!quickAddMode) {
        if (roleIds.length > 0) setRolesExpanded(true);
        if (domainIds.length > 0) setDomainsExpanded(true);
      }
    } else {
      setSelectedRoleIds([]);
      setSelectedDomainIds([]);
      setSelectedKeyRelationshipIds([]);
      setInheritedRoleIds([]);
      setInheritedDomainIds([]);
    }
  };

  const loadInitialData = async () => {
    if (!initialData) return;

    // Reset exercise state — repopulated only if this is a Pattern 2 edit
    setExercises([]);
    setOriginalExerciseIds([]);

    console.log('[ActionEffortModal] Loading initial data:', initialData);

    setTitle(initialData.title || '');
    setNotes('');
    setAttachedFiles([]);

    // Load tracking template
    setTrackingTemplate(initialData.tracking_template || null);
    setDataSchemaCategories(initialData.data_schema?.categories || []);
    setNewCategoryText('');
    if (initialData.tracking_template) {
      setTrackingExpanded(true);
    }

    // Parse frequency - prioritize weeklyTarget for preset frequencies
    // (weeklyTarget is the source of truth for "X days per week" selections)
    if (initialData.weeklyTarget !== undefined && initialData.weeklyTarget > 0) {
      const target = initialData.weeklyTarget;
      console.log('[ActionEffortModal] Setting frequency from weeklyTarget:', target);
      
      if (target >= 7) {
        setRecurrenceType('daily');
      } else if (target === 6) {
        setRecurrenceType('6days');
      } else if (target === 5) {
        setRecurrenceType('5days');
      } else if (target === 4) {
        setRecurrenceType('4days');
      } else if (target === 3) {
        setRecurrenceType('3days');
      } else if (target === 2) {
        setRecurrenceType('2days');
      } else if (target === 1) {
        setRecurrenceType('1day');
      }
    }

    // Check for custom day selection (BYDAY in recurrence rule)
    if (initialData.recurrence_rule) {
      const rule = initialData.recurrence_rule;
      console.log('[ActionEffortModal] Parsing recurrence rule:', rule);

      // Only override to custom if BYDAY specifies exact days
      if (rule.includes('BYDAY=')) {
        const byDayMatch = rule.match(/BYDAY=([^;]+)/);
        if (byDayMatch) {
          const days = byDayMatch[1].split(',');
          const dayMap: Record<string, number> = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
          const selectedDays = days.map(day => dayMap[day]).filter(d => d !== undefined);
          
          // Custom means user picked specific days, not just "any X days"
          setRecurrenceType('custom');
          setSelectedCustomDays(selectedDays);
        }
      }
    }

    // Load time data if present
    if (initialData.start_time) {
      const parsed = parseDBTime(initialData.start_time);
      if (parsed) {
        setStartTimeHours(parsed.hours);
        setStartTimeMinutes(parsed.minutes);
      }
    }
    if (initialData.end_time) {
      const parsed = parseDBTime(initialData.end_time);
      if (parsed) {
        setEndTimeHours(parsed.hours);
        setEndTimeMinutes(parsed.minutes);
      }
    }
    setIsAnytime(initialData.is_anytime !== false);

    // Load existing associations
    const roleIds = initialData.roles?.map((r: any) => r.id) || [];
    const domainIds = initialData.domains?.map((d: any) => d.id) || [];
    const krIds = initialData.keyRelationships?.map((kr: any) => kr.id) || [];

    setSelectedRoleIds(roleIds);
    setSelectedDomainIds(domainIds);
    setSelectedKeyRelationshipIds(krIds);

    // In edit mode, inherited items come from the goal, not the action
    if (goal) {
      const inheritedRoles = goal.roles?.map(r => r.id) || [];
      const inheritedDomains = goal.domains?.map(d => d.id) || [];
      setInheritedRoleIds(inheritedRoles);
      setInheritedDomainIds(inheritedDomains);

      // Auto-expand sections with selections
      if (roleIds.length > 0) setRolesExpanded(true);
      if (domainIds.length > 0) setDomainsExpanded(true);
    }

    const weeks = initialData.selectedWeeks || [];
    setSelectedWeeks(weeks);

    // Hydrate exercises from the linked session (Pattern 2 only)
    if (initialData.milestone_id) {
      setIsLoadingExercises(true);
      try {
        const loadedExercises = await getExercisesForSession(initialData.milestone_id);
        setExercises(loadedExercises.map((ex: SessionExercise) => ({
          exercise_id: ex.exercise_id,
          name: ex.exercise_name,
          muscle_group: ex.muscle_group
            ? ex.muscle_group.split(/,\s*/).filter(s => s.length > 0)
            : [],
          exercise_type: ex.exercise_type,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_value: ex.target_value,
          unit: ex.unit,
          sort_order: ex.sort_order,
        })));
        setOriginalExerciseIds(loadedExercises.map(ex => ex.exercise_id));
      } catch (err) {
        console.error('[ActionEffortModal] Failed to load session exercises:', err);
        // Non-fatal. Form remains usable with empty exercises.
      } finally {
        setIsLoadingExercises(false);
      }
    }
  };

  // Attachment handlers (matching TaskEventForm pattern)
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const validFiles: AttachedFile[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.fileSize || 0;
          const fileName = asset.fileName || 'image.jpg';

          let mimeType = 'image/jpeg';
          if (asset.uri) {
            const lowerUri = asset.uri.toLowerCase();
            if (lowerUri.endsWith('.png')) mimeType = 'image/png';
            else if (lowerUri.endsWith('.gif')) mimeType = 'image/gif';
            else if (lowerUri.endsWith('.webp')) mimeType = 'image/webp';
            else if (lowerUri.endsWith('.heic')) mimeType = 'image/heic';
          }

          if (fileSize > MAX_FILE_SIZE) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: mimeType,
              size: fileSize,
            });
          }
        });

        if (oversizedFiles.length > 0) {
          Alert.alert(
            'File Size Limit Exceeded',
            `The following files exceed the 10 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setAttachedFiles([...attachedFiles, ...validFiles]);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const validFiles: AttachedFile[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.size || 0;
          const fileName = asset.name;

          if (fileSize > MAX_FILE_SIZE) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: asset.mimeType || 'application/octet-stream',
              size: fileSize,
            });
          }
        });

        if (oversizedFiles.length > 0) {
          Alert.alert(
            'File Size Limit Exceeded',
            `The following files exceed the 10 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setAttachedFiles([...attachedFiles, ...validFiles]);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    const newFiles = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
  };

  const handleToggleSelect = (field: 'roles' | 'domains' | 'keyRelationships', id: string) => {
    let setter: React.Dispatch<React.SetStateAction<string[]>>;
    let currentSelection: string[];
    let inheritedIds: string[];

    switch (field) {
      case 'roles':
        setter = setSelectedRoleIds;
        currentSelection = selectedRoleIds;
        inheritedIds = inheritedRoleIds;
        break;
      case 'domains':
        setter = setSelectedDomainIds;
        currentSelection = selectedDomainIds;
        inheritedIds = inheritedDomainIds;
        break;
      case 'keyRelationships':
        setter = setSelectedKeyRelationshipIds;
        currentSelection = selectedKeyRelationshipIds;
        inheritedIds = []; // Key relationships aren't locked
        break;
      default:
        return;
    }

    // Prevent removing inherited (locked) items
    if (currentSelection.includes(id) && inheritedIds.includes(id)) {
      Alert.alert(
        'Cannot Remove',
        'This item is inherited from the goal and cannot be removed from the action.'
      );
      return;
    }

    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter(itemId => itemId !== id)
      : [...currentSelection, id];
    setter(newSelection);
  };

  const handleWeekToggle = (weekNumber: number) => {
    setSelectedWeeks(prev =>
      prev.includes(weekNumber)
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber]
    );
  };

  const handleSelectAll = () => {
    const allWeekNumbers = processedWeeks.map(w => w.week_number);
    if (selectedWeeks.length === allWeekNumbers.length) {
      setSelectedWeeks([]);
    } else {
      setSelectedWeeks(allWeekNumbers);
    }
  };

  const handleRecurrenceSelect = (type: string) => {
    setRecurrenceType(type);
    if (type !== 'custom') {
      setSelectedCustomDays([]);
      setIsAnytime(true);
    }
  };

  const handleCustomDayToggle = (dayIndex: number) => {
    setSelectedCustomDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleTimeSelect = (type: 'start' | 'end', hours: number, minutes: number) => {
    if (type === 'start') {
      setStartTimeHours(hours);
      setStartTimeMinutes(minutes);
      setShowStartTimePicker(false);

      const startTotal = hours * 60 + minutes;
      const endTotal = endTimeHours * 60 + endTimeMinutes;
      if (endTotal <= startTotal) {
        const newEnd = getDefaultEndTime(hours, minutes);
        setEndTimeHours(newEnd.hours);
        setEndTimeMinutes(newEnd.minutes);
      }
    } else {
      setEndTimeHours(hours);
      setEndTimeMinutes(minutes);
      setShowEndTimePicker(false);
    }
  };

  const getTargetDays = () => {
    if (recurrenceType === 'custom') {
      return selectedCustomDays.length;
    }
    return recurrenceType === 'daily' ? 7 : parseInt(recurrenceType.replace('days', '').replace('day', ''));
  };

  const generateRecurrenceRule = () => {
    // ONLY use BYDAY when user explicitly selects "Custom" and picks specific days
    if (recurrenceType === 'custom' && selectedCustomDays.length > 0) {
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDays = selectedCustomDays.map(dayIndex => dayNames[dayIndex]).join(',');
      return `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
    }

    // For "daily" (7 days), use FREQ=DAILY
    if (recurrenceType === 'daily') {
      return 'RRULE:FREQ=DAILY';
    }

    // For preset frequencies (1-6 days), use FREQ=WEEKLY WITHOUT BYDAY
    // This means "X times per week on ANY days user chooses"
    // The target_days in week_plan table controls the count
    return 'RRULE:FREQ=WEEKLY';
  };

  const handleSave = async () => {
    console.log('[ActionEffortModal] handleSave called', { title: title.trim(), selectedWeeks, goal: goal?.id, goalType: goal?.goal_type, timeline: timeline?.source });
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the action.');
      return;
    }

    if (selectedWeeks.length === 0) {
      Alert.alert('Error', 'Please select at least one week.');
      return;
    }

    if (recurrenceType === 'custom' && selectedCustomDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for custom frequency.');
      return;
    }

    if (!timeline) {
      Alert.alert('Error', 'No timeline selected. Please select a timeline first.');
      return;
    }

    if (goal?.goal_type === '12week' && timeline.source !== 'global') {
      Alert.alert('Error', '12-week goals can only be used with global timelines.');
      return;
    }

    if (goal?.goal_type === 'custom' && timeline.source !== 'custom') {
      Alert.alert('Error', 'Custom goals can only be used with custom timelines.');
      return;
    }

    setSaving(true);
    try {
      const targetDays = getTargetDays();
      const recurrenceRule = generateRecurrenceRule();

      const taskData: any = {
        title: title.trim(),
        description: notes.trim() || undefined,
        goal_id: goal?.id,
        goal_type: goal?.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal',
        recurrenceRule,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
        tracking_template: trackingTemplate || undefined,
        data_schema: trackingTemplate && dataSchemaCategories.length > 0
          ? trackingTemplate === 'checklist'
            ? { checklist_items: dataSchemaCategories }
            : { categories: dataSchemaCategories }
          : undefined,
        attachments: attachedFiles, // Include attachments in task data
        selectedWeeks: selectedWeeks.map(weekNumber => {
          const processedWeek = processedWeeks.find(w => w.week_number === weekNumber);
          const effectiveTarget = processedWeek
            ? getEffectiveTargetDays(targetDays, processedWeek.start_date, processedWeek.end_date, processedWeek.is_partial)
            : targetDays;

          return {
            weekNumber,
            targetDays: effectiveTarget,
          };
        }),
        ...(mode === 'edit' && initialData ? { id: initialData.id } : {}),
      };

      console.log('[ActionEffortModal] Saving task with goal link:', {
        mode,
        goal_id: goal?.id,
        goal_title: goal?.title,
        goal_type: goal?.goal_type,
        goal_id: taskData.goal_id,
      });

      if (recurrenceType === 'custom' && !isAnytime) {
        taskData.start_time = formatTimeForDB(startTimeHours, startTimeMinutes);
        taskData.end_time = formatTimeForDB(endTimeHours, endTimeMinutes);
        taskData.is_anytime = false;
        taskData.type = 'event';
      } else {
        taskData.is_anytime = true;
        taskData.type = 'task';
      }

      console.log('[ActionEffortModal] About to save', JSON.stringify(taskData, null, 2));

      // Pattern 2 edit — diff-based save against existing session
      if (mode === 'edit' && initialData?.milestone_id && exercises.length > 0) {
        const milestoneId = initialData.milestone_id;

        // 1. Update session metadata
        await updateSession(milestoneId, {
          name: taskData.title,
          recurrence_rule: recurrenceRule,
          target_days: targetDays,
        });

        // 2. Update the shadow task (title, recurrence, joins, week plan)
        await createTaskWithWeekPlan(taskData, timeline);

        // 3. Diff exercises against the load-time snapshot
        const formExerciseIds = new Set(
          exercises.filter(ex => ex.exercise_id).map(ex => ex.exercise_id!)
        );
        const toInsert = exercises.filter(ex => !ex.exercise_id);
        const toUpdate = exercises.filter(ex => ex.exercise_id);
        const toDelete = originalExerciseIds.filter(id => !formExerciseIds.has(id));

        // 4. Apply diff — INSERT → UPDATE → DELETE order keeps user-added
        // work safe if any later step throws.
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        for (const ex of toInsert) {
          await addExerciseToSession(user.id, milestoneId, formRowToDbShape(ex));
        }
        for (const ex of toUpdate) {
          await updateExercise(ex.exercise_id!, formRowToDbShape(ex));
        }
        for (const id of toDelete) {
          await removeExerciseFromSession(id);
        }

        console.log('[ActionEffortModal] Pattern 2 edit complete', {
          updated: toUpdate.length, inserted: toInsert.length, deleted: toDelete.length,
        });
        onClose();
        Alert.alert('Success', 'Workout session updated successfully');
        return;
      }

      if (trackingTemplate === 'workout' && exercises.filter(e => e.name.trim()).length > 0) {
        // Workout template with exercises — create milestone instead of regular task
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const completionRuleJson = { type: 'all' };

        const milestoneId = await createSession({
          userId: user.id,
          goalId: goal!.id,
          name: taskData.title,
          milestoneType: 'workout_session',
          completionRule: completionRuleJson,
          recurrenceRule: recurrenceRule,
          targetDays: targetDays,
          timelineId: timeline.id,
          timelineType: timeline.source === 'global' ? 'global' : 'custom',
          weekNumberStart: Math.min(...selectedWeeks),
        });

        // Add exercises in sequence
        for (const ex of exercises) {
          if (ex.name.trim()) {
            await addExerciseToSession(user.id, milestoneId, formRowToDbShape(ex));
          }
        }
      } else {
        // Normal task creation for all other templates
        await createTaskWithWeekPlan(taskData, timeline);
      }

      console.log('[ActionEffortModal] Save successful, closing modal');
      onClose();
      Alert.alert('Success', trackingTemplate === 'workout' && exercises.filter(e => e.name.trim()).length > 0
        ? 'Workout session created successfully'
        : `Action ${mode === 'edit' ? 'updated' : 'created'} successfully!`
      );
    } catch (error) {
      console.error('Error saving action:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id || !onDelete) return;

    // Use window.confirm on web, Alert on native
    const confirmed = typeof window !== 'undefined' && window.confirm
      ? window.confirm('Delete this action? This will remove all associated data and cannot be undone.')
      : await new Promise<boolean>(resolve => {
          Alert.alert(
            'Delete Action',
            'Are you sure you want to delete this action? This will remove all associated data and cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      setSaving(true);
      await onDelete(initialData.id);
      Alert.alert('Success', 'Action deleted successfully!');
      onClose();
    } catch (err) {
      console.error('[ActionEffortModal] Delete error:', err);
      Alert.alert('Error', 'Could not delete action. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getRecurrenceLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case '6days': return '6 days';
      case '5days': return '5 days';
      case '4days': return '4 days';
      case '3days': return '3 days';
      case '2days': return '2 days';
      case '1day': return '1 day';
      case 'custom': return 'Custom';
      default: return 'Custom';
    }
  };

  // Get selected count for section headers
  const getSelectedDomainsCount = () => selectedDomainIds.length;
  const getSelectedRolesCount = () => selectedRoleIds.length;
  const getSelectedKRCount = () => selectedKeyRelationshipIds.length;

  // Filter key relationships based on selected roles
  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
    selectedRoleIds.includes(kr.role_id)
  );

  if (!goal) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {quickAddMode ? 'Quick Add Action' : (mode === 'edit' ? 'Edit Action' : 'Add Action')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading form data...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.form}>
              {/* Linked to Goal */}
              <View style={styles.field}>
                <Text style={styles.label}>Linked to Goal</Text>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                </View>
              </View>

              {/* Title */}
              <View style={styles.field}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Do 100 push-ups"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />
              </View>

              {/* Weeks - Hidden in Quick Add Mode */}
              {!quickAddMode && (
                <View style={styles.field}>
                  <Text style={styles.label}>Weeks *</Text>
                  <View style={styles.weekSelector}>
                    <TouchableOpacity
                      style={[
                        styles.weekButton,
                        selectedWeeks.length === processedWeeks.length && processedWeeks.length > 0 && styles.weekButtonSelected
                      ]}
                      onPress={handleSelectAll}
                    >
                      <Text style={[
                        styles.weekButtonText,
                        selectedWeeks.length === processedWeeks.length && processedWeeks.length > 0 && styles.weekButtonTextSelected
                      ]}>
                        Select All
                      </Text>
                    </TouchableOpacity>

                    {processedWeeks.map(weekData => (
                      <TouchableOpacity
                        key={weekData.week_number}
                        style={[
                          styles.weekButton,
                          selectedWeeks.includes(weekData.week_number) && styles.weekButtonSelected,
                          weekData.is_partial && styles.weekButtonPartial
                        ]}
                        onPress={() => handleWeekToggle(weekData.week_number)}
                      >
                        <Text style={[
                          styles.weekButtonText,
                          selectedWeeks.includes(weekData.week_number) && styles.weekButtonTextSelected
                        ]}>
                          Wk {weekData.week_number}
                          {weekData.is_partial && ` (${weekData.available_days}d)`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {processedWeeks.some(w => w.is_partial) && (
                    <Text style={styles.partialWeekNote}>
                      Partial weeks shown with available days. Target will be capped automatically.
                    </Text>
                  )}
                </View>
              )}

              {/* Quick Add: Show current week badge instead */}
              {quickAddMode && currentWeekData && (
                <View style={styles.field}>
                  <Text style={styles.label}>Week</Text>
                  <View style={styles.quickAddWeekBadge}>
                    <Text style={styles.quickAddWeekText}>
                      Week {currentWeekData.weekNumber} (This Week)
                    </Text>
                  </View>
                </View>
              )}

              {/* Frequency */}
              <View style={styles.field}>
                <Text style={styles.label}>Frequency per week *</Text>
                <View style={styles.frequencySelector}>
                  {['daily', '6days', '5days', '4days', '3days', '2days', '1day', 'custom'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.frequencyButton, recurrenceType === type && styles.frequencyButtonSelected]}
                      onPress={() => handleRecurrenceSelect(type)}
                    >
                      <Text style={[styles.frequencyButtonText, recurrenceType === type && styles.frequencyButtonTextSelected]}>
                        {getRecurrenceLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Days Selection with Time Picker */}
              {recurrenceType === 'custom' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Select Days *</Text>
                  <View style={styles.customDaysSelector}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.customDayButton,
                          selectedCustomDays.includes(index) && styles.customDayButtonSelected
                        ]}
                        onPress={() => handleCustomDayToggle(index)}
                      >
                        <Text style={[
                          styles.customDayButtonText,
                          selectedCustomDays.includes(index) && styles.customDayButtonTextSelected
                        ]}>
                          {dayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Time Selection */}
                  <View style={styles.timeSection}>
                    <View style={styles.anytimeToggle}>
                      <Text style={styles.anytimeLabel}>Anytime (no specific time)</Text>
                      <Switch
                        value={isAnytime}
                        onValueChange={setIsAnytime}
                        trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {!isAnytime && (
                      <View style={styles.timePickerContainer}>
                        <View style={styles.timePickerRow}>
                          <View style={styles.timePickerColumn}>
                            <Text style={styles.timePickerLabel}>Start Time</Text>
                            <TouchableOpacity
                              style={styles.timePickerButton}
                              onPress={() => setShowStartTimePicker(!showStartTimePicker)}
                            >
                              <Text style={styles.timePickerButtonText}>
                                {formatTimeDisplay(startTimeHours, startTimeMinutes)}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.timePickerColumn}>
                            <Text style={styles.timePickerLabel}>End Time</Text>
                            <TouchableOpacity
                              style={styles.timePickerButton}
                              onPress={() => setShowEndTimePicker(!showEndTimePicker)}
                            >
                              <Text style={styles.timePickerButtonText}>
                                {formatTimeDisplay(endTimeHours, endTimeMinutes)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {showStartTimePicker && (
                          <View style={styles.timeOptionsContainer}>
                            <Text style={styles.timeOptionsTitle}>Select Start Time</Text>
                            <ScrollView style={styles.timeOptionsList} nestedScrollEnabled>
                              {timeOptions.map((option, idx) => (
                                <TouchableOpacity
                                  key={idx}
                                  style={[
                                    styles.timeOption,
                                    option.hours === startTimeHours && option.minutes === startTimeMinutes && styles.timeOptionSelected
                                  ]}
                                  onPress={() => handleTimeSelect('start', option.hours, option.minutes)}
                                >
                                  <Text style={[
                                    styles.timeOptionText,
                                    option.hours === startTimeHours && option.minutes === startTimeMinutes && styles.timeOptionTextSelected
                                  ]}>
                                    {option.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}

                        {showEndTimePicker && (
                          <View style={styles.timeOptionsContainer}>
                            <Text style={styles.timeOptionsTitle}>Select End Time</Text>
                            <ScrollView style={styles.timeOptionsList} nestedScrollEnabled>
                              {timeOptions.map((option, idx) => (
                                <TouchableOpacity
                                  key={idx}
                                  style={[
                                    styles.timeOption,
                                    option.hours === endTimeHours && option.minutes === endTimeMinutes && styles.timeOptionSelected
                                  ]}
                                  onPress={() => handleTimeSelect('end', option.hours, option.minutes)}
                                >
                                  <Text style={[
                                    styles.timeOptionText,
                                    option.hours === endTimeHours && option.minutes === endTimeMinutes && styles.timeOptionTextSelected
                                  ]}>
                                    {option.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Detail Tracking Template - Hidden in Quick Add Mode */}
              {!quickAddMode && (
                <View style={styles.collapsibleSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setTrackingExpanded(!trackingExpanded)}
                  >
                    <View style={styles.collapsibleHeaderLeft}>
                      <Text style={styles.collapsibleLabel}>Detail Tracking</Text>
                      {trackingTemplate && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>
                            {TEMPLATE_CONFIGS[trackingTemplate].label}
                          </Text>
                        </View>
                      )}
                    </View>
                    {trackingExpanded ? (
                      <ChevronUp size={20} color="#6b7280" />
                    ) : (
                      <ChevronDown size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>

                  {trackingExpanded && (
                    <View style={styles.collapsibleContent}>
                      <Text style={styles.trackingHelpText}>
                        Choose a template to enable detail logging when tapping day labels.
                      </Text>
                      <View style={styles.templateSelector}>
                        {TEMPLATE_TYPES.map((tmpl) => {
                          const config = TEMPLATE_CONFIGS[tmpl];
                          const isSelected = trackingTemplate === tmpl;
                          const IconComponent = tmpl === 'workout' ? Dumbbell
                            : tmpl === 'financial' ? DollarSign
                            : tmpl === 'measurement' ? Ruler
                            : tmpl === 'journal' ? BookOpen
                            : ListChecks;
                          return (
                            <TouchableOpacity
                              key={tmpl}
                              style={[
                                styles.templateButton,
                                isSelected && styles.templateButtonSelected,
                              ]}
                              onPress={() => {
                                setTrackingTemplate(isSelected ? null : tmpl);
                                if (!isSelected) {
                                  setDataSchemaCategories([]);
                                  setNewCategoryText('');
                                }
                              }}
                            >
                              <IconComponent
                                size={16}
                                color={isSelected ? '#ffffff' : '#6b7280'}
                              />
                              <Text
                                style={[
                                  styles.templateButtonText,
                                  isSelected && styles.templateButtonTextSelected,
                                ]}
                              >
                                {config.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {trackingTemplate === 'workout' ? (
                        // Exercise builder replaces category config for workout template
                        <View style={styles.exerciseBuilderContainer}>
                          {/* Exercise list */}
                          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>EXERCISES</Text>
                          {exercises.map((ex, i) => (
                            <ExerciseFormRow
                              key={i}
                              index={i}
                              exercise={ex}
                              onChange={(index, updated) => {
                                setExercises(prev => prev.map((e, j) => j === index ? updated : e));
                              }}
                              onDelete={(index) => {
                                setExercises(prev =>
                                  prev.filter((_, j) => j !== index).map((e, j) => ({ ...e, sort_order: j }))
                                );
                              }}
                            />
                          ))}

                          <TouchableOpacity
                            style={styles.addExerciseButton}
                            onPress={() => setExercises(prev => [...prev, {
                              name: '',
                              muscle_group: [],
                              exercise_type: 'reps',
                              target_sets: null,
                              target_reps: null,
                              target_value: null,
                              unit: null,
                              sort_order: prev.length,
                            }])}
                            activeOpacity={0.7}
                          >
                            <PlusIcon size={16} color="#6366f1" />
                            <Text style={styles.addExerciseText}>Add Exercise</Text>
                          </TouchableOpacity>
                        </View>
                      ) : trackingTemplate && (
                        TEMPLATE_CONFIGS[trackingTemplate].categoryField || trackingTemplate === 'checklist'
                      ) ? (
                        // Original category config for all other templates
                        <View style={styles.categoryConfig}>
                          <Text style={styles.categoryConfigLabel}>
                            {trackingTemplate === 'checklist' ? 'Checklist Items' : 'Categories'}
                          </Text>
                          <Text style={styles.categoryConfigHint}>
                            {trackingTemplate === 'checklist'
                              ? 'Define the sub-items that can be checked off'
                              : 'Define options for the category dropdown'}
                          </Text>

                          {/* Existing categories as chips */}
                          <View style={styles.categoryChips}>
                            {dataSchemaCategories.map((cat, idx) => (
                              <View key={idx} style={styles.categoryChip}>
                                <Text style={styles.categoryChipText}>{cat}</Text>
                                <TouchableOpacity
                                  onPress={() => {
                                    setDataSchemaCategories(
                                      dataSchemaCategories.filter((_, i) => i !== idx)
                                    );
                                  }}
                                  style={styles.categoryChipRemove}
                                >
                                  <X size={12} color="#6b7280" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>

                          {/* Add new category */}
                          <View style={styles.categoryAddRow}>
                            <TextInput
                              style={styles.categoryAddInput}
                              value={newCategoryText}
                              onChangeText={setNewCategoryText}
                              placeholder={
                                trackingTemplate === 'checklist'
                                  ? 'e.g., Warm-up'
                                  : trackingTemplate === 'financial'
                                  ? 'e.g., Savings'
                                  : 'Add category...'
                              }
                              placeholderTextColor="#9ca3af"
                              maxLength={50}
                              onSubmitEditing={() => {
                                const trimmed = newCategoryText.trim();
                                if (trimmed && !dataSchemaCategories.includes(trimmed)) {
                                  setDataSchemaCategories([...dataSchemaCategories, trimmed]);
                                  setNewCategoryText('');
                                }
                              }}
                            />
                            <TouchableOpacity
                              style={[
                                styles.categoryAddButton,
                                !newCategoryText.trim() && styles.categoryAddButtonDisabled,
                              ]}
                              onPress={() => {
                                const trimmed = newCategoryText.trim();
                                if (trimmed && !dataSchemaCategories.includes(trimmed)) {
                                  setDataSchemaCategories([...dataSchemaCategories, trimmed]);
                                  setNewCategoryText('');
                                }
                              }}
                              disabled={!newCategoryText.trim()}
                            >
                              <PlusIcon size={16} color={newCategoryText.trim() ? '#ffffff' : '#9ca3af'} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              )}

              {/* Wellness Zones - Hidden in Quick Add Mode */}
              {!quickAddMode && (
                <View style={styles.collapsibleSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setDomainsExpanded(!domainsExpanded)}
                  >
                    <View style={styles.collapsibleHeaderLeft}>
                      <Text style={styles.collapsibleLabel}>Wellness Zones</Text>
                      {getSelectedDomainsCount() > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{getSelectedDomainsCount()}</Text>
                        </View>
                      )}
                    </View>
                    {domainsExpanded ? (
                      <ChevronUp size={20} color="#6b7280" />
                    ) : (
                      <ChevronDown size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>

                  {domainsExpanded && (
                    <View style={styles.collapsibleContent}>
                      <View style={styles.toggleGrid}>
                        {allDomains.map(domain => {
                          const isSelected = selectedDomainIds.includes(domain.id);
                          const isInherited = inheritedDomainIds.includes(domain.id);
                          return (
                            <View key={domain.id} style={styles.toggleGridItem}>
                              <View style={styles.toggleLabelContainer}>
                                <Text style={[
                                  styles.toggleLabel,
                                  isInherited && styles.toggleLabelLocked
                                ]} numberOfLines={1}>
                                  {domain.name}
                                </Text>
                                {isInherited && (
                                  <Lock size={12} color="#0078d4" style={styles.lockIcon} />
                                )}
                              </View>
                              <Switch
                                value={isSelected}
                                onValueChange={() => handleToggleSelect('domains', domain.id)}
                                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                                thumbColor="#ffffff"
                                disabled={isInherited && isSelected}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Roles - Hidden in Quick Add Mode */}
              {!quickAddMode && (
                <View style={styles.collapsibleSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setRolesExpanded(!rolesExpanded)}
                  >
                    <View style={styles.collapsibleHeaderLeft}>
                      <Text style={styles.collapsibleLabel}>Roles</Text>
                      {getSelectedRolesCount() > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{getSelectedRolesCount()}</Text>
                        </View>
                      )}
                    </View>
                    {rolesExpanded ? (
                      <ChevronUp size={20} color="#6b7280" />
                    ) : (
                      <ChevronDown size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>

                  {rolesExpanded && (
                    <View style={styles.collapsibleContent}>
                      <View style={styles.toggleGrid}>
                        {allRoles.map(role => {
                          const isSelected = selectedRoleIds.includes(role.id);
                          const isInherited = inheritedRoleIds.includes(role.id);
                          return (
                            <View key={role.id} style={styles.toggleGridItem}>
                              <View style={styles.toggleLabelContainer}>
                                <Text style={[
                                  styles.toggleLabel,
                                  isInherited && styles.toggleLabelLocked
                                ]} numberOfLines={1}>
                                  {role.label}
                                </Text>
                                {isInherited && (
                                  <Lock size={12} color="#0078d4" style={styles.lockIcon} />
                                )}
                              </View>
                              <Switch
                                value={isSelected}
                                onValueChange={() => handleToggleSelect('roles', role.id)}
                                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                                thumbColor="#ffffff"
                                disabled={isInherited && isSelected}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Key Relationships - Hidden in Quick Add Mode */}
              {!quickAddMode && filteredKeyRelationships.length > 0 && (
                <View style={styles.collapsibleSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setKeyRelationshipsExpanded(!keyRelationshipsExpanded)}
                  >
                    <View style={styles.collapsibleHeaderLeft}>
                      <Text style={styles.collapsibleLabel}>Key Relationships</Text>
                      {getSelectedKRCount() > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{getSelectedKRCount()}</Text>
                        </View>
                      )}
                    </View>
                    {keyRelationshipsExpanded ? (
                      <ChevronUp size={20} color="#6b7280" />
                    ) : (
                      <ChevronDown size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>

                  {keyRelationshipsExpanded && (
                    <View style={styles.collapsibleContent}>
                      <View style={styles.toggleGrid}>
                        {filteredKeyRelationships.map(kr => {
                          const isSelected = selectedKeyRelationshipIds.includes(kr.id);
                          return (
                            <View key={kr.id} style={styles.toggleGridItem}>
                              <Text style={styles.toggleLabel} numberOfLines={1}>{kr.name}</Text>
                              <Switch
                                value={isSelected}
                                onValueChange={() => handleToggleSelect('keyRelationships', kr.id)}
                                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                                thumbColor="#ffffff"
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Notes with Attachment Option - Hidden in Quick Add Mode */}
              {!quickAddMode && (
                <View style={styles.field}>
                  <View style={styles.notesHeader}>
                    <Text style={styles.label}>Notes (optional)</Text>
                    <View style={styles.attachmentButtons}>
                      <TouchableOpacity
                        style={styles.attachmentIconButton}
                        onPress={handlePickImage}
                      >
                        <ImageIcon size={20} color="#0078d4" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.attachmentIconButton}
                        onPress={handlePickDocument}
                      >
                        <Paperclip size={20} color="#0078d4" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add details if useful"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                  />

                  {/* Attached Files Display */}
                  {attachedFiles.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      <Text style={styles.attachmentsLabel}>
                        Attachments ({attachedFiles.length})
                      </Text>
                      <View style={styles.attachmentsGrid}>
                        {attachedFiles.map((file, index) => (
                          <View key={index} style={styles.attachmentThumbnailWrapper}>
                            <AttachmentThumbnail
                              uri={file.uri}
                              fileType={file.type}
                              fileName={file.name}
                              size="medium"
                            />
                            <TouchableOpacity
                              style={styles.removeAttachmentButton}
                              onPress={() => handleRemoveAttachment(index)}
                            >
                              <X size={14} color="#ffffff" />
                            </TouchableOpacity>
                            <Text
                              style={styles.attachmentFileName}
                              numberOfLines={1}
                            >
                              {file.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        )}

        <View style={styles.actions}>
          {mode === 'edit' && onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={saving}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!title.trim() || selectedWeeks.length === 0 || saving || isLoadingExercises) && styles.saveButtonDisabled,
              mode === 'edit' && onDelete && styles.saveButtonWithDelete
            ]}
            onPress={handleSave}
            disabled={!title.trim() || selectedWeeks.length === 0 || (recurrenceType === 'custom' && selectedCustomDays.length === 0) || saving || isLoadingExercises}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Action</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
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
  goalInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  weekSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  weekButtonPartial: {
    borderStyle: 'dashed',
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  weekButtonTextSelected: {
    color: '#ffffff',
  },
  partialWeekNote: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  frequencySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  frequencyButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  frequencyButtonTextSelected: {
    color: '#ffffff',
  },
  customDaysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customDayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  customDayButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  customDayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  customDayButtonTextSelected: {
    color: '#ffffff',
  },
  timeSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  anytimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  anytimeLabel: {
    fontSize: 14,
    color: '#374151',
  },
  timePickerContainer: {
    gap: 12,
  },
  timePickerRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  timePickerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  timePickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  timeOptionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
  },
  timeOptionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timeOptionsList: {
    maxHeight: 168,
  },
  timeOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timeOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  timeOptionTextSelected: {
    color: '#0078d4',
    fontWeight: '600',
  },
  // Collapsible Section Styles
  collapsibleSection: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  countBadge: {
    backgroundColor: '#0078d4',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  collapsibleContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  // 2-Column Toggle Grid Styles
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  toggleGridItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: 12,
  },
  toggleLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#374151',
    flexShrink: 1,
  },
  toggleLabelLocked: {
    fontWeight: '600',
    color: '#0078d4',
  },
  lockIcon: {
    marginLeft: 6,
  },
  // Notes with Attachment
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attachmentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attachmentIconButton: {
    padding: 8,
  },
  attachmentsContainer: {
    marginTop: 12,
  },
  attachmentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentThumbnailWrapper: {
    width: 80,
    alignItems: 'center',
    gap: 4,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  attachmentFileName: {
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
    color: '#374151',
  },
  // Quick Add Week Badge
  quickAddWeekBadge: {
    backgroundColor: '#0078d415',
    borderColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAddWeekText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0078d4',
  },
  // Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonWithDelete: {
    flex: 2,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Detail Tracking Template styles
  trackingHelpText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    marginTop: 4,
  },
  templateSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  templateButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  templateButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  templateButtonTextSelected: {
    color: '#ffffff',
  },
  categoryConfig: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  categoryConfigLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  categoryConfigHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    color: '#374151',
  },
  categoryChipRemove: {
    padding: 2,
  },
  categoryAddRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  categoryAddInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  categoryAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryAddButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  exerciseBuilderContainer: {
    marginTop: 8,
    gap: 10,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
});

export default ActionEffortModal;