import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Repeat, Paperclip, Image as ImageIcon, File } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate, parseLocalDate, formatTimeString } from '@/lib/dateUtils';
import ActionEffortModal from '../goals/ActionEffortModal';
import { TimePickerDropdown } from './TimePickerDropdown';
import { RecurrenceDropdown } from './RecurrenceDropdown';
import { CustomRecurrenceModal } from './CustomRecurrenceModal';
import DelegateModal from './DelegateModal';
import { eventBus, EVENTS } from '@/lib/eventBus';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';
import { uploadNoteAttachment, saveNoteAttachmentMetadata, fetchNoteAttachments, deleteNoteAttachment, getNoteAttachmentSignedUrl } from '@/lib/noteAttachmentUtils';

// ------------ Types & Models ------------
type SchedulingType = 'task' | 'event' | 'depositIdea' | 'withdrawal';

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
}

interface UnifiedGoal {
  id: string;
  title: string;
  description?: string;
  roles?: Role[];
  domains?: Domain[];
  keyRelationships?: KeyRelationship[];
  goal_type: '12week' | 'custom';
}

interface CycleWeek {
  week_number: number;
  week_start: string;
  week_end: string;
  user_global_timeline_id?: string;
  user_custom_timeline_id?: string;
}

interface Delegate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface FormData {
  type: SchedulingType;
  title: string;
  dueDate: string;
  dueTime: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  withdrawalDate: string;
  amount: string;
  isAnytime: boolean;
  isUrgent: boolean;
  isImportant: boolean;
  isGoal: boolean;
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedKeyRelationshipIds: string[];
  selectedGoalIds: string[];
  notes: string;

  // New fields for recurrence and goals
  recurrenceRule?: string;
  recurrenceEndDate?: string | null;
  selectedGoal?: UnifiedGoal;

  // Delegate field
  isDelegated: boolean;
  selectedDelegateId?: string;
}

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const { colors, isDarkMode } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  
  // Helper function to get next 15-minute interval + 15 min buffer (defined before state)
  const getInitialDefaultTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes + 15);
    now.setSeconds(0);
    now.setMilliseconds(0);
    const hours = now.getHours();
    const mins = now.getMinutes();
    const isPM = hours >= 12;
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${isPM ? 'pm' : 'am'}`;
  };

  // Form state
  const [formData, setFormData] = useState<FormData>({
    type: 'task',
    title: '',
    dueDate: formatLocalDate(new Date()),
    dueTime: getInitialDefaultTime(),
    startDate: formatLocalDate(new Date()),
    endDate: formatLocalDate(new Date()),
    startTime: getInitialDefaultTime(),
    endTime: '',
    withdrawalDate: formatLocalDate(new Date()),
    amount: '',
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isGoal: false,
    selectedRoleIds: [],
    selectedDomainIds: [],
    selectedKeyRelationshipIds: [],
    selectedGoalIds: [],
    notes: '',
    recurrenceEndDate: null,
    isDelegated: false,
    selectedDelegateId: undefined,
  });

  // Data state
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [availableGoals, setAvailableGoals] = useState<UnifiedGoal[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingNotes, setExistingNotes] = useState<Array<{id: string; content: string; created_at: string}>>([]);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'due' | 'start' | 'end' | 'withdrawal'>('due');

  // Recurrence state
  const [showCustomRecurrenceModal, setShowCustomRecurrenceModal] = useState(false);

  // Goal Mode (when a goal is selected + goalToggle true)
  const [goalMode, setGoalMode] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  // Completed task warning state
  const [showCompletedWarning, setShowCompletedWarning] = useState(false);
  const [dontShowWarningAgain, setDontShowWarningAgain] = useState(false);
  const [isEditingCompletedTask, setIsEditingCompletedTask] = useState(false);

  // Delegate state
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [userId, setUserId] = useState<string>('');

  // Attachment state
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [noteAttachmentsMap, setNoteAttachmentsMap] = useState<Map<string, any[]>>(new Map());


  // Helper function to get next 15-minute interval + 15 min buffer
  const getDefaultStartTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes + 15);
    now.setSeconds(0);
    now.setMilliseconds(0);
    const hours = now.getHours();
    const mins = now.getMinutes();
    const isPM = hours >= 12;
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${isPM ? 'pm' : 'am'}`;
  };

  // Helper function to convert time input to database time format (HH:MM:SS)
  const formatTimeForDatabase = (timeStr: string, dateStr: string): string | null => {
    if (!timeStr || !dateStr) return null;
    try {
      const timeLower = timeStr.toLowerCase().trim();
      let hours = 0;
      let minutes = 0;

      if (timeLower.includes('am') || timeLower.includes('pm')) {
        // 12-hour format
        const isPM = timeLower.includes('pm');
        const timeOnly = timeLower.replace(/am|pm/g, '').trim();
        const [h, m] = timeOnly.split(':').map(s => parseInt(s.trim(), 10));
        hours = h === 12 ? (isPM ? 12 : 0) : (isPM ? h + 12 : h);
        minutes = m || 0;
      } else {
        // 24-hour format
        const [h, m] = timeStr.split(':').map(s => parseInt(s.trim(), 10));
        hours = h || 0;
        minutes = m || 0;
      }

      return formatTimeString(hours, minutes);
    } catch (e) {
      console.error('Error formatting time:', e);
      return null;
    }
  };

  // Helper function to calculate duration between two times
  const calculateDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return '';
    try {
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs <= 0) return '';

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours === 0) {
        return `(${minutes} m)`;
      } else if (minutes === 0) {
        return `(${hours} h)`;
      } else {
        return `(${hours} h ${minutes} m)`;
      }
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    fetchFormData();
    if (initialData) {
      loadInitialData();
    }
  }, [mode, initialData]);


  // Check if editing a completed task and show warning
  useEffect(() => {
    const checkCompletedTaskWarning = async () => {
      if (mode === 'edit' && initialData?.status === 'completed' && (initialData.type === 'task' || initialData.type === 'event')) {
        setIsEditingCompletedTask(true);

        // Check user preference
        try {
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: userProfile } = await supabase
            .from('0008-ap-users')
            .select('hide_completed_task_warning')
            .eq('id', user.id)
            .maybeSingle();

          if (!userProfile?.hide_completed_task_warning) {
            setShowCompletedWarning(true);
          }
        } catch (error) {
          console.error('Error checking completed task warning preference:', error);
        }
      }
    };

    checkCompletedTaskWarning();
  }, [mode, initialData]);

  // Flip goal mode when a goal is chosen while goal toggle is ON
  useEffect(() => {
    const enabled = !!formData.isGoal && !!formData.selectedGoal && !!formData.recurrenceRule;
    setGoalMode(enabled);
    if (enabled) {
      // Prefill from goal
      const g = formData.selectedGoal!;
      setFormData(prev => ({
        ...prev,
        title: prev.title || g.title || '',
        selectedRoleIds: g.roles?.map(r => r.id) ?? prev.selectedRoleIds,
        selectedDomainIds: g.domains?.map(d => d.id) ?? prev.selectedDomainIds,
        selectedKeyRelationshipIds: g.keyRelationships?.map(k => k.id) ?? prev.selectedKeyRelationshipIds,
      }));
      // Open the ActionEffortModal to capture weeks/frequency
      setGoalModalVisible(true);
      // Scroll to bottom to show goal area controls
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [formData.isGoal, formData.selectedGoal, formData.recurrenceRule]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData },
        { data: goalsData },
        { data: delegatesData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id),
        supabase.from('0008-ap-goals-12wk').select('id, title').eq('user_id', user.id).eq('status', 'active').order('title'),
        supabase.from('0008-ap-delegates').select('id, name, email, phone').eq('user_id', user.id).order('name')
      ]);

      setRoles(rolesData || []);
      setDomains(domainsData || []);
      setKeyRelationships(krData || []);
      setTwelveWeekGoals(goalsData || []);
      setDelegates(delegatesData || []);

      // Fetch unified goals
      await fetchGoalsUnified();
      await fetchCycleWeeks();
    } catch (error) {
      console.error('Error fetching form data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoalsUnified = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 12-week goals
    const { data: tw } = await supabase
      .from('0008-ap-goals-12wk')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title');

    // Custom goals
    const { data: cg } = await supabase
      .from('0008-ap-goals-custom')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title');

    const unified: UnifiedGoal[] = [
      ...(tw || []).map(g => ({ ...g, goal_type: '12week' as const })),
      ...(cg || []).map(g => ({ ...g, goal_type: 'custom' as const })),
    ];
    setAvailableGoals(unified);
  };

  const fetchCycleWeeks = async () => {
    // Create 12 numbered weeks for now
    const fakeWeeks: CycleWeek[] = Array.from({ length: 12 }, (_, i) => ({
      week_number: i + 1,
      week_start: '',
      week_end: '',
    }));
    setCycleWeeks(fakeWeeks);
  };

  const loadInitialData = async () => {
    if (!initialData) return;

    // Handle notes - can be string or array of note objects
    let notesArray: Array<{id: string; content: string; created_at: string}> = [];
    let notesString = '';

    if (Array.isArray(initialData.notes)) {
      notesArray = initialData.notes;
    } else if (typeof initialData.notes === 'string') {
      notesString = initialData.notes;
    }

    setExistingNotes(notesArray);

    // Load attachments for existing notes
    if (notesArray.length > 0) {
      await loadAttachmentsForExistingNotes(notesArray);
    }

    // Check if there are active goals associated with this task
    const hasActiveGoals = initialData.goals && Array.isArray(initialData.goals) && initialData.goals.length > 0;
    let firstActiveGoal = null;

    if (hasActiveGoals) {
      // Find the first active goal to set as selectedGoal
      firstActiveGoal = initialData.goals[0];
    }

    // Build formData, handling both edit mode (with id) and create mode (pre-fill only)
    const newFormData: FormData = {
      type: initialData.type || 'task',
      title: initialData.title || '',
      dueDate: initialData.due_date || formatLocalDate(new Date()),
      dueTime: (initialData.type === 'task' ? initialData.end_time : '') || '',
      startDate: initialData.start_date || formatLocalDate(new Date()),
      endDate: initialData.end_date || formatLocalDate(new Date()),
      startTime: initialData.start_time || '',
      endTime: initialData.end_time || '',
      withdrawalDate: initialData.withdrawn_at || formatLocalDate(new Date()),
      amount: initialData.amount?.toString() || '',
      isAnytime: initialData.is_all_day || false,
      isUrgent: initialData.is_urgent || false,
      isImportant: initialData.is_important || false,
      isGoal: hasActiveGoals || initialData.is_twelve_week_goal || false,
      selectedRoleIds: initialData.roles?.map((r: any) => r.id) || initialData.selectedRoleIds || [],
      selectedDomainIds: initialData.domains?.map((d: any) => d.id) || initialData.selectedDomainIds || [],
      selectedKeyRelationshipIds: initialData.keyRelationships?.map((kr: any) => kr.id) || initialData.selectedKeyRelationshipIds || [],
      selectedGoalIds: initialData.goals?.map((g: any) => g.id) || initialData.selectedGoalIds || [],
      selectedGoal: firstActiveGoal,
      notes: notesString,
      recurrenceRule: initialData.recurrence_rule || undefined,
      recurrenceEndDate: initialData.recurrence_end_date || null,
      isDelegated: initialData.delegates && initialData.delegates.length > 0,
      selectedDelegateId: initialData.delegates && initialData.delegates.length > 0 ? initialData.delegates[0].id : undefined,
    };

    setFormData(newFormData);
  };

  const loadAttachmentsForExistingNotes = async (notes: Array<{id: string; content: string; created_at: string}>) => {
    try {
      const attachmentsMap = new Map<string, any[]>();

      for (const note of notes) {
        const attachments = await fetchNoteAttachments(note.id);
        if (attachments.length > 0) {
          const formattedAttachments = attachments.map(att => ({
            id: att.id,
            uri: att.public_url,
            filePath: att.file_path,
            name: att.file_name,
            type: att.file_type,
            size: att.file_size,
            isExisting: true,
            noteId: note.id,
          }));
          attachmentsMap.set(note.id, formattedAttachments);
        }
      }

      setNoteAttachmentsMap(attachmentsMap);
    } catch (error) {
      console.error('Error loading note attachments:', error);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        const validFiles: any[] = [];
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
            `The following files exceed the 5 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setAttachedFiles([...attachedFiles, ...validFiles]);
        }

        setShowAttachmentPicker(false);
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
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        const validFiles: any[] = [];
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
            `The following files exceed the 5 MB limit:\n\n${oversizedFiles.join('\n')}`
          );
        }

        if (validFiles.length > 0) {
          setAttachedFiles([...attachedFiles, ...validFiles]);
        }

        setShowAttachmentPicker(false);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleRemoveAttachment = async (index: number) => {
    const fileToRemove = attachedFiles[index];

    if (fileToRemove.isExisting && fileToRemove.id && fileToRemove.noteId) {
      try {
        const success = await deleteNoteAttachment(fileToRemove.id, fileToRemove.filePath);
        if (!success) {
          Alert.alert('Error', 'Failed to delete attachment');
          return;
        }

        // Update the noteAttachmentsMap
        const noteAttachments = noteAttachmentsMap.get(fileToRemove.noteId) || [];
        const updatedNoteAttachments = noteAttachments.filter(att => att.id !== fileToRemove.id);
        const newMap = new Map(noteAttachmentsMap);
        if (updatedNoteAttachments.length > 0) {
          newMap.set(fileToRemove.noteId, updatedNoteAttachments);
        } else {
          newMap.delete(fileToRemove.noteId);
        }
        setNoteAttachmentsMap(newMap);
      } catch (error) {
        console.error('Error deleting attachment:', error);
        Alert.alert('Error', 'Failed to delete attachment');
        return;
      }
    }

    const newFiles = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
  };

  const uploadFileToStorage = async (file: any, userId: string): Promise<string | null> => {
    try {
      let fileData: any;
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      } else {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }

      const filePath = await uploadNoteAttachment(fileData, file.name, file.type, userId);
      return filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleCalendarOpen = (mode: 'due' | 'start' | 'end' | 'withdrawal') => {
    setCalendarMode(mode);
    setShowCalendar(true);
  };

  const handleDateSelect = (day: any) => {
    const selectedDate = day.dateString;

    switch (calendarMode) {
      case 'due':
        setFormData(prev => ({ ...prev, dueDate: selectedDate }));
        break;
      case 'start':
        // When Start Date changes for Event type, sync End Date to match
        setFormData(prev => ({
          ...prev,
          startDate: selectedDate,
          endDate: formData.type === 'event' ? selectedDate : prev.endDate
        }));
        break;
      case 'end':
        setFormData(prev => ({ ...prev, endDate: selectedDate }));
        break;
      case 'withdrawal':
        setFormData(prev => ({ ...prev, withdrawalDate: selectedDate }));
        break;
    }

    setShowCalendar(false);
  };

  const formatDateForDisplay = (dateString: string) => {
    try {
      const date = parseLocalDate(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getMarkedDates = () => {
    const currentDate = (() => {
      switch (calendarMode) {
        case 'due': return formData.dueDate;
        case 'start': return formData.startDate;
        case 'end': return formData.endDate;
        case 'withdrawal': return formData.withdrawalDate;
        default: return formData.dueDate;
      }
    })();

    return {
      [currentDate]: {
        selected: true,
        selectedColor: colors.primary
      }
    };
  };

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds' | 'selectedGoalIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleGoalPick = async (id: string) => {
    const base = availableGoals.find(g => g.id === id);
    if (!base) return;

    setFormData(prev => ({ ...prev, selectedGoal: base }));
  };

  const defaultEventTimes = () => {
    // Start ~ now (rounded to next 15 minutes), end 1 hour later
    const start = new Date();
    const minutes = start.getMinutes();
    const roundUp = (Math.ceil(minutes / 15) * 15) % 60;
    start.setMinutes(roundUp, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  };

  const handleDismissCompletedWarning = async () => {
    if (dontShowWarningAgain) {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('0008-ap-users')
            .update({ hide_completed_task_warning: true })
            .eq('id', user.id);
        }
      } catch (error) {
        console.error('Error updating completed task warning preference:', error);
      }
    }
    setShowCompletedWarning(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Create the main record based on type
      let mainRecord;
      let mainRecordId;

      if (formData.type === 'withdrawal') {
        const withdrawalPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          amount: parseFloat(formData.amount) || 0,
          withdrawn_at: new Date(formData.withdrawalDate + 'T12:00:00').toISOString(),
          ...(mode === 'edit' && initialData?.id ? { updated_at: new Date().toISOString() } : {})
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .update(withdrawalPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .insert(withdrawalPayload)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        }
        mainRecordId = mainRecord.id;
      } else if (formData.type === 'depositIdea') {
        const depositIdeaPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          is_active: true,
          archived: false,
          follow_up: formData.isGoal,
          ...(mode === 'edit' && initialData?.id ? { updated_at: new Date().toISOString() } : {})
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .update(depositIdeaPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .insert(depositIdeaPayload)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        }
        mainRecordId = mainRecord.id;
      } else {
        // Task or Event
        // Log to verify status preservation
        if (mode === 'edit' && initialData?.id) {
          console.log('[TaskEventForm] Editing task - Initial status:', initialData.status, 'Initial completed_at:', initialData.completed_at);
        }

        // For recurring tasks/events without a date, default to today
        const effectiveDueDate = formData.type === 'task'
          ? (formData.dueDate || (formData.recurrenceRule ? formatLocalDate(new Date()) : null))
          : null;
        const effectiveStartDate = formData.type === 'event'
          ? (formData.startDate || (formData.recurrenceRule ? formatLocalDate(new Date()) : null))
          : null;

        // For tasks with a due time, we set both start_time and end_time to the same value
        // so they display correctly on the calendar (not at midnight)
        const dueTimeFormatted = formData.type === 'task' && formData.dueTime && !formData.isAnytime
          ? formatTimeForDatabase(formData.dueTime, effectiveDueDate)
          : null;

        const taskPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          type: formData.type,
          due_date: effectiveDueDate,
          start_date: effectiveStartDate,
          end_date: formData.type === 'event' ? formData.endDate : null,
          start_time: formData.type === 'event' && formData.startTime && !formData.isAnytime
            ? formatTimeForDatabase(formData.startTime, effectiveStartDate)
            : dueTimeFormatted,
          end_time: formData.type === 'event' && formData.endTime && !formData.isAnytime
            ? formatTimeForDatabase(formData.endTime, formData.endDate || effectiveStartDate)
            : dueTimeFormatted,
          is_all_day: formData.isAnytime,
          is_urgent: formData.isUrgent,
          is_important: formData.isImportant,
          is_twelve_week_goal: formData.isGoal,
          recurrence_rule: formData.recurrenceRule || null,
          recurrence_end_date: formData.recurrenceEndDate || null,
          // Preserve completion status and timestamp when editing
          ...(mode === 'edit' && initialData?.id ? {
            // Explicitly preserve completed status - never change it back to pending
            status: initialData.status === 'completed' ? 'completed' : (initialData.status || 'pending'),
            completed_at: initialData.completed_at || null,
            updated_at: new Date().toISOString()
          } : {
            status: 'pending'
          })
        };

        // Sanitize: Convert any empty strings to null for timestamp fields
        const sanitizeTimestamps = (payload: any) => {
          const timestampFields = ['start_time', 'end_time', 'completed_at'];
          timestampFields.forEach(field => {
            if (payload[field] === '') {
              console.warn(`[TaskEventForm] Converting empty string to null for field: ${field}`);
              payload[field] = null;
            }
          });
          return payload;
        };

        const sanitizedPayload = sanitizeTimestamps(taskPayload);
        console.log('[TaskEventForm] Complete task payload:', JSON.stringify(sanitizedPayload, null, 2));

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-tasks')
            .update(sanitizedPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-tasks')
            .insert(sanitizedPayload)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        }
        mainRecordId = mainRecord.id;
      }

      // Handle joins for all types
      const parentType = formData.type === 'depositIdea' ? 'depositIdea' : 
                        formData.type === 'withdrawal' ? 'withdrawal' : 'task';

      // Clear existing joins if editing
      if (mode === 'edit' && initialData?.id) {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-delegates-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
        ]);
      }

      // Insert new joins
      const joinPromises = [];

      if (formData.selectedRoleIds.length > 0) {
        const roleJoins = formData.selectedRoleIds.map(role_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          role_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
      }

      if (formData.selectedDomainIds.length > 0) {
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          domain_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
      }

      if (formData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          key_relationship_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
      }

      if (formData.selectedGoalIds.length > 0 && parentType === 'task') {
        const goalJoins = formData.selectedGoalIds.map(twelve_wk_goal_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          goal_type: 'twelve_wk_goal',
          twelve_wk_goal_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoins));
      }

      if (formData.isDelegated && formData.selectedDelegateId && parentType === 'task') {
        const delegateJoin = {
          parent_id: mainRecordId,
          parent_type: parentType,
          delegate_id: formData.selectedDelegateId,
          user_id: user.id,
        };
        joinPromises.push(supabase.from('0008-ap-universal-delegates-join').insert([delegateJoin]));
      }

      if (joinPromises.length > 0) {
        const results = await Promise.all(joinPromises);
        for (const result of results) {
          if (result.error) throw result.error;
        }
      }

      // Add note if provided
      if (formData.notes.trim()) {
        const { data: noteData, error: noteError } = await supabase
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
            parent_id: mainRecordId,
            parent_type: parentType,
            note_id: noteData.id,
            user_id: user.id,
          });

        if (noteJoinError) throw noteJoinError;

        // Upload attachments for the new note
        if (attachedFiles.length > 0) {
          const uploadPromises = attachedFiles.map(async (file) => {
            const filePath = await uploadFileToStorage(file, user.id);
            if (filePath) {
              await saveNoteAttachmentMetadata(
                noteData.id,
                user.id,
                file.name,
                filePath,
                file.type,
                file.size
              );
            }
          });

          await Promise.all(uploadPromises);
        }
      }

      Alert.alert('Success', `${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} ${mode === 'edit' ? 'updated' : 'created'} successfully!`);

      // Broadcast event to notify other components
      if (formData.type === 'withdrawal') {
        eventBus.emit(mode === 'edit' ? EVENTS.WITHDRAWAL_CREATED : EVENTS.WITHDRAWAL_CREATED);
      } else if (formData.type === 'depositIdea') {
        eventBus.emit(mode === 'edit' ? EVENTS.DEPOSIT_IDEA_UPDATED : EVENTS.DEPOSIT_IDEA_CREATED);
      } else {
        eventBus.emit(mode === 'edit' ? EVENTS.TASK_UPDATED : EVENTS.TASK_CREATED, {
          taskId: mainRecordId,
          type: formData.type,
        });
      }

      onSubmitSuccess();
    } catch (error) {
      console.error('Error saving:', error);
      const errorObj = error as any;
      const errorMessage = errorObj?.message || 'Failed to save';
      const errorCode = errorObj?.code || '';
      const errorDetails = errorObj?.details || '';
      const errorHint = errorObj?.hint || '';

      console.error('Full error details:', {
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
        hint: errorHint,
        payload: errorObj
      });

      Alert.alert(
        'Error',
        `${errorMessage}${errorCode ? `\n\nCode: ${errorCode}` : ''}${errorDetails ? `\n\nDetails: ${errorDetails}` : ''}`
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr =>
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const renderTypeSelector = () => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>Type</Text>
      <View style={styles.typeSelector}>
        {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              { borderColor: colors.border },
              formData.type === type && { backgroundColor: colors.primary }
            ]}
            onPress={() => {
              setFormData(prev => {
                const updates: any = { type };
                // Set smart defaults when switching to event type
                if (type === 'event' && prev.type !== 'event' && mode !== 'edit') {
                  const defaultStart = getDefaultStartTime();
                  updates.startTime = defaultStart;
                  updates.endTime = defaultStart;
                  updates.endDate = prev.startDate;
                }
                return { ...prev, ...updates };
              });
            }}
          >
            <Text style={[
              styles.typeButtonText,
              { color: formData.type === type ? '#ffffff' : colors.text }
            ]}>
              {type === 'depositIdea' ? 'Dep Idea' : type === 'withdrawal' ? 'Withdraw' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderDateField = (
    label: string,
    value: string,
    mode: 'due' | 'start' | 'end' | 'withdrawal'
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handleCalendarOpen(mode)}
      >
        <CalendarIcon size={16} color={colors.textSecondary} />
        <Text style={[styles.dateButtonText, { color: colors.text }]}>
          {formatDateForDisplay(value)}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTimeField = (label: string, value: string, onChange: (value: string) => void) => (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[styles.timeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );


  const renderSwitchField = (label: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.switchField}>
      <Text style={[styles.switchLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );

  const renderCheckboxGrid = (
    title: string,
    items: Array<{ id: string; label?: string; name?: string }>,
    selectedIds: string[],
    onToggle: (id: string) => void
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
      <View style={[styles.checkboxContainer, { borderColor: colors.border }]}>
        <View style={[styles.checkboxGrid, { backgroundColor: colors.surface }]}>
          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            const displayName = item.label || item.name || '';
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.checkboxItem, isMobile && styles.checkboxItemMobile]}
                onPress={() => onToggle(item.id)}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.border },
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.text }]} numberOfLines={2}>{displayName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Loading...</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {initialData?.id ? 'Edit' : 'New'} {formData.type === 'depositIdea' ? 'Item' : formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
          </Text>
          {isEditingCompletedTask && (
            <View style={[styles.completedBadge, { backgroundColor: '#16a34a' }]}>
              <Text style={styles.completedBadgeText}>✓ Completed</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            (!formData.title.trim() || saving) && { backgroundColor: colors.textSecondary }
          ]}
          onPress={handleSubmit}
          disabled={!formData.title.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.content}>
        <View style={styles.form}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="What do you want to do?"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Type Selector */}
          {renderTypeSelector()}

          {/* Switches Row - Only for task and event types */}
          {(formData.type === 'task' || formData.type === 'event') && (
            <>
              <View style={[styles.switchesRowWrapper, isMobile && styles.switchesRowWrapperMobile]}>
                <View style={[styles.switchesRow, isMobile && styles.switchesRowMobile]}>
                  {renderSwitchField('Urgent', formData.isUrgent, (value) => setFormData(prev => ({ ...prev, isUrgent: value })))}
                  {renderSwitchField('Important', formData.isImportant, (value) => setFormData(prev => ({ ...prev, isImportant: value })))}
                </View>
              </View>

              <View style={[styles.switchesRowWrapper, isMobile && styles.switchesRowWrapperMobile]}>
                <View style={[styles.switchesRow, isMobile && styles.switchesRowMobile]}>
                  {renderSwitchField('Goal', formData.isGoal, (value) => setFormData(prev => ({ ...prev, isGoal: value })))}
                </View>
              </View>
            </>
          )}

          {/* Goal picker (shows when Goal toggle ON) */}
          {formData.isGoal && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Select Goal</Text>
              <View style={styles.goalPickerRow}>
                {availableGoals.length === 0 ? (
                  <Text style={[styles.emptyGoalsText, { color: colors.textSecondary }]}>No active goals</Text>
                ) : (
                  availableGoals.map(g => {
                    const active = formData.selectedGoal?.id === g.id;
                    return (
                      <TouchableOpacity
                        key={`${g.goal_type}-${g.id}`}
                        style={[
                          styles.goalChip,
                          { borderColor: colors.border, backgroundColor: colors.surface },
                          active && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => handleGoalPick(g.id)}
                      >
                        <Text style={[
                          styles.goalChipText,
                          { color: active ? '#ffffff' : colors.text }
                        ]}>
                          {g.title} {g.goal_type === '12week' ? '• 12wk' : '• Custom'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Date Fields */}
          {formData.type === 'task' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Due Date & Time</Text>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateFieldWrapper}>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleCalendarOpen('due')}
                  >
                    <CalendarIcon size={16} color={colors.textSecondary} />
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {formatDateForDisplay(formData.dueDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TimePickerDropdown
                  value={formData.dueTime}
                  onChange={(time) => setFormData(prev => ({ ...prev, dueTime: time }))}
                  placeholder="Select time"
                  isDark={isDarkMode}
                />
                <View style={styles.anytimeToggleInline}>
                  <Text style={[styles.anytimeLabel, { color: colors.text }]}>Anytime</Text>
                  <Switch
                    value={formData.isAnytime}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>
            </View>
          )}
          {formData.type === 'event' && (
            <View style={styles.field}>
              {/* First Row: Date and Time Range */}
              <View style={styles.googleStyleDateTimeRow}>
                {/* Start Date */}
                <TouchableOpacity
                  style={[styles.googleDateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleCalendarOpen('start')}
                >
                  <CalendarIcon size={16} color={colors.textSecondary} />
                  <Text style={[styles.googleDateButtonText, { color: colors.text }]}>
                    {formatDateForDisplay(formData.startDate)}
                  </Text>
                </TouchableOpacity>

                {/* Start Time */}
                <TimePickerDropdown
                  value={formData.startTime}
                  onChange={(time) => setFormData(prev => ({ ...prev, startTime: time }))}
                  placeholder="Select time"
                  isDark={isDarkMode}
                />

                {/* Dash Separator */}
                <Text style={[styles.timeSeparator, { color: colors.text }]}>–</Text>

                {/* End Time */}
                <TimePickerDropdown
                  value={formData.endTime}
                  onChange={(time) => setFormData(prev => ({ ...prev, endTime: time }))}
                  referenceTime={formData.startTime}
                  startDate={formData.startDate}
                  endDate={formData.endDate}
                  minTime={formData.startTime}
                  placeholder="Select time"
                  isDark={isDarkMode}
                />

                {/* End Date - Only show if different from start date */}
                {formData.endDate !== formData.startDate && (
                  <TouchableOpacity
                    style={[styles.googleDateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleCalendarOpen('end')}
                  >
                    <CalendarIcon size={16} color={colors.textSecondary} />
                    <Text style={[styles.googleDateButtonText, { color: colors.text }]}>
                      {formatDateForDisplay(formData.endDate)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Second Row: All Day and Make Multi-day */}
              <View style={styles.googleSecondRow}>
                {/* All day toggle */}
                <View style={styles.googleAllDayToggle}>
                  <Text style={[styles.googleAllDayLabel, { color: colors.text }]}>All day</Text>
                  <Switch
                    value={formData.isAnytime}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>

                {/* Show multi-day button only for same-day events */}
                {formData.endDate === formData.startDate && (
                  <TouchableOpacity
                    style={styles.multiDayButtonInline}
                    onPress={() => handleCalendarOpen('end')}
                  >
                    <Text style={[styles.multiDayButtonText, { color: colors.primary }]}>Make multi-day event</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          {formData.type === 'withdrawal' && renderDateField('Withdrawal Date', formData.withdrawalDate, 'withdrawal')}

          {/* Amount field for withdrawals */}
          {formData.type === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.amount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                placeholder="0.0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {/* Google Calendar-style Recurrence Dropdown (always visible for tasks and events when Goal is OFF) */}
          {!formData.isGoal && (formData.type === 'task' || formData.type === 'event') && (
            <View style={styles.field}>
              <RecurrenceDropdown
                value={formData.recurrenceRule}
                onChange={(rule) => {
                  setFormData(prev => {
                    const updates: any = { recurrenceRule: rule };

                    // When setting a recurrence rule, ensure we have a date set
                    if (rule && formData.type === 'event' && !prev.startDate) {
                      updates.startDate = formatLocalDate(new Date());
                    } else if (rule && formData.type === 'task' && !prev.dueDate) {
                      updates.dueDate = formatLocalDate(new Date());
                    }

                    return { ...prev, ...updates };
                  });
                }}
                onOpenCustom={() => setShowCustomRecurrenceModal(true)}
                startDate={
                  formData.type === 'event'
                    ? (formData.startDate || formatLocalDate(new Date()))
                    : (formData.dueDate || formatLocalDate(new Date()))
                }
              />
            </View>
          )}

          {/* Delegate to Checkbox (only for tasks and events) */}
          {(formData.type === 'task' || formData.type === 'event') && (
            <View style={[styles.switchesRowWrapper, isMobile && styles.switchesRowWrapperMobile]}>
              <View style={[styles.switchesRow, isMobile && styles.switchesRowMobile]}>
                <View style={styles.switchField}>
                  <Text style={[styles.switchLabel, { color: colors.text }]} numberOfLines={1}>
                    Delegate to
                  </Text>
                  <Switch
                    value={formData.isDelegated}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, isDelegated: value }));
                      if (value) {
                        setShowDelegateModal(true);
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>
              {formData.isDelegated && formData.selectedDelegateId && (
                <View style={styles.delegateInfoContainer}>
                  <Text style={[styles.delegateInfoText, { color: colors.textSecondary }]}>
                    {delegates.find(d => d.id === formData.selectedDelegateId)?.name || 'Selected delegate'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowDelegateModal(true)}>
                    <Text style={[styles.changeDelegateText, { color: colors.primary }]}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Roles */}
          {renderCheckboxGrid(
            'Roles',
            roles,
            formData.selectedRoleIds,
            (id) => handleMultiSelect('selectedRoleIds', id)
          )}

          {/* Key Relationships */}
          {filteredKeyRelationships.length > 0 && renderCheckboxGrid(
            'Key Relationships',
            filteredKeyRelationships,
            formData.selectedKeyRelationshipIds,
            (id) => handleMultiSelect('selectedKeyRelationshipIds', id)
          )}

          {/* Domains */}
          {renderCheckboxGrid(
            'Domains',
            domains,
            formData.selectedDomainIds,
            (id) => handleMultiSelect('selectedDomainIds', id)
          )}

          {/* 12-Week Goals */}
          {formData.type === 'task' && formData.isGoal && twelveWeekGoals.length > 0 && renderCheckboxGrid(
            '12-Week Goals',
            twelveWeekGoals,
            formData.selectedGoalIds,
            (id) => handleMultiSelect('selectedGoalIds', id)
          )}

          {/* Notes */}
          <View style={styles.field}>
            <View style={styles.notesHeader}>
              <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={() => setShowAttachmentPicker(true)}
              >
                <Paperclip size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Display existing notes in stacked format */}
            {existingNotes.length > 0 && (
              <View style={styles.existingNotesContainer}>
                {existingNotes.map((note) => {
                  const noteAttachments = noteAttachmentsMap.get(note.id) || [];
                  return (
                    <View key={note.id} style={styles.existingNoteItem}>
                      <Text style={[styles.existingNoteContent, { color: colors.text }]}>{note.content}</Text>
                      <Text style={[styles.existingNoteDate, { color: colors.textSecondary }]}>
                        {new Date(note.created_at).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })} ({new Date(note.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })})
                      </Text>
                      {noteAttachments.length > 0 && (
                        <View style={styles.noteAttachmentsContainer}>
                          <Text style={[styles.attachmentsLabel, { color: colors.textSecondary }]}>
                            Attachments ({noteAttachments.length})
                          </Text>
                          <View style={styles.attachmentsGrid}>
                            {noteAttachments.map((file, index) => (
                              <View key={index} style={styles.attachmentThumbnailWrapper}>
                                <AttachmentThumbnail
                                  uri={file.uri}
                                  fileType={file.type}
                                  fileName={file.name}
                                  size="small"
                                />
                                <Text
                                  style={[styles.thumbnailFileName, { color: colors.text }]}
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
                  );
                })}
              </View>
            )}

            {/* Add new note */}
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder={existingNotes.length > 0 ? "Add another note..." : "Add notes..."}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            {/* Attached Files Display for New Note */}
            {attachedFiles.length > 0 && (
              <View style={styles.attachmentsContainer}>
                <Text style={[styles.attachmentsLabel, { color: colors.textSecondary }]}>
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
                        style={[styles.removeButton, { backgroundColor: colors.error || '#ef4444' }]}
                        onPress={() => handleRemoveAttachment(index)}
                      >
                        <X size={14} color="#ffffff" />
                      </TouchableOpacity>
                      <Text
                        style={[styles.thumbnailFileName, { color: colors.text }]}
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

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>
                Select {calendarMode === 'due' ? 'Due' : calendarMode === 'start' ? 'Start' : calendarMode === 'end' ? 'End' : 'Withdrawal'} Date
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={getMarkedDates()}
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.textSecondary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary,
                dotColor: colors.primary,
                selectedDotColor: '#ffffff',
                arrowColor: colors.primary,
                disabledArrowColor: colors.textSecondary,
                monthTextColor: colors.text,
                indicatorColor: colors.primary,
                textDayFontWeight: '400',
                textMonthFontWeight: '600',
                textDayHeaderFontWeight: '400',
                textDayFontSize: 16,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13
              }}
            />
          </View>
        </View>
      </Modal>

      {/* GOAL MODE — Reuse ActionEffortModal */}
      {goalMode && formData.selectedGoal && (
        <ActionEffortModal
          visible={goalModalVisible}
          onClose={() => setGoalModalVisible(false)}
          goal={formData.selectedGoal}
          cycleWeeks={cycleWeeks}
          createTaskWithWeekPlan={async (payload) => {
            // Store parts on formData and wait for the main Save button
            setFormData(prev => ({
              ...prev,
              title: payload.title ?? prev.title,
              notes: payload.description ?? prev.notes,
              selectedRoleIds: payload.selectedRoleIds ?? prev.selectedRoleIds,
              selectedDomainIds: payload.selectedDomainIds ?? prev.selectedDomainIds,
              selectedKeyRelationshipIds: payload.selectedKeyRelationshipIds ?? prev.selectedKeyRelationshipIds,
              recurrenceRule: payload.recurrenceRule ?? prev.recurrenceRule,
            }));
            return { id: 'temp' };
          }}
          onDelete={undefined}
          initialData={undefined}
          mode="create"
        />
      )}

      {/* Completed Task Warning Modal */}
      <Modal visible={showCompletedWarning} transparent animationType="fade">
        <View style={styles.warningOverlay}>
          <View style={[styles.warningContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.warningHeader}>
              <Text style={[styles.warningTitle, { color: colors.text }]}>
                Editing Completed Task
              </Text>
            </View>
            <View style={styles.warningBody}>
              <Text style={[styles.warningText, { color: colors.text }]}>
                You are updating a completed task. Your changes will be saved and the task will remain in your Journal with the updated information and recalculated points.
              </Text>
              <View style={styles.warningCheckboxRow}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setDontShowWarningAgain(!dontShowWarningAgain)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: colors.border },
                    dontShowWarningAgain && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}>
                    {dontShowWarningAgain && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>
                    Don't show this warning again
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.warningFooter}>
              <TouchableOpacity
                style={[styles.warningButton, { backgroundColor: colors.primary }]}
                onPress={handleDismissCompletedWarning}
              >
                <Text style={styles.warningButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Recurrence Modal */}
      <CustomRecurrenceModal
        visible={showCustomRecurrenceModal}
        onClose={() => setShowCustomRecurrenceModal(false)}
        onSave={(rule, endDate) => {
          setFormData(prev => {
            // When setting a recurrence rule, ensure we have a date set
            const updates: any = {
              recurrenceRule: rule,
              recurrenceEndDate: endDate
            };

            // If no date is set, default to today for recurring tasks/events
            if (formData.type === 'event' && !prev.startDate) {
              updates.startDate = formatLocalDate(new Date());
            } else if (formData.type === 'task' && !prev.dueDate) {
              updates.dueDate = formatLocalDate(new Date());
            }

            return { ...prev, ...updates };
          });
        }}
        startDate={
          formData.type === 'event'
            ? (formData.startDate || formatLocalDate(new Date()))
            : (formData.dueDate || formatLocalDate(new Date()))
        }
        initialRule={formData.recurrenceRule}
        initialEndDate={formData.recurrenceEndDate}
      />

      {/* Delegate Modal */}
      <DelegateModal
        visible={showDelegateModal}
        onClose={() => setShowDelegateModal(false)}
        onSave={async (delegateId) => {
          setFormData(prev => ({ ...prev, selectedDelegateId: delegateId, isDelegated: true }));
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data } = await supabase
              .from('0008-ap-delegates')
              .select('id, name, email, phone')
              .eq('user_id', user.id)
              .order('name');
            if (data) setDelegates(data);
          }
        }}
        existingDelegates={delegates}
        userId={userId}
      />

      {/* Attachment Picker Modal */}
      <Modal
        visible={showAttachmentPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachmentPicker(false)}
      >
        <View style={styles.attachmentPickerOverlay}>
          <View style={[styles.attachmentPickerContent, { backgroundColor: colors.surface }]}>
            <View style={styles.attachmentPickerHeader}>
              <Text style={[styles.attachmentPickerTitle, { color: colors.text }]}>Add Attachment</Text>
              <TouchableOpacity onPress={() => setShowAttachmentPicker(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.attachmentOption, { borderColor: colors.border }]}
              onPress={handlePickImage}
            >
              <ImageIcon size={24} color={colors.primary} />
              <Text style={[styles.attachmentOptionText, { color: colors.text }]}>
                Choose Image
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachmentOption, { borderColor: colors.border }]}
              onPress={handlePickDocument}
            >
              <File size={24} color={colors.primary} />
              <Text style={[styles.attachmentOptionText, { color: colors.text }]}>
                Choose Document
              </Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  completedBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchesRowWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  switchesRowWrapperMobile: {
    paddingHorizontal: 8,
  },
  switchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
    maxWidth: 600,
    gap: 24,
  },
  switchesRowMobile: {
    width: '100%',
    gap: 12,
  },
  switchFieldContainer: {
    flex: 1,
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
    fontStyle: 'italic',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  dateButtonHalf: {
    flex: 1,
  },
  dateFieldWrapper: {
    flex: 1,
    minWidth: 0,
    maxWidth: '35%',
  },
  timeInputInline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    width: 100,
  },
  anytimeToggleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  anytimeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkboxContainer: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  eventDateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  eventDateField: {
    flex: 2.5,
  },
  eventTimeField: {
    flex: 1.5,
  },
  googleStyleDateTimeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginBottom: 12,
  },
  googleDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  googleDateButtonText: {
    fontSize: 15,
    fontWeight: '400',
  },
  timeSeparator: {
    fontSize: 16,
    fontWeight: '400',
    paddingHorizontal: 4,
  },
  googleSecondRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  googleAllDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  googleAllDayLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  multiDayButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  multiDayButtonInline: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  multiDayButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  repeatSwitchWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  repeatSwitchContainer: {
    width: '20%',
    minWidth: 180,
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 4,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '46%',
    marginBottom: 12,
    gap: 12,
  },
  checkboxItemMobile: {
    width: '100%',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 350,
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  goalPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyGoalsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  recurrenceOption: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recurrenceOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  weeklyDaysContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  weeklyDaysGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  weeklyDayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weeklyDayButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  customRecurrenceContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  customTypeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  customTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  customTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  biweeklyOptions: {
    marginTop: 12,
  },
  monthlyOptions: {
    marginTop: 12,
  },
  monthlyTypeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  monthlyTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  monthlyTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  weekdayOptions: {
    marginTop: 12,
    gap: 12,
  },
  weekSelector: {
    alignItems: 'center',
  },
  weekSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  weekSelectorButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weekSelectorButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayOfWeekSelector: {
    alignItems: 'center',
  },
  existingNotesContainer: {
    marginBottom: 12,
  },
  existingNoteItem: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  existingNoteContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  existingNoteDate: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  warningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  warningHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningBody: {
    padding: 20,
  },
  warningText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  warningCheckboxRow: {
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
  },
  warningFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  warningButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  delegateInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  delegateInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  changeDelegateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentButton: {
    padding: 8,
  },
  attachmentsContainer: {
    marginTop: 12,
  },
  attachmentsLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  thumbnailFileName: {
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
  },
  attachmentPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentPickerContent: {
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  attachmentPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  attachmentPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
    gap: 12,
  },
  attachmentOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  noteAttachmentsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});