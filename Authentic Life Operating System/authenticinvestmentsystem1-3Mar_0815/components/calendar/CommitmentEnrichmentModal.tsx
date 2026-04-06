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
  Plus,
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
  const [applyScope, setApplyScope] = useState<'one' | 'all'>('one');
  const isRecurring = !!commitment.external_recurrence_id;

  // Roles
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleRelationships, setRoleRelationships] = useState<
    Record<string, Array<{ id: string; name: string }>>
  >({});
  const [selectedRelIds, setSelectedRelIds] = useState<string[]>([]);

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
  const [addingNote, setAddingNote] = useState(false);

  // Delegate
  const [existingDelegates, setExistingDelegates] = useState<DelegateRow[]>([]);
  const [delegateModalVisible, setDelegateModalVisible] = useState(false);
  const [currentDelegateId, setCurrentDelegateId] = useState<string | null>(null);

  // Load ALL data once when modal opens
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setApplyScope('one');
      setIsUrgent(commitment.is_urgent);
      setIsImportant(commitment.is_important);
      setNoteText('');
      setSelectedRelIds([]);
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, commitment.id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const sb = getSupabaseClient();

      const [
        rolesRes, roleJoinsRes,
        domRes, domJoinsRes,
        twelveRes, customRes, goalJoinsRes,
        notesRes,
        delegatesRes, delegateJoinRes,
      ] = await Promise.all([
        // Roles
        sb.from('0008-ap-roles').select('id, label').eq('user_id', commitment.user_id).order('label'),
        sb.from('0008-ap-universal-roles-join').select('role_id').eq('parent_id', commitment.id).eq('parent_type', PARENT_TYPE),
        // Wellness
        sb.from('0008-ap-domains').select('id, name').order('name'),
        sb.from('0008-ap-universal-domains-join').select('domain_id').eq('parent_id', commitment.id).eq('parent_type', PARENT_TYPE),
        // Goals
        sb.from('0008-ap-goals-12wk').select('id, title').eq('user_id', commitment.user_id),
        sb.from('0008-ap-goals-custom').select('id, title').eq('user_id', commitment.user_id),
        sb.from('0008-ap-universal-goals-join').select('goal_id, goal_type').eq('parent_id', commitment.id).eq('parent_type', PARENT_TYPE),
        // Notes
        sb.from('0008-ap-universal-notes-join').select('note_id, "0008-ap-notes"(id, content, created_at)').eq('parent_id', commitment.id).eq('parent_type', PARENT_TYPE),
        // Delegates
        sb.from('0008-ap-delegates').select('id, name, email, phone').eq('user_id', commitment.user_id).order('name'),
        sb.from('0008-ap-universal-delegates-join').select('delegate_id').eq('parent_id', commitment.id).eq('parent_type', PARENT_TYPE).maybeSingle(),
      ]);

      // Roles
      const roles = (rolesRes.data ?? []) as RoleRow[];
      setAllRoles(roles);
      setSelectedRoleIds(((roleJoinsRes.data ?? []) as any[]).map((r) => r.role_id));

      // Key relationships grouped by role
      if (roles.length > 0) {
        const relsRes = await sb
          .from('0008-ap-key-relationships')
          .select('id, name, role_id')
          .eq('user_id', commitment.user_id)
          .in('role_id', roles.map((r) => r.id));
        const relMap: Record<string, Array<{ id: string; name: string }>> = {};
        for (const rel of ((relsRes.data ?? []) as any[])) {
          if (!relMap[rel.role_id]) relMap[rel.role_id] = [];
          relMap[rel.role_id].push({ id: rel.id, name: rel.name });
        }
        setRoleRelationships(relMap);
      } else {
        setRoleRelationships({});
      }

      // Wellness
      setAllDomains(((domRes.data ?? []) as any[]).map((d) => ({ id: d.id, label: d.name })));
      setSelectedDomainIds(((domJoinsRes.data ?? []) as any[]).map((r) => r.domain_id));

      // Goals
      const twelve: GoalRow[] = ((twelveRes.data ?? []) as any[]).map((g) => ({ id: g.id, title: g.title, goal_type: 'twelve_wk_goal' }));
      const custom: GoalRow[] = ((customRes.data ?? []) as any[]).map((g) => ({ id: g.id, title: g.title, goal_type: 'custom_goal' }));
      setAllGoals([...twelve, ...custom]);
      setSelectedGoals(((goalJoinsRes.data ?? []) as any[]).map((r) => ({ goal_id: r.goal_id, goal_type: r.goal_type })));

      // Notes
      const notes = ((notesRes.data ?? []) as any[])
        .map((r) => r['0008-ap-notes'])
        .filter(Boolean) as NoteRow[];
      notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setExistingNotes(notes);

      // Delegates
      setExistingDelegates((delegatesRes.data ?? []) as DelegateRow[]);
      setCurrentDelegateId(((delegateJoinRes.data as any)?.delegate_id) ?? null);
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] loadAllData error:', err);
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

  // ──────────────── Auto-save chip toggles ────────────────

  const toggleRole = async (id: string) => {
    const newIds = selectedRoleIds.includes(id)
      ? selectedRoleIds.filter((x) => x !== id)
      : [...selectedRoleIds, id];
    setSelectedRoleIds(newIds);
    try {
      const sb = getSupabaseClient();
      const targets = await getTargetCommitmentIds();
      for (const pid of targets) {
        await sb.from('0008-ap-universal-roles-join').delete().eq('parent_id', pid).eq('parent_type', PARENT_TYPE);
        if (newIds.length > 0) {
          await sb.from('0008-ap-universal-roles-join').insert(
            newIds.map((role_id) => ({
              parent_id: pid,
              parent_type: PARENT_TYPE,
              role_id,
              user_id: commitment.user_id,
            })),
          );
        }
      }
      onEnrichmentChange();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] toggleRole save error:', err);
    }
  };

  const toggleDomain = async (id: string) => {
    const newIds = selectedDomainIds.includes(id)
      ? selectedDomainIds.filter((x) => x !== id)
      : [...selectedDomainIds, id];
    setSelectedDomainIds(newIds);
    try {
      const sb = getSupabaseClient();
      const targets = await getTargetCommitmentIds();
      for (const pid of targets) {
        await sb.from('0008-ap-universal-domains-join').delete().eq('parent_id', pid).eq('parent_type', PARENT_TYPE);
        if (newIds.length > 0) {
          await sb.from('0008-ap-universal-domains-join').insert(
            newIds.map((domain_id) => ({
              parent_id: pid,
              parent_type: PARENT_TYPE,
              domain_id,
              user_id: commitment.user_id,
            })),
          );
        }
      }
      onEnrichmentChange();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] toggleDomain save error:', err);
    }
  };

  const toggleGoal = async (g: GoalRow) => {
    const exists = selectedGoals.find(
      (s) => s.goal_id === g.id && s.goal_type === g.goal_type,
    );
    const newGoals = exists
      ? selectedGoals.filter((s) => !(s.goal_id === g.id && s.goal_type === g.goal_type))
      : [...selectedGoals, { goal_id: g.id, goal_type: g.goal_type }];
    setSelectedGoals(newGoals);
    try {
      const sb = getSupabaseClient();
      const targets = await getTargetCommitmentIds();
      for (const pid of targets) {
        await sb.from('0008-ap-universal-goals-join').delete().eq('parent_id', pid).eq('parent_type', PARENT_TYPE);
        if (newGoals.length > 0) {
          await sb.from('0008-ap-universal-goals-join').insert(
            newGoals.map((goal) => ({
              parent_id: pid,
              parent_type: PARENT_TYPE,
              goal_id: goal.goal_id,
              goal_type: goal.goal_type,
              user_id: commitment.user_id,
            })),
          );
        }
      }
      onEnrichmentChange();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] toggleGoal save error:', err);
    }
  };

  // ──────────────── Auto-save priority ────────────────

  const selectPriority = async (u: boolean, i: boolean) => {
    setIsUrgent(u);
    setIsImportant(i);
    try {
      const sb = getSupabaseClient();
      const targets = await getTargetCommitmentIds();
      await sb
        .from('0008-ap-commitments')
        .update({ is_urgent: u, is_important: i, updated_at: new Date().toISOString() })
        .in('id', targets);
      onEnrichmentChange();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] selectPriority save error:', err);
    }
  };

  // ──────────────── Key Relationship toggle (visual-only) ────────────────

  const toggleRelationship = (relId: string) => {
    setSelectedRelIds((prev) =>
      prev.includes(relId) ? prev.filter((x) => x !== relId) : [...prev, relId],
    );
    // Visual-only for now — future: link to key-relationships-join table
  };

  // ──────────────── Notes ────────────────

  const addNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setAddingNote(true);
    try {
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
      onEnrichmentChange();
    } catch (err) {
      console.error('[CommitmentEnrichmentModal] addNote error:', err);
      Alert.alert('Error', 'Failed to add note.');
    } finally {
      setAddingNote(false);
    }
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

  // ──────────────── Delegate ────────────────

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

  // ──────────────── Close handler ────────────────

  const handleClose = () => {
    onEnrichmentChange();
    onClose();
  };

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
            {selectedRoleIds.length > 0 && (
              <View style={styles.relSection}>
                {selectedRoleIds.map((roleId) => {
                  const rels = roleRelationships[roleId] ?? [];
                  if (rels.length === 0) return null;
                  const roleName = allRoles.find((r) => r.id === roleId)?.label ?? '';
                  return (
                    <View key={roleId} style={styles.relGroup}>
                      <Text style={styles.relRoleLabel}>{roleName}</Text>
                      <View style={styles.relChipRow}>
                        {rels.map((rel) => {
                          const isRelSelected = selectedRelIds.includes(rel.id);
                          return (
                            <TouchableOpacity
                              key={rel.id}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                toggleRelationship(rel.id);
                              }}
                              style={[
                                styles.relChip,
                                isRelSelected && styles.relChipSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.relChipText,
                                  isRelSelected && styles.relChipTextSelected,
                                ]}
                              >
                                {rel.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
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
              onPress={() => selectPriority(u, i)}
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
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={[styles.addNoteBtn, (!noteText.trim() || addingNote) && styles.addNoteBtnDisabled]}
                onPress={addNote}
                disabled={!noteText.trim() || addingNote}
              >
                {addingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Plus size={14} color="#fff" />
                    <Text style={styles.addNoteBtnText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() =>
                  Alert.alert(
                    'Add attachment',
                    'Attachment picker will be wired to mirror TaskEventForm\'s noteAttachmentUtils flow in a follow-up pass.',
                  )
                }
              >
                <Paperclip size={16} color={PRIMARY} />
                <Text style={styles.attachBtnText}>Add attachment</Text>
              </TouchableOpacity>
            </View>
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
    { key: 'goals', Icon: Target },
    { key: 'priority', Icon: Flag },
    { key: 'notes', Icon: FileText },
    { key: 'delegate', Icon: UserPlus },
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
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
              <TouchableOpacity onPress={handleClose} style={styles.headerClose}>
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
    minHeight: 80,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addNoteBtnDisabled: { opacity: 0.4 },
  addNoteBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

  loadingBox: { padding: 40, alignItems: 'center' },

  relSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  relGroup: { marginBottom: 12 },
  relRoleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  relChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  relChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  relChipSelected: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  relChipText: { fontSize: 12, color: '#1d4ed8' },
  relChipTextSelected: { color: '#ffffff' },
});
