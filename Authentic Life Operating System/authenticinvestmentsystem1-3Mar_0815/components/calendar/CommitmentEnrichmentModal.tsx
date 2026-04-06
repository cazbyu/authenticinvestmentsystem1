import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Users,
  Flag,
  Heart,
  Target,
  FileText,
  UserPlus,
  Trash2,
  Paperclip,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import DelegateModal from '@/components/tasks/DelegateModal';

type EnrichmentTab =
  | 'roles'
  | 'wellness'
  | 'goals'
  | 'priority'
  | 'notes'
  | 'delegate';

interface CommitmentEnrichmentModalProps {
  visible: boolean;
  commitment: {
    id: string;
    title: string;
    user_id: string;
    is_urgent: boolean;
    is_important: boolean;
    external_recurrence_id?: string | null;
  };
  initialTab: EnrichmentTab;
  onClose: () => void;
  onEnrichmentChange: () => void;
}

interface RoleRow {
  id: string;
  label: string;
}
interface DomainRow {
  id: string;
  label: string;
}
interface GoalRow {
  id: string;
  title: string;
  goal_type: 'twelve_wk_goal' | 'custom_goal';
}
interface NoteRow {
  id: string;
  content: string;
  created_at: string;
}
interface DelegateRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

const PRIMARY = '#3b82f6';
const GRAY_TEXT = '#6b7280';
const BORDER = '#d1d5db';
const BG_GRAY = '#f3f4f6';
const PARENT_TYPE = 'commitment' as const;

export default function CommitmentEnrichmentModal({
  visible,
  commitment,
  initialTab,
  onClose,
  onEnrichmentChange,
}: CommitmentEnrichmentModalProps) {
  const [activeTab, setActiveTab] = useState<EnrichmentTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyScope, setApplyScope] = useState<'one' | 'all'>('one');
  const isRecurring = !!commitment.external_recurrence_id;

  // Roles
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Wellness / Domains
  const [allDomains, setAllDomains] = useState<DomainRow[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);

  // Goals
  const [allGoals, setAllGoals] = useState<GoalRow[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<
    Array<{ goal_id: string; goal_type: GoalRow['goal_type'] }>
  >([]);

  // Priority
  const [isUrgent, setIsUrgent] = useState(commitment.is_urgent);
  const [isImportant, setIsImportant] = useState(commitment.is_important);

  // Notes
  const [noteText, setNoteText] = useState('');
  const [existingNotes, setExistingNotes] = useState<NoteRow[]>([]);

  // Delegate
  const [existingDelegates, setExistingDelegates] = useState<DelegateRow[]>([]);
  const [delegateModalVisible, setDelegateModalVisible] = useState(false);
  const [currentDelegateId, setCurrentDelegateId] = useState<string | null>(null);

  // Reset per-open state when modal opens (or commitment/initialTab changes)
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setApplyScope('one');
      setIsUrgent(commitment.is_urgent);
      setIsImportant(commitment.is_important);
      setNoteText('');
    }
  }, [
    visible,
    initialTab,
    commitment.id,
    commitment.is_urgent,
    commitment.is_important,
  ]);

  // Load data for the active tab whenever modal is open and tab changes
  useEffect(() => {
    if (!visible) return;
    loadTabData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, activeTab, commitment.id]);

  const loadTabData = async (tab: EnrichmentTab) => {
    setLoading(true);
    try {
      const sb = getSupabaseClient();

      if (tab === 'roles') {
        const [rolesRes, joinsRes] = await Promise.all([
          sb
            .from('0008-ap-roles')
            .select('id, label')
            .eq('user_id', commitment.user_id)
            .order('label'),
          sb
            .from('0008-ap-universal-roles-join')
            .select('role_id')
            .eq('parent_id', commitment.id)
            .eq('parent_type', PARENT_TYPE),
        ]);
        setAllRoles((rolesRes.data ?? []) as RoleRow[]);
        setSelectedRoleIds(
          ((joinsRes.data ?? []) as any[]).map((r) => r.role_id),
        );
      } else if (tab === 'wellness') {
        const [domRes, joinsRes] = await Promise.all([
          sb
            .from('0008-ap-domains')
            .select('id, name')
            .order('name'),
          sb
            .from('0008-ap-universal-domains-join')
            .select('domain_id')
            .eq('parent_id', commitment.id)
            .eq('parent_type', PARENT_TYPE),
        ]);
        setAllDomains(
          ((domRes.data ?? []) as any[]).map((d) => ({
            id: d.id,
            label: d.name,
          })),
        );
        setSelectedDomainIds(
          ((joinsRes.data ?? []) as any[]).map((r) => r.domain_id),
        );
      } else if (tab === 'goals') {
        const [twelveRes, customRes, joinsRes] = await Promise.all([
          sb
            .from('0008-ap-goals-12wk')
            .select('id, title')
            .eq('user_id', commitment.user_id),
          sb
            .from('0008-ap-goals-custom')
            .select('id, title')
            .eq('user_id', commitment.user_id),
          sb
            .from('0008-ap-universal-goals-join')
            .select('goal_id, goal_type')
            .eq('parent_id', commitment.id)
            .eq('parent_type', PARENT_TYPE),
        ]);
        const twelve: GoalRow[] = ((twelveRes.data ?? []) as any[]).map((g) => ({
          id: g.id,
          title: g.title,
          goal_type: 'twelve_wk_goal',
        }));
        const custom: GoalRow[] = ((customRes.data ?? []) as any[]).map((g) => ({
          id: g.id,
          title: g.title,
          goal_type: 'custom_goal',
        }));
        setAllGoals([...twelve, ...custom]);
        setSelectedGoals(
          ((joinsRes.data ?? []) as any[]).map((r) => ({
            goal_id: r.goal_id,
            goal_type: r.goal_type,
          })),
        );
      } else if (tab === 'notes') {
        const { data } = await sb
          .from('0008-ap-universal-notes-join')
          .select('note_id, "0008-ap-notes"(id, content, created_at)')
          .eq('parent_id', commitment.id)
          .eq('parent_type', PARENT_TYPE);
        const notes = ((data ?? []) as any[])
          .map((r) => r['0008-ap-notes'])
          .filter(Boolean) as NoteRow[];
        notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setExistingNotes(notes);
      } else if (tab === 'delegate') {
        const [delegatesRes, joinRes] = await Promise.all([
          sb
            .from('0008-ap-delegates')
            .select('id, name, email, phone')
            .eq('user_id', commitment.user_id)
            .order('name'),
          sb
            .from('0008-ap-universal-delegates-join')
            .select('delegate_id')
            .eq('parent_id', commitment.id)
            .eq('parent_type', PARENT_TYPE)
            .maybeSingle(),
        ]);
        setExistingDelegates((delegatesRes.data ?? []) as DelegateRow[]);
        setCurrentDelegateId(
          ((joinRes.data as any)?.delegate_id) ?? null,
        );
      }
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] loadTabData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // If "All occurrences" is chosen, resolve every commitment that shares the
  // external_recurrence_id; otherwise just the current one.
  const getTargetCommitmentIds = async (): Promise<string[]> => {
    if (applyScope === 'one' || !isRecurring || !commitment.external_recurrence_id) {
      return [commitment.id];
    }
    const sb = getSupabaseClient();
    const { data } = await sb
      .from('0008-ap-commitments')
      .select('id')
      .eq('user_id', commitment.user_id)
      .eq('external_recurrence_id', commitment.external_recurrence_id);
    return ((data ?? []) as any[]).map((r) => r.id);
  };

  // ──────────────── Save handlers ────────────────

  const saveRoles = async () => {
    const sb = getSupabaseClient();
    const targets = await getTargetCommitmentIds();
    for (const pid of targets) {
      await sb
        .from('0008-ap-universal-roles-join')
        .delete()
        .eq('parent_id', pid)
        .eq('parent_type', PARENT_TYPE);
      if (selectedRoleIds.length > 0) {
        const rows = selectedRoleIds.map((role_id) => ({
          parent_id: pid,
          parent_type: PARENT_TYPE,
          role_id,
          user_id: commitment.user_id,
        }));
        const { error } = await sb
          .from('0008-ap-universal-roles-join')
          .insert(rows);
        if (error) throw error;
      }
    }
  };

  const saveWellness = async () => {
    const sb = getSupabaseClient();
    const targets = await getTargetCommitmentIds();
    for (const pid of targets) {
      await sb
        .from('0008-ap-universal-domains-join')
        .delete()
        .eq('parent_id', pid)
        .eq('parent_type', PARENT_TYPE);
      if (selectedDomainIds.length > 0) {
        const rows = selectedDomainIds.map((domain_id) => ({
          parent_id: pid,
          parent_type: PARENT_TYPE,
          domain_id,
          user_id: commitment.user_id,
        }));
        const { error } = await sb
          .from('0008-ap-universal-domains-join')
          .insert(rows);
        if (error) throw error;
      }
    }
  };

  const saveGoals = async () => {
    const sb = getSupabaseClient();
    const targets = await getTargetCommitmentIds();
    for (const pid of targets) {
      await sb
        .from('0008-ap-universal-goals-join')
        .delete()
        .eq('parent_id', pid)
        .eq('parent_type', PARENT_TYPE);
      if (selectedGoals.length > 0) {
        const rows = selectedGoals.map((g) => ({
          parent_id: pid,
          parent_type: PARENT_TYPE,
          goal_id: g.goal_id,
          goal_type: g.goal_type,
          user_id: commitment.user_id,
        }));
        const { error } = await sb
          .from('0008-ap-universal-goals-join')
          .insert(rows);
        if (error) throw error;
      }
    }
  };

  const savePriority = async () => {
    const sb = getSupabaseClient();
    const targets = await getTargetCommitmentIds();
    const { error } = await sb
      .from('0008-ap-commitments')
      .update({
        is_urgent: isUrgent,
        is_important: isImportant,
        updated_at: new Date().toISOString(),
      })
      .in('id', targets);
    if (error) throw error;
  };

  const saveNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const sb = getSupabaseClient();
    const now = new Date().toISOString();
    const { data: noteRow, error: noteErr } = await sb
      .from('0008-ap-notes')
      .insert({
        user_id: commitment.user_id,
        content: trimmed,
        created_at: now,
        updated_at: now,
      })
      .select('id, content, created_at')
      .single();
    if (noteErr || !noteRow) throw noteErr ?? new Error('Failed to insert note');
    const { error: joinErr } = await sb
      .from('0008-ap-universal-notes-join')
      .insert({
        user_id: commitment.user_id,
        note_id: noteRow.id,
        parent_id: commitment.id,
        parent_type: PARENT_TYPE,
      });
    if (joinErr) throw joinErr;
    setExistingNotes((prev) => [noteRow as NoteRow, ...prev]);
    setNoteText('');
  };

  const deleteNote = async (noteId: string) => {
    const sb = getSupabaseClient();
    try {
      await sb
        .from('0008-ap-universal-notes-join')
        .delete()
        .eq('note_id', noteId)
        .eq('parent_id', commitment.id)
        .eq('parent_type', PARENT_TYPE);
      await sb.from('0008-ap-notes').delete().eq('id', noteId);
      setExistingNotes((prev) => prev.filter((n) => n.id !== noteId));
      onEnrichmentChange();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] deleteNote error:', err);
      Alert.alert('Error', 'Failed to delete note.');
    }
  };

  const handleDelegateSelected = async (delegateId: string) => {
    setDelegateModalVisible(false);
    try {
      const sb = getSupabaseClient();
      await sb
        .from('0008-ap-universal-delegates-join')
        .delete()
        .eq('parent_id', commitment.id)
        .eq('parent_type', PARENT_TYPE);
      const { error } = await sb
        .from('0008-ap-universal-delegates-join')
        .insert({
          user_id: commitment.user_id,
          delegate_id: delegateId,
          parent_id: commitment.id,
          parent_type: PARENT_TYPE,
        });
      if (error) throw error;
      setCurrentDelegateId(delegateId);
      onEnrichmentChange();
      Alert.alert('Delegated', 'Commitment delegated successfully.');
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] delegate save error:', err);
      Alert.alert('Error', 'Failed to save delegate.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      switch (activeTab) {
        case 'roles':
          await saveRoles();
          break;
        case 'wellness':
          await saveWellness();
          break;
        case 'goals':
          await saveGoals();
          break;
        case 'priority':
          await savePriority();
          break;
        case 'notes':
          await saveNote();
          break;
        case 'delegate':
          // Delegate tab writes are handled inside handleDelegateSelected.
          break;
      }
      onEnrichmentChange();
      onClose();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] save error:', err);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ──────────────── Chip toggles ────────────────

  const toggleRole = (id: string) =>
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleDomain = (id: string) =>
    setSelectedDomainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleGoal = (g: GoalRow) =>
    setSelectedGoals((prev) => {
      const exists = prev.find(
        (s) => s.goal_id === g.id && s.goal_type === g.goal_type,
      );
      if (exists)
        return prev.filter(
          (s) => !(s.goal_id === g.id && s.goal_type === g.goal_type),
        );
      return [...prev, { goal_id: g.id, goal_type: g.goal_type }];
    });

  // ──────────────── Renderers ────────────────

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
    subtitle?: string,
  ) => (
    <TouchableOpacity
      key={`${label}-${subtitle ?? ''}`}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text
        style={[
          styles.chipText,
          selected ? styles.chipTextSelected : styles.chipTextUnselected,
        ]}
      >
        {label}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.chipSubtitle,
            selected ? styles.chipTextSelected : styles.chipTextUnselected,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  const renderRecurrenceScope = () => {
    if (!isRecurring) return null;
    return (
      <View style={styles.scopeRow}>
        <Text style={styles.scopeLabel}>Apply to:</Text>
        <TouchableOpacity
          onPress={() => setApplyScope('one')}
          style={[styles.scopeBtn, applyScope === 'one' && styles.scopeBtnActive]}
        >
          <Text
            style={[
              styles.scopeBtnText,
              applyScope === 'one' && styles.scopeBtnTextActive,
            ]}
          >
            This event only
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setApplyScope('all')}
          style={[styles.scopeBtn, applyScope === 'all' && styles.scopeBtnActive]}
        >
          <Text
            style={[
              styles.scopeBtnText,
              applyScope === 'all' && styles.scopeBtnTextActive,
            ]}
          >
            All occurrences
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      );
    }
    switch (activeTab) {
      case 'roles':
        return (
          <>
            <View style={styles.chipWrap}>
              {allRoles.map((r) =>
                renderChip(r.label, selectedRoleIds.includes(r.id), () =>
                  toggleRole(r.id),
                ),
              )}
              {allRoles.length === 0 && (
                <Text style={styles.emptyText}>No roles found.</Text>
              )}
            </View>
            {renderRecurrenceScope()}
          </>
        );

      case 'wellness':
        return (
          <>
            <View style={styles.chipWrap}>
              {allDomains.map((d) =>
                renderChip(d.label, selectedDomainIds.includes(d.id), () =>
                  toggleDomain(d.id),
                ),
              )}
              {allDomains.length === 0 && (
                <Text style={styles.emptyText}>No wellness zones found.</Text>
              )}
            </View>
            {renderRecurrenceScope()}
          </>
        );

      case 'goals':
        return (
          <>
            <View style={styles.chipWrap}>
              {allGoals.map((g) =>
                renderChip(
                  g.title,
                  selectedGoals.some(
                    (s) => s.goal_id === g.id && s.goal_type === g.goal_type,
                  ),
                  () => toggleGoal(g),
                  g.goal_type === 'twelve_wk_goal' ? '12-week' : 'Custom',
                ),
              )}
              {allGoals.length === 0 && (
                <Text style={styles.emptyText}>No goals found.</Text>
              )}
            </View>
            {renderRecurrenceScope()}
          </>
        );

      case 'priority': {
        const quadrant = (
          u: boolean,
          i: boolean,
          label: string,
          bg: string,
        ) => {
          const active = isUrgent === u && isImportant === i;
          return (
            <TouchableOpacity
              onPress={() => {
                setIsUrgent(u);
                setIsImportant(i);
              }}
              style={[
                styles.quadrant,
                {
                  backgroundColor: bg,
                  borderColor: active ? PRIMARY : 'transparent',
                  borderWidth: active ? 3 : 0,
                },
              ]}
            >
              <Text style={styles.quadrantText}>{label}</Text>
            </TouchableOpacity>
          );
        };
        return (
          <>
            <View style={styles.quadrantGrid}>
              <View style={styles.quadrantRow}>
                {quadrant(true, true, 'Urgent &\nImportant', '#ef4444')}
                {quadrant(false, true, 'Important\nOnly', '#10b981')}
              </View>
              <View style={styles.quadrantRow}>
                {quadrant(true, false, 'Urgent\nOnly', '#f59e0b')}
                {quadrant(false, false, 'Neither', '#9ca3af')}
              </View>
            </View>
            {renderRecurrenceScope()}
          </>
        );
      }

      case 'notes':
        return (
          <>
            {existingNotes.length > 0 && (
              <View style={styles.notesList}>
                {existingNotes.map((n) => (
                  <View key={n.id} style={styles.noteRow}>
                    <Text style={styles.noteText} numberOfLines={3}>
                      {n.content}
                    </Text>
                    <TouchableOpacity
                      onPress={() => deleteNote(n.id)}
                      style={styles.noteDeleteBtn}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Write a note…"
              placeholderTextColor={GRAY_TEXT}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() =>
                Alert.alert(
                  'Add attachment',
                  'Attachment picker will be wired to mirror TaskEventForm’s noteAttachmentUtils flow in a follow-up pass.',
                )
              }
            >
              <Paperclip size={16} color={PRIMARY} />
              <Text style={styles.attachBtnText}>Add attachment</Text>
            </TouchableOpacity>
          </>
        );

      case 'delegate':
        return (
          <View style={styles.delegatePane}>
            {currentDelegateId ? (
              <Text style={styles.delegateCurrent}>
                Currently delegated to:{' '}
                {existingDelegates.find((d) => d.id === currentDelegateId)?.name ??
                  '—'}
              </Text>
            ) : (
              <Text style={styles.delegateCurrent}>Not currently delegated.</Text>
            )}
            <TouchableOpacity
              style={styles.delegateOpenBtn}
              onPress={() => setDelegateModalVisible(true)}
            >
              <Text style={styles.delegateOpenBtnText}>
                {currentDelegateId ? 'Change delegate' : 'Assign delegate'}
              </Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  const TAB_DEFS: Array<{ key: EnrichmentTab; Icon: any }> = [
    { key: 'roles', Icon: Users },
    { key: 'wellness', Icon: Heart },
    { key: 'goals', Icon: Flag },
    { key: 'priority', Icon: Target },
    { key: 'notes', Icon: FileText },
    { key: 'delegate', Icon: UserPlus },
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {commitment.title}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.headerClose}>
                <X size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
              {TAB_DEFS.map(({ key, Icon }) => {
                const active = activeTab === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => setActiveTab(key)}
                  >
                    <Icon
                      size={22}
                      color={active ? PRIMARY : GRAY_TEXT}
                      fill={active ? PRIMARY : 'transparent'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Content */}
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {renderTabContent()}
            </ScrollView>

            {/* Save button (hidden on delegate tab — DelegateModal has its own Save) */}
            {activeTab !== 'delegate' && (
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DelegateModal rendered as a sibling (not nested) to avoid RN nested-modal quirks */}
      <DelegateModal
        visible={delegateModalVisible}
        onClose={() => setDelegateModalVisible(false)}
        onSave={handleDelegateSelected}
        existingDelegates={existingDelegates as any}
        userId={commitment.user_id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '88%',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
  },
  headerClose: { padding: 4 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY },

  body: { flexGrow: 0 },
  bodyContent: { padding: 20, paddingBottom: 8 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipSelected: { backgroundColor: PRIMARY },
  chipUnselected: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  chipTextUnselected: { color: GRAY_TEXT },
  chipSubtitle: { fontSize: 10, marginTop: 1 },
  emptyText: {
    color: GRAY_TEXT,
    fontSize: 14,
    fontStyle: 'italic',
    padding: 8,
  },

  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  scopeLabel: {
    fontSize: 13,
    color: GRAY_TEXT,
    fontWeight: '500',
    marginRight: 4,
  },
  scopeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  scopeBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  scopeBtnText: { fontSize: 12, color: GRAY_TEXT, fontWeight: '500' },
  scopeBtnTextActive: { color: '#fff' },

  quadrantGrid: { gap: 8 },
  quadrantRow: { flexDirection: 'row', gap: 8 },
  quadrant: {
    flex: 1,
    minHeight: 90,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  quadrantText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },

  notesList: { marginBottom: 12, gap: 8 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BG_GRAY,
    borderRadius: 8,
    padding: 10,
  },
  noteText: { flex: 1, fontSize: 13, color: '#374151' },
  noteDeleteBtn: { padding: 4, marginLeft: 8 },
  noteInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  attachBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '500' },

  delegatePane: { gap: 16 },
  delegateCurrent: { fontSize: 14, color: '#374151' },
  delegateOpenBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  delegateOpenBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  saveBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  loadingBox: { padding: 40, alignItems: 'center' },
});
