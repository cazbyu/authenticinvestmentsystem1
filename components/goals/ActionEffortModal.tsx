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
import { X, Lock, ChevronDown, ChevronUp, Paperclip, Image as ImageIcon, File } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getSupabaseClient } from '@/lib/supabase';
import { Timeline } from '@/hooks/useGoals';
import { processWeeksWithAvailability, getEffectiveTargetDays, ProcessedWeek } from '@/lib/weekUtils';
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
  initialData?: any;
  mode?: 'create' | 'edit';
  // Quick Add mode props (for Weekly Alignment)
  quickAddMode?: boolean;
  currentWeekData?: {
    weekNumber: number;
    startDate: string;
    endDate: string;
  };
}

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

      // Auto-expand sections if they have inherited items
      if (roleIds.length > 0) setRolesExpanded(true);
      if (domainIds.length > 0) setDomainsExpanded(true);
    } else {
      setSelectedRoleIds([]);
      setSelectedDomainIds([]);
      setSelectedKeyRelationshipIds([]);
      setInheritedRoleIds([]);
      setInheritedDomainIds([]);
    }
  };

  const loadInitialData = () => {
    if (!initialData) return;

    console.log('[ActionEffortModal] Loading initial data:', initialData);

    setTitle(initialData.title || '');
    setNotes('');
    setAttachedFiles([]);

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
        twelve_wk_goal_id: goal?.goal_type === '12week' ? goal.id : undefined,
        custom_goal_id: goal?.goal_type === 'custom' ? goal.id : undefined,
        goal_type: goal?.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal',
        recurrenceRule,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
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
        twelve_wk_goal_id: taskData.twelve_wk_goal_id,
        custom_goal_id: taskData.custom_goal_id
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

      await createTaskWithWeekPlan(taskData, timeline);

      console.log('[ActionEffortModal] Task saved successfully, closing modal');
      onClose();
      Alert.alert('Success', `Action ${mode === 'edit' ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving action:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;

    Alert.alert(
      'Delete Action',
      'Are you sure you want to delete this action? This will remove all associated data and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await onDelete(initialData.id);
              Alert.alert('Success', 'Action deleted successfully!');
              onClose();
            } catch (error) {
              console.error('Error deleting action:', error);
              Alert.alert('Error', (error as Error).message || 'Failed to delete action.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
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
            {mode === 'edit' ? 'Edit Action' : 'Add Action'}
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

              {/* Weeks */}
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

              {/* Wellness Zones - Collapsible with Toggle Switches (2 columns) - FIRST */}
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

              {/* Roles - Collapsible with Toggle Switches (2 columns) - SECOND */}
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

              {/* Key Relationships - Collapsible with Toggle Switches (2 columns) */}
              {filteredKeyRelationships.length > 0 && (
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

              {/* Notes with Attachment Option */}
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
              (!title.trim() || selectedWeeks.length === 0 || saving) && styles.saveButtonDisabled,
              mode === 'edit' && onDelete && styles.saveButtonWithDelete
            ]}
            onPress={handleSave}
            disabled={!title.trim() || selectedWeeks.length === 0 || (recurrenceType === 'custom' && selectedCustomDays.length === 0) || saving}
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
});

export default ActionEffortModal;