import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  Activity,
  Brain,
  Droplet,
  Footprints,
  Moon,
  Scale,
  Lightbulb,
} from 'lucide-react-native';

import { getSupabaseClient } from '@/lib/supabase';

/**
 * AddTrackerModal — Minimalist Executive design system
 * Browse the tracker library and activate new trackers for a zone.
 * Uses activate_tracker_from_library RPC for atomic activation
 * (creates session, steps, instance, and domain join in one transaction).
 */

export interface AddTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  domainId: string;
  userId: string;
  onActivated?: () => void;
  accentColor?: string;
}

interface TrackerLibraryEntry {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  default_domain_id: string | null;
  measurement_type: string;
  default_unit_label: string | null;
  default_currency_code: string | null;
  default_goal_value: number | null;
  default_goal_value_max: number | null;
  default_goal_direction: string | null;
  default_frequency: string;
  is_compound: boolean;
  sort_order: number;
  is_active: boolean;
}

const DEFAULT_ACCENT = '#16a34a';

const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  scale: Scale,
  moon: Moon,
  droplet: Droplet,
  footprints: Footprints,
  brain: Brain,
};

function getIconComponent(iconName: string | null) {
  if (!iconName) return Activity;
  return ICON_MAP[iconName] ?? Activity;
}

function getHintLabel(entry: TrackerLibraryEntry): string {
  if (entry.default_unit_label) return entry.default_unit_label;
  if (entry.default_currency_code) return entry.default_currency_code;
  return entry.measurement_type;
}

export function AddTrackerModal({
  visible,
  onClose,
  domainId,
  userId,
  onActivated,
  accentColor = DEFAULT_ACCENT,
}: AddTrackerModalProps) {
  const [libraryEntries, setLibraryEntries] = useState<TrackerLibraryEntry[]>([]);
  const [activatedLibraryIds, setActivatedLibraryIds] = useState<Set<string>>(new Set());
  const [inactiveLibraryIds, setInactiveLibraryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  const anyActivating = activatingId !== null;

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const [libRes, actRes] = await Promise.all([
        supabase
          .from('0008-ap-tracker-library')
          .select('*')
          .eq('is_active', true)
          .or(`default_domain_id.eq.${domainId},default_domain_id.is.null`)
          .order('sort_order'),
        supabase
          .from('0008-ap-tracker-instances')
          .select('library_id, is_active')
          .eq('user_id', userId),
      ]);

      if (libRes.error) throw libRes.error;
      if (actRes.error) throw actRes.error;

      setLibraryEntries((libRes.data ?? []) as TrackerLibraryEntry[]);
      const activeSet = new Set<string>();
      const inactiveSet = new Set<string>();
      for (const row of actRes.data ?? []) {
        const libId = row.library_id as string | null;
        if (!libId) continue;
        if (row.is_active) activeSet.add(libId);
        else inactiveSet.add(libId);
      }
      setActivatedLibraryIds(activeSet);
      setInactiveLibraryIds(inactiveSet);
    } catch (err) {
      console.error('AddTrackerModal load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, domainId]);

  useEffect(() => {
    if (!visible) return;
    setExpandedId(null);
    setActivatingId(null);
    setSuggestionOpen(false);
    setSuggestionText('');
    loadData();
  }, [visible, loadData]);

  const availableEntries = libraryEntries.filter(
    e => !activatedLibraryIds.has(e.id),
  );

  const handleActivate = useCallback(async (entry: TrackerLibraryEntry) => {
    setActivatingId(entry.id);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .rpc('activate_tracker_from_library', {
          p_library_id: entry.id,
          p_domain_id: domainId,
        })
        .single();

      if (error) {
        if (error.message?.toLowerCase().includes('already')) {
          await loadData();
          Alert.alert('Already activated', 'This tracker is already active.');
          return;
        }
        throw error;
      }

      setActivatedLibraryIds(prev => {
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });
      setExpandedId(null);
      onActivated?.();
    } catch (err: any) {
      console.error('AddTrackerModal activation error:', err);
      Alert.alert(
        'Error',
        err?.message ?? 'Failed to activate tracker. Please try again.',
      );
    } finally {
      setActivatingId(null);
    }
  }, [domainId, loadData, onActivated]);

  const handleSubmitSuggestion = useCallback(async () => {
    const text = suggestionText.trim();
    if (!text) return;
    setSubmittingSuggestion(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-suggestions')
        .insert({
          user_id: userId,
          content: `Tracker suggestion: ${text}`,
        });
      if (error) throw error;
      setSuggestionText('');
      setSuggestionOpen(false);
      Alert.alert('Thanks!', 'Your suggestion has been submitted.');
    } catch (err: any) {
      console.error('AddTrackerModal suggestion error:', err);
      Alert.alert('Error', err?.message ?? 'Failed to submit suggestion.');
    } finally {
      setSubmittingSuggestion(false);
    }
  }, [suggestionText, userId]);

  const renderEntryCard = (entry: TrackerLibraryEntry) => {
    const IconComponent = getIconComponent(entry.icon);
    const hint = getHintLabel(entry);
    const isExpanded = expandedId === entry.id;
    const isActivating = activatingId === entry.id;

    return (
      <View
        key={entry.id}
        style={[
          styles.card,
          isExpanded && { borderColor: accentColor, borderWidth: 1.5 },
        ]}
      >
        <Pressable
          onPress={() => {
            if (anyActivating) return;
            setExpandedId(prev => (prev === entry.id ? null : entry.id));
          }}
          style={styles.cardRow}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: accentColor + '20' },
            ]}
          >
            <IconComponent size={22} color={accentColor} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={[styles.cardName, { flexShrink: 1 }]} numberOfLines={1}>
                {entry.name}
              </Text>
              {inactiveLibraryIds.has(entry.id) && (
                <Text style={styles.previouslyActive} numberOfLines={1}>
                  (previously active)
                </Text>
              )}
            </View>
            {entry.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {entry.description}
              </Text>
            ) : null}
          </View>
          <View style={[styles.hintChip, { borderColor: accentColor }]}>
            <Text style={[styles.hintText, { color: accentColor }]} numberOfLines={1}>
              {hint}
            </Text>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.confirmRow}>
            <Pressable
              onPress={() => setExpandedId(null)}
              disabled={isActivating}
              style={[styles.cancelButton, isActivating && { opacity: 0.4 }]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => handleActivate(entry)}
              disabled={isActivating}
              style={[
                styles.activateButton,
                { backgroundColor: accentColor },
                isActivating && { opacity: 0.7 },
              ]}
            >
              {isActivating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.activateButtonText}>Activate</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add a tracker</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          ) : availableEntries.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>All trackers activated</Text>
              <Text style={styles.emptyText}>
                You have all available trackers activated for this zone.
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {availableEntries.map(renderEntryCard)}
            </View>
          )}

          <View style={styles.suggestionWrap}>
            {!suggestionOpen ? (
              <Pressable onPress={() => setSuggestionOpen(true)}>
                <Text style={styles.suggestionLink}>
                  Don't see what you're looking for?{' '}
                  <Text style={[styles.suggestionLinkAccent, { color: accentColor }]}>
                    Suggest a tracker
                  </Text>
                </Text>
              </Pressable>
            ) : (
              <View style={styles.suggestionForm}>
                <View style={styles.suggestionHeader}>
                  <Lightbulb size={16} color={accentColor} />
                  <Text style={styles.suggestionHeaderText}>SUGGEST A TRACKER</Text>
                </View>
                <TextInput
                  value={suggestionText}
                  onChangeText={setSuggestionText}
                  placeholder="What tracker would you like?"
                  placeholderTextColor="#9ca3af"
                  style={styles.suggestionInput}
                  multiline
                  editable={!submittingSuggestion}
                  maxLength={200}
                />
                <View style={styles.suggestionButtons}>
                  <Pressable
                    onPress={() => {
                      setSuggestionText('');
                      setSuggestionOpen(false);
                    }}
                    disabled={submittingSuggestion}
                    style={[styles.cancelButton, submittingSuggestion && { opacity: 0.4 }]}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmitSuggestion}
                    disabled={!suggestionText.trim() || submittingSuggestion}
                    style={[
                      styles.activateButton,
                      { backgroundColor: accentColor },
                      (!suggestionText.trim() || submittingSuggestion) && { opacity: 0.5 },
                    ]}
                  >
                    {submittingSuggestion ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.activateButtonText}>Submit</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16 },

  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center' },

  cardList: { gap: 10 },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  previouslyActive: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  cardDesc: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  hintChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#ffffff',
  },
  hintText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },

  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  activateButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateButtonText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  suggestionWrap: { paddingVertical: 12 },
  suggestionLink: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  suggestionLinkAccent: { fontWeight: '600' },
  suggestionForm: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 12,
    gap: 8,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#6b7280',
  },
  suggestionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: '#1f2937',
    minHeight: 60,
    backgroundColor: '#ffffff',
  },
  suggestionButtons: { flexDirection: 'row', gap: 8 },
});
