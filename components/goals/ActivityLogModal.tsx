import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { X, Trash2, Edit2, Save } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { eventBus, EVENTS } from '@/lib/eventBus';
import {
  TemplateType,
  TEMPLATE_CONFIGS,
  getResolvedFields,
  buildChecklistDetails,
  TemplateFieldDef,
} from '@/lib/activityTemplates';
import { parseLocalDate } from '@/lib/dateUtils';

interface ActivityLogEntry {
  id: string;
  task_id: string;
  log_date: string;
  template_type: string;
  primary_metric: number | null;
  details: Record<string, any>;
  notes: string | null;
  note_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityLogModalProps {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  date: string; // YYYY-MM-DD
  templateType: TemplateType;
  dataSchema?: { categories?: string[]; checklist_items?: string[] } | null;
}

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  visible,
  onClose,
  taskId,
  taskTitle,
  date,
  templateType,
  dataSchema,
}) => {
  const [existingEntries, setExistingEntries] = useState<ActivityLogEntry[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const config = TEMPLATE_CONFIGS[templateType];
  const resolvedFields = useMemo(
    () => getResolvedFields(templateType, dataSchema),
    [templateType, dataSchema]
  );

  const formatDate = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
  };

  const buildEnrichedNoteContent = (rawNotes: string, logDate: string, tmplType: string) => {
    const d = parseLocalDate(logDate);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateLabel = !isNaN(d.getTime())
      ? `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
      : logDate;
    const templateLabel = tmplType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `[Activity Log - ${dateLabel} | ${templateLabel}] ${rawNotes}`;
  };

  const resetForm = useCallback(() => {
    const defaults: Record<string, any> = {};
    resolvedFields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      } else if (field.type === 'boolean') {
        defaults[field.key] = false;
      } else {
        defaults[field.key] = '';
      }
    });
    setFormValues(defaults);
    setNotes('');
    setEditingEntryId(null);
    setEditingNoteId(null);
  }, [resolvedFields]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-activity-log')
        .select('*')
        .eq('task_id', taskId)
        .eq('log_date', date)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ActivityLogModal] Error fetching entries:', error);
      } else {
        setExistingEntries(data || []);
      }
    } catch (err) {
      console.error('[ActivityLogModal] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId, date]);

  useEffect(() => {
    if (visible) {
      resetForm();
      fetchEntries();
    }
  }, [visible, resetForm, fetchEntries]);

  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // Create or update a universal note linked to the parent task
  const saveUniversalNote = async (
    supabase: any,
    userId: string,
    rawNotes: string,
    existingNoteId: string | null,
  ): Promise<string | null> => {
    const trimmed = rawNotes.trim();

    if (!trimmed && existingNoteId) {
      // Notes cleared — remove universal note
      await supabase
        .from('0008-ap-universal-notes-join')
        .delete()
        .eq('note_id', existingNoteId);
      await supabase
        .from('0008-ap-notes')
        .delete()
        .eq('id', existingNoteId);
      return null;
    }

    if (!trimmed) return null;

    const enrichedContent = buildEnrichedNoteContent(trimmed, date, templateType);

    if (existingNoteId) {
      // Update existing note
      await supabase
        .from('0008-ap-notes')
        .update({ content: enrichedContent })
        .eq('id', existingNoteId);
      return existingNoteId;
    }

    // Create new note + join
    const { data: noteData, error: noteError } = await supabase
      .from('0008-ap-notes')
      .insert({ user_id: userId, content: enrichedContent })
      .select('id')
      .single();

    if (noteError) throw noteError;

    const { error: joinError } = await supabase
      .from('0008-ap-universal-notes-join')
      .insert({
        parent_id: taskId,
        parent_type: 'task',
        note_id: noteData.id,
        user_id: userId,
      });

    if (joinError) throw joinError;
    return noteData.id;
  };

  const handleSave = async () => {
    // Validate required fields
    for (const field of resolvedFields) {
      if (field.required && !formValues[field.key] && formValues[field.key] !== 0) {
        Alert.alert('Required', `Please fill in ${field.label}`);
        return;
      }
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Build details object
      let details: Record<string, any>;
      if (templateType === 'checklist') {
        details = buildChecklistDetails(formValues, dataSchema?.checklist_items || dataSchema?.categories || []);
      } else {
        details = {};
        resolvedFields.forEach((field) => {
          const val = formValues[field.key];
          if (val !== '' && val !== undefined && val !== null) {
            details[field.key] = field.type === 'number' ? Number(val) : val;
          }
        });
      }

      const primaryMetric = config.extractPrimaryMetric(details);

      if (editingEntryId) {
        // Update existing entry — sync universal note
        const noteId = await saveUniversalNote(supabase, auth.user.id, notes, editingNoteId);

        const { error } = await supabase
          .from('0008-ap-activity-log')
          .update({
            primary_metric: primaryMetric,
            details,
            notes: notes.trim() || null,
            note_id: noteId,
          })
          .eq('id', editingEntryId);

        if (error) throw error;
        eventBus.emit(EVENTS.ACTIVITY_LOG_UPDATED, { taskId, date, entryId: editingEntryId });
      } else {
        // Insert new entry — create universal note if notes provided
        const noteId = await saveUniversalNote(supabase, auth.user.id, notes, null);

        const { error } = await supabase
          .from('0008-ap-activity-log')
          .insert({
            user_id: auth.user.id,
            task_id: taskId,
            log_date: date,
            template_type: templateType,
            primary_metric: primaryMetric,
            details,
            notes: notes.trim() || null,
            note_id: noteId,
          });

        if (error) throw error;
        eventBus.emit(EVENTS.ACTIVITY_LOG_CREATED, { taskId, date });
      }

      resetForm();
      await fetchEntries();
    } catch (err) {
      console.error('[ActivityLogModal] Save error:', err);
      Alert.alert('Error', 'Failed to save activity log entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEntry = (entry: ActivityLogEntry) => {
    setEditingEntryId(entry.id);
    setEditingNoteId(entry.note_id || null);
    setNotes(entry.notes || '');

    if (templateType === 'checklist') {
      const items = entry.details?.items || [];
      const vals: Record<string, any> = {};
      items.forEach((item: { label: string; done: boolean }) => {
        vals[`item_${item.label}`] = item.done;
      });
      setFormValues(vals);
    } else {
      const vals: Record<string, any> = {};
      resolvedFields.forEach((field) => {
        vals[field.key] = entry.details?.[field.key] ?? (field.type === 'boolean' ? false : '');
      });
      setFormValues(vals);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    const entry = existingEntries.find((e) => e.id === entryId);
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();

            // Clean up universal note if one exists
            if (entry?.note_id) {
              await supabase
                .from('0008-ap-universal-notes-join')
                .delete()
                .eq('note_id', entry.note_id);
              await supabase
                .from('0008-ap-notes')
                .delete()
                .eq('id', entry.note_id);
            }

            const { error } = await supabase
              .from('0008-ap-activity-log')
              .delete()
              .eq('id', entryId);

            if (error) throw error;
            eventBus.emit(EVENTS.ACTIVITY_LOG_DELETED, { taskId, date, entryId });
            await fetchEntries();
            if (editingEntryId === entryId) {
              resetForm();
            }
          } catch (err) {
            console.error('[ActivityLogModal] Delete error:', err);
            Alert.alert('Error', 'Failed to delete entry.');
          }
        },
      },
    ]);
  };

  const renderField = (field: TemplateFieldDef) => {
    const value = formValues[field.key];

    if (field.type === 'boolean') {
      return (
        <View key={field.key} style={styles.booleanFieldRow}>
          <Text style={styles.booleanFieldLabel}>{field.label}</Text>
          <Switch
            value={!!value}
            onValueChange={(val) => handleFieldChange(field.key, val)}
            trackColor={{ false: '#d1d5db', true: '#0078d4' }}
            thumbColor="#ffffff"
          />
        </View>
      );
    }

    if (field.type === 'select' && field.options && field.options.length > 0) {
      return (
        <View key={field.key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            {field.label}{field.required ? ' *' : ''}
          </Text>
          <View style={styles.selectOptions}>
            {field.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.selectOption,
                  value === opt && styles.selectOptionSelected,
                ]}
                onPress={() => handleFieldChange(field.key, value === opt ? '' : opt)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    value === opt && styles.selectOptionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View key={field.key} style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {field.label}{field.required ? ' *' : ''}
          {field.unit ? ` (${field.unit})` : ''}
        </Text>
        <TextInput
          style={[styles.fieldInput, field.type === 'text' && field.key === 'entry' && styles.fieldInputMultiline]}
          value={String(value ?? '')}
          onChangeText={(text) => handleFieldChange(field.key, text)}
          placeholder={field.placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
          multiline={field.type === 'text' && field.key === 'entry'}
          numberOfLines={field.type === 'text' && field.key === 'entry' ? 4 : 1}
        />
      </View>
    );
  };

  const renderEntryCard = (entry: ActivityLogEntry) => {
    const details = entry.details || {};
    const isEditing = editingEntryId === entry.id;

    // Build a summary line based on template
    let summary = '';
    if (templateType === 'workout') {
      const parts = [];
      if (details.category) parts.push(details.category);
      if (details.sets && details.reps) parts.push(`${details.sets}x${details.reps}`);
      if (details.weight) parts.push(`${details.weight} ${details.weight_unit || 'lbs'}`);
      summary = parts.join(' - ');
    } else if (templateType === 'financial') {
      summary = `$${Number(details.amount || 0).toFixed(2)}`;
      if (details.category) summary += ` (${details.category})`;
    } else if (templateType === 'measurement') {
      summary = `${details.value || 0}`;
      if (details.unit) summary += ` ${details.unit}`;
      if (details.duration) summary += ` · ${details.duration}`;
    } else if (templateType === 'journal') {
      summary = (details.entry || '').substring(0, 80);
      if ((details.entry || '').length > 80) summary += '...';
    } else if (templateType === 'checklist') {
      const items = details.items || [];
      const done = items.filter((i: any) => i.done).length;
      summary = `${done}/${items.length} completed`;
    }

    return (
      <View key={entry.id} style={[styles.entryCard, isEditing && styles.entryCardEditing]}>
        <View style={styles.entryCardContent}>
          <Text style={styles.entrySummary} numberOfLines={2}>{summary}</Text>
          {entry.notes && (
            <Text style={styles.entryNotes} numberOfLines={1}>{entry.notes}</Text>
          )}
        </View>
        <View style={styles.entryActions}>
          <TouchableOpacity
            style={styles.entryActionButton}
            onPress={() => handleEditEntry(entry)}
          >
            <Edit2 size={14} color="#0078d4" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.entryActionButton}
            onPress={() => handleDeleteEntry(entry.id)}
          >
            <Trash2 size={14} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerTitle} numberOfLines={1}>{taskTitle}</Text>
            <Text style={styles.headerDate}>{formatDate(date)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Existing entries */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6b7280" />
              <Text style={styles.loadingText}>Loading entries...</Text>
            </View>
          ) : existingEntries.length > 0 ? (
            <View style={styles.entriesSection}>
              <Text style={styles.sectionTitle}>
                Previous Entries ({existingEntries.length})
              </Text>
              {existingEntries.map(renderEntryCard)}
            </View>
          ) : null}

          {/* Input form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              {editingEntryId ? 'Edit Entry' : 'New Entry'}
            </Text>
            <Text style={styles.templateLabel}>{config.label} Template</Text>

            {resolvedFields.map(renderField)}

            {/* Notes field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.fieldInput, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={2}
                maxLength={500}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {editingEntryId && (
            <TouchableOpacity
              style={styles.cancelEditButton}
              onPress={resetForm}
            >
              <Text style={styles.cancelEditButtonText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Save size={16} color="#ffffff" />
                <Text style={styles.saveButtonText}>
                  {editingEntryId ? 'Update' : 'Save Entry'}
                </Text>
              </>
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
  headerTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerDate: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  entriesSection: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  entryCardEditing: {
    borderColor: '#0078d4',
    borderWidth: 2,
  },
  entryCardContent: {
    flex: 1,
    marginRight: 8,
  },
  entrySummary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  entryNotes: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  entryActionButton: {
    padding: 6,
    borderRadius: 4,
  },
  formSection: {
    padding: 16,
  },
  templateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2937',
  },
  fieldInputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectOptionSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  selectOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectOptionTextSelected: {
    color: '#ffffff',
  },
  booleanFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  booleanFieldLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelEditButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEditButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ActivityLogModal;
