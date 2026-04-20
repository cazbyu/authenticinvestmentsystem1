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
  Users,
  Heart,
  UserCircle2,
  Target,
  Camera,
  Calendar,
  Pencil,
  Star,
  Check,
} from 'lucide-react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import {
  EnrichmentChip,
  chipWrapStyle,
  ENRICHMENT_CHIP_COLORS,
} from '@/components/common/EnrichmentChip';
import { DateTimePickerModal } from '@/components/DateTimePickerModal';
import type { TrackerInstance } from './TrackerCard';

/**
 * LogEntryForm — Minimalist Executive design system
 * Modal for logging a tracker value with optional context enrichment
 * (roles, zones, KRs, goals, rose/thorn). Adapts the primary value
 * input to the tracker's measurement_type.
 */

export interface LogEntryFormProps {
  visible: boolean;
  onClose: () => void;
  instance: TrackerInstance;
  sessionId: string | null;
  stepId: string;
  userId: string;
  defaultDomainId: string | null;
  onSaved?: () => void;
}

const WELLNESS_ACCENT = '#16a34a';

type InlinePanel = 'roles' | 'zones' | 'krs' | 'goals' | 'reflection' | null;
type ReflectionMode = 'none' | 'rose' | 'thorn';

interface RoleRow { id: string; label: string; }
interface DomainRow { id: string; name: string; }
interface KRRow { id: string; name: string; role_id: string; }
interface GoalRow {
  id: string;
  title: string;
  goal_type: 'twelve_wk_goal' | 'custom_goal';
}

export function LogEntryForm({
  visible,
  onClose,
  instance,
  sessionId: _sessionId,
  stepId,
  userId,
  defaultDomainId,
  onSaved,
}: LogEntryFormProps) {
  const [primaryValue, setPrimaryValue] = useState('');
  const [booleanValue, setBooleanValue] = useState<boolean | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [timeHours, setTimeHours] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [capturingLocation, setCapturingLocation] = useState(false);

  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [inlinePanel, setInlinePanel] = useState<InlinePanel>(null);
  const [photoNoteVisible, setPhotoNoteVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>(
    defaultDomainId ? [defaultDomainId] : []
  );
  const [selectedKRIds, setSelectedKRIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [reflectionMode, setReflectionMode] = useState<ReflectionMode>('none');

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [krs, setKRs] = useState<KRRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    setPrimaryValue('');
    setBooleanValue(null);
    setRatingValue(null);
    setDurationMinutes('');
    setDurationSeconds('');
    setTimeHours('');
    setTimeMinutes('');
    setCoords(null);
    setNote('');
    setSelectedDate(formatLocalDate(new Date()));
    setContextOpen(false);
    setInlinePanel(null);
    setPhotoNoteVisible(false);
    setSelectedRoleIds([]);
    setSelectedDomainIds(defaultDomainId ? [defaultDomainId] : []);
    setSelectedKRIds([]);
    setSelectedGoalIds([]);
    setReflectionMode('none');
  }, [visible, defaultDomainId]);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const [rolesRes, domainsRes, krsRes, twGoalsRes, customGoalsRes] =
          await Promise.all([
            supabase
              .from('0008-ap-roles')
              .select('id, label')
              .eq('user_id', userId)
              .eq('is_active', true)
              .order('label'),
            supabase.from('0008-ap-domains').select('id, name').order('name'),
            supabase
              .from('0008-ap-key-relationships')
              .select('id, name, role_id')
              .eq('user_id', userId)
              .order('name'),
            supabase
              .from('0008-ap-goals-12wk')
              .select('id, title')
              .eq('user_id', userId)
              .eq('status', 'active')
              .order('title'),
            supabase
              .from('0008-ap-goals-custom')
              .select('id, title')
              .eq('user_id', userId)
              .eq('status', 'active')
              .order('title'),
          ]);
        if (cancelled) return;
        setRoles(rolesRes.data ?? []);
        setDomains(domainsRes.data ?? []);
        setKRs(krsRes.data ?? []);
        const combined: GoalRow[] = [
          ...(twGoalsRes.data ?? []).map(g => ({
            ...g,
            goal_type: 'twelve_wk_goal' as const,
          })),
          ...(customGoalsRes.data ?? []).map(g => ({
            ...g,
            goal_type: 'custom_goal' as const,
          })),
        ];
        setGoals(combined);
      } catch (err) {
        console.error('LogEntryForm: reference fetch failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, userId]);

  const filteredKRs = selectedRoleIds.length > 0
    ? krs.filter(kr => selectedRoleIds.includes(kr.role_id))
    : krs;

  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const handleTogglePanel = (panel: Exclude<InlinePanel, null>) => {
    setInlinePanel(prev => (prev === panel ? null : panel));
  };

  const handleCaptureLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert('Unavailable', 'Location services are not available.');
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCapturingLocation(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        Alert.alert('Error', 'Could not capture location. Check browser permissions.');
        setCapturingLocation(false);
      },
    );
  }, []);

  const isPrimaryValid = (() => {
    switch (instance.measurement_type) {
      case 'number':
      case 'currency':
      case 'percentage':
      case 'distance':
      case 'hours':
        return primaryValue.trim().length > 0 && !Number.isNaN(Number(primaryValue));
      case 'duration':
        return durationMinutes.trim().length > 0 || durationSeconds.trim().length > 0;
      case 'boolean':
        return booleanValue !== null;
      case 'rating':
        return ratingValue !== null;
      case 'text':
        return primaryValue.trim().length > 0;
      case 'time_of_day':
        return timeHours.trim().length > 0 && timeMinutes.trim().length > 0;
      case 'coordinates':
        return coords !== null;
      default:
        return false;
    }
  })();

  const handleSave = useCallback(async () => {
    if (!isPrimaryValid) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      const payload: Record<string, any> = {
        user_id: userId,
        exercise_id: stepId,
        milestone_log_id: null,
        log_date: selectedDate,
        unit: instance.unit_label,
        notes: note.trim() || null,
      };

      switch (instance.measurement_type) {
        case 'number':
        case 'currency':
        case 'percentage':
        case 'distance':
        case 'hours':
          payload.value_number = Number(primaryValue);
          break;
        case 'duration': {
          const mins = Number(durationMinutes) || 0;
          const secs = Number(durationSeconds) || 0;
          payload.value_number = mins * 60 + secs;
          break;
        }
        case 'rating':
          payload.value_number = ratingValue;
          break;
        case 'boolean':
          payload.value_boolean = booleanValue;
          break;
        case 'text':
          payload.value_text = primaryValue.trim();
          break;
        case 'time_of_day':
          payload.value_text =
            `${timeHours.padStart(2, '0')}:${timeMinutes.padStart(2, '0')}`;
          break;
        case 'coordinates':
          payload.value_lat = coords?.lat;
          payload.value_lng = coords?.lng;
          break;
      }

      const { data: logRow, error: logErr } = await supabase
        .from('0008-ap-gl-step-log')
        .insert(payload)
        .select()
        .single();
      if (logErr) throw logErr;
      const stepLogId = logRow.id;

      const joins: Array<Promise<any>> = [];
      if (selectedRoleIds.length > 0) {
        joins.push(
          supabase.from('0008-ap-universal-roles-join').insert(
            selectedRoleIds.map(role_id => ({
              user_id: userId,
              parent_type: 'step_log',
              parent_id: stepLogId,
              role_id,
            })),
          ),
        );
      }
      if (selectedDomainIds.length > 0) {
        joins.push(
          supabase.from('0008-ap-universal-domains-join').insert(
            selectedDomainIds.map(domain_id => ({
              user_id: userId,
              parent_type: 'step_log',
              parent_id: stepLogId,
              domain_id,
            })),
          ),
        );
      }
      if (selectedKRIds.length > 0) {
        joins.push(
          supabase.from('0008-ap-universal-key-relationships-join').insert(
            selectedKRIds.map(key_relationship_id => ({
              user_id: userId,
              parent_type: 'step_log',
              parent_id: stepLogId,
              key_relationship_id,
            })),
          ),
        );
      }
      if (selectedGoalIds.length > 0) {
        joins.push(
          supabase.from('0008-ap-universal-goals-join').insert(
            selectedGoalIds.map(goal_id => {
              const g = goals.find(x => x.id === goal_id);
              return {
                user_id: userId,
                parent_type: 'step_log',
                parent_id: stepLogId,
                goal_id,
                goal_type: g?.goal_type ?? 'twelve_wk_goal',
              };
            }),
          ),
        );
      }
      await Promise.all(joins);

      if (reflectionMode === 'rose' || reflectionMode === 'thorn') {
        const content = note.trim() || (
          reflectionMode === 'rose'
            ? `Rose — ${instance.display_name}`
            : `Thorn — ${instance.display_name}`
        );
        await supabase.from('0008-ap-reflections').insert({
          user_id: userId,
          content,
          reflection_title: null,
          reflection_type: 'daily',
          date: selectedDate,
          archived: false,
          daily_rose: reflectionMode === 'rose',
          daily_thorn: reflectionMode === 'thorn',
          parent_id: stepLogId,
          parent_type: 'step_log',
        });
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('LogEntryForm save error:', error);
      Alert.alert('Error', (error as Error).message ?? 'Failed to save log entry.');
    } finally {
      setSaving(false);
    }
  }, [
    isPrimaryValid,
    primaryValue,
    durationMinutes,
    durationSeconds,
    timeHours,
    timeMinutes,
    booleanValue,
    ratingValue,
    coords,
    note,
    selectedDate,
    selectedRoleIds,
    selectedDomainIds,
    selectedKRIds,
    selectedGoalIds,
    reflectionMode,
    instance,
    userId,
    stepId,
    goals,
    onSaved,
    onClose,
  ]);

  const renderPrimaryField = () => {
    switch (instance.measurement_type) {
      case 'number':
      case 'currency':
      case 'percentage':
      case 'distance':
        return (
          <View style={styles.primaryRow}>
            <TextInput
              style={styles.primaryInput}
              value={primaryValue}
              onChangeText={setPrimaryValue}
              placeholder="0"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              autoFocus
            />
            <Text style={styles.primarySuffix}>
              {instance.measurement_type === 'currency'
                ? instance.currency_code ?? ''
                : instance.unit_label ??
                  (instance.measurement_type === 'percentage' ? '%' : '')}
            </Text>
          </View>
        );
      case 'hours':
        return (
          <View style={styles.primaryRow}>
            <TextInput
              style={styles.primaryInput}
              value={primaryValue}
              onChangeText={setPrimaryValue}
              placeholder="0.0"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.primarySuffix}>hrs</Text>
          </View>
        );
      case 'duration':
        return (
          <View style={styles.durationRow}>
            <View style={styles.durationCol}>
              <TextInput
                style={styles.durationInput}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.durationLabel}>Minutes</Text>
            </View>
            <View style={styles.durationCol}>
              <TextInput
                style={styles.durationInput}
                value={durationSeconds}
                onChangeText={setDurationSeconds}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={styles.durationLabel}>Seconds</Text>
            </View>
          </View>
        );
      case 'boolean':
        return (
          <View style={styles.booleanRow}>
            <Pressable
              onPress={() => setBooleanValue(true)}
              style={[styles.booleanTile, booleanValue === true && styles.booleanTileActive]}
            >
              <Text style={[styles.booleanText, booleanValue === true && styles.booleanTextActive]}>Yes</Text>
            </Pressable>
            <Pressable
              onPress={() => setBooleanValue(false)}
              style={[styles.booleanTile, booleanValue === false && styles.booleanTileActive]}
            >
              <Text style={[styles.booleanText, booleanValue === false && styles.booleanTextActive]}>No</Text>
            </Pressable>
          </View>
        );
      case 'rating':
        return (
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => setRatingValue(n)} hitSlop={8}>
                <Star
                  size={32}
                  color={WELLNESS_ACCENT}
                  fill={ratingValue !== null && n <= ratingValue ? WELLNESS_ACCENT : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
        );
      case 'text':
        return (
          <TextInput
            style={styles.textArea}
            value={primaryValue}
            onChangeText={setPrimaryValue}
            placeholder="Enter value..."
            placeholderTextColor="#9ca3af"
            multiline
            autoFocus
          />
        );
      case 'time_of_day':
        return (
          <View style={styles.durationRow}>
            <View style={styles.durationCol}>
              <TextInput
                style={styles.durationInput}
                value={timeHours}
                onChangeText={setTimeHours}
                placeholder="00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                maxLength={2}
                autoFocus
              />
              <Text style={styles.durationLabel}>HH</Text>
            </View>
            <View style={styles.durationCol}>
              <TextInput
                style={styles.durationInput}
                value={timeMinutes}
                onChangeText={setTimeMinutes}
                placeholder="00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.durationLabel}>MM</Text>
            </View>
          </View>
        );
      case 'coordinates':
        return (
          <View style={styles.coordsWrap}>
            <Pressable
              onPress={handleCaptureLocation}
              disabled={capturingLocation}
              style={[styles.coordsButton, capturingLocation && { opacity: 0.5 }]}
            >
              {capturingLocation ? (
                <ActivityIndicator size="small" color={WELLNESS_ACCENT} />
              ) : (
                <Text style={styles.coordsButtonText}>Use my current location</Text>
              )}
            </Pressable>
            {coords && (
              <Text style={styles.coordsValue}>
                📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            )}
          </View>
        );
      default:
        return (
          <Text style={styles.unsupportedText}>
            Unsupported measurement type: {instance.measurement_type}
          </Text>
        );
    }
  };

  const rolesCount = selectedRoleIds.length;
  const zonesCount = selectedDomainIds.length;
  const krsCount = selectedKRIds.length;
  const goalsCount = selectedGoalIds.length;

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Log {instance.display_name}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.primarySection}>{renderPrimaryField()}</View>

          <View style={styles.noteSection}>
            <Text style={styles.sectionLabel}>NOTE</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor="#9ca3af"
              multiline
            />
          </View>

          <View style={styles.dateRow}>
            <Calendar size={16} color="#6b7280" />
            <Text style={styles.dateText}>{selectedDate}</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} hitSlop={10}>
              <Pencil size={14} color={WELLNESS_ACCENT} />
            </TouchableOpacity>
          </View>

          <Pressable onPress={() => setContextOpen(o => !o)} style={styles.contextHeader}>
            <Text style={styles.contextHeaderText}>
              {contextOpen ? 'Hide context' : '+ Add context'}
            </Text>
          </Pressable>

          {contextOpen && (
            <View style={styles.contextSection}>
              <View style={styles.iconRow}>
                <IconButton
                  icon={<Users size={18} color={rolesCount > 0 ? WELLNESS_ACCENT : '#6b7280'} />}
                  label={rolesCount > 0 ? `Roles (${rolesCount})` : 'Roles'}
                  active={inlinePanel === 'roles'}
                  onPress={() => handleTogglePanel('roles')}
                />
                <IconButton
                  icon={<Heart size={18} color={zonesCount > 0 ? WELLNESS_ACCENT : '#6b7280'} />}
                  label={zonesCount > 0 ? `Zones (${zonesCount})` : 'Zones'}
                  active={inlinePanel === 'zones'}
                  onPress={() => handleTogglePanel('zones')}
                />
                <IconButton
                  icon={<UserCircle2 size={18} color={krsCount > 0 ? WELLNESS_ACCENT : '#6b7280'} />}
                  label={krsCount > 0 ? `KRs (${krsCount})` : 'KRs'}
                  active={inlinePanel === 'krs'}
                  onPress={() => handleTogglePanel('krs')}
                />
                <IconButton
                  icon={<Target size={18} color={goalsCount > 0 ? WELLNESS_ACCENT : '#6b7280'} />}
                  label={goalsCount > 0 ? `Goals (${goalsCount})` : 'Goals'}
                  active={inlinePanel === 'goals'}
                  onPress={() => handleTogglePanel('goals')}
                />
                <IconButton
                  icon={
                    <Heart
                      size={18}
                      color={reflectionMode !== 'none' ? WELLNESS_ACCENT : '#6b7280'}
                      fill={
                        reflectionMode === 'rose'
                          ? '#ec4899'
                          : reflectionMode === 'thorn'
                          ? '#dc2626'
                          : 'transparent'
                      }
                    />
                  }
                  label={
                    reflectionMode === 'rose'
                      ? 'Rose'
                      : reflectionMode === 'thorn'
                      ? 'Thorn'
                      : 'Rose/Thorn'
                  }
                  active={inlinePanel === 'reflection'}
                  onPress={() => handleTogglePanel('reflection')}
                />
                <IconButton
                  icon={<Camera size={18} color="#6b7280" />}
                  label="Photo"
                  active={false}
                  onPress={() => setPhotoNoteVisible(true)}
                  dimmed
                />
              </View>
              {photoNoteVisible && (
                <Text style={styles.comingSoonNote}>Photo attachments coming soon</Text>
              )}

              {inlinePanel === 'roles' && (
                <View style={styles.inlinePanel}>
                  <View style={chipWrapStyle}>
                    {roles.map(r => (
                      <EnrichmentChip
                        key={r.id}
                        label={r.label}
                        selected={selectedRoleIds.includes(r.id)}
                        onPress={() => setSelectedRoleIds(prev => toggle(prev, r.id))}
                        icon={
                          <Users
                            size={14}
                            color={
                              selectedRoleIds.includes(r.id)
                                ? ENRICHMENT_CHIP_COLORS.active
                                : ENRICHMENT_CHIP_COLORS.inactive
                            }
                          />
                        }
                      />
                    ))}
                  </View>
                </View>
              )}

              {inlinePanel === 'zones' && (
                <View style={styles.inlinePanel}>
                  <View style={chipWrapStyle}>
                    {domains.map(d => (
                      <EnrichmentChip
                        key={d.id}
                        label={d.name}
                        selected={selectedDomainIds.includes(d.id)}
                        onPress={() => setSelectedDomainIds(prev => toggle(prev, d.id))}
                        icon={
                          <Heart
                            size={14}
                            color={
                              selectedDomainIds.includes(d.id)
                                ? ENRICHMENT_CHIP_COLORS.active
                                : ENRICHMENT_CHIP_COLORS.inactive
                            }
                          />
                        }
                      />
                    ))}
                  </View>
                </View>
              )}

              {inlinePanel === 'krs' && (
                <View style={styles.inlinePanel}>
                  <View style={chipWrapStyle}>
                    {filteredKRs.length === 0 ? (
                      <Text style={styles.emptyPanelText}>
                        {selectedRoleIds.length > 0
                          ? 'No key relationships for selected roles'
                          : 'No key relationships yet'}
                      </Text>
                    ) : (
                      filteredKRs.map(kr => (
                        <EnrichmentChip
                          key={kr.id}
                          label={kr.name}
                          selected={selectedKRIds.includes(kr.id)}
                          onPress={() => setSelectedKRIds(prev => toggle(prev, kr.id))}
                          icon={
                            <UserCircle2
                              size={14}
                              color={
                                selectedKRIds.includes(kr.id)
                                  ? ENRICHMENT_CHIP_COLORS.active
                                  : ENRICHMENT_CHIP_COLORS.inactive
                              }
                            />
                          }
                        />
                      ))
                    )}
                  </View>
                </View>
              )}

              {inlinePanel === 'goals' && (
                <View style={styles.inlinePanel}>
                  {goals.length === 0 ? (
                    <Text style={styles.emptyPanelText}>No active goals</Text>
                  ) : (
                    <View style={chipWrapStyle}>
                      {goals.map(g => (
                        <EnrichmentChip
                          key={`${g.goal_type}-${g.id}`}
                          label={g.title}
                          selected={selectedGoalIds.includes(g.id)}
                          onPress={() => setSelectedGoalIds(prev => toggle(prev, g.id))}
                          icon={
                            <Target
                              size={14}
                              color={
                                selectedGoalIds.includes(g.id)
                                  ? ENRICHMENT_CHIP_COLORS.active
                                  : ENRICHMENT_CHIP_COLORS.inactive
                              }
                            />
                          }
                          subtitle={g.goal_type === 'twelve_wk_goal' ? '12wk' : 'Custom'}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {inlinePanel === 'reflection' && (
                <View style={styles.inlinePanel}>
                  <View style={styles.reflectionToggles}>
                    <Pressable
                      style={[
                        styles.reflectionTile,
                        reflectionMode === 'none' && styles.reflectionTileActive,
                      ]}
                      onPress={() => setReflectionMode('none')}
                    >
                      <Text
                        style={[
                          styles.reflectionText,
                          reflectionMode === 'none' && styles.reflectionTextActive,
                        ]}
                      >
                        None
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.reflectionTile,
                        reflectionMode === 'rose' && styles.reflectionTileRose,
                      ]}
                      onPress={() => setReflectionMode('rose')}
                    >
                      <Heart
                        size={14}
                        color={reflectionMode === 'rose' ? '#ffffff' : '#ec4899'}
                        fill={reflectionMode === 'rose' ? '#ffffff' : 'transparent'}
                      />
                      <Text
                        style={[
                          styles.reflectionText,
                          reflectionMode === 'rose' && styles.reflectionTextRose,
                        ]}
                      >
                        Rose
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.reflectionTile,
                        reflectionMode === 'thorn' && styles.reflectionTileThorn,
                      ]}
                      onPress={() => setReflectionMode('thorn')}
                    >
                      <Heart
                        size={14}
                        color={reflectionMode === 'thorn' ? '#ffffff' : '#dc2626'}
                        fill={reflectionMode === 'thorn' ? '#ffffff' : 'transparent'}
                      />
                      <Text
                        style={[
                          styles.reflectionText,
                          reflectionMode === 'thorn' && styles.reflectionTextThorn,
                        ]}
                      >
                        Thorn
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!isPrimaryValid || saving}
            style={[styles.saveButton, (!isPrimaryValid || saving) && { opacity: 0.5 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Check size={18} color="#ffffff" />
                <Text style={styles.saveButtonText}>Save Log</Text>
              </>
            )}
          </Pressable>
        </View>

        <DateTimePickerModal
          visible={showDatePicker}
          mode="task"
          initialDate={parseLocalDate(selectedDate)}
          onConfirm={(newDate) => {
            setSelectedDate(formatLocalDate(newDate));
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      </View>
    </Modal>
  );
}

function IconButton({
  icon,
  label,
  active,
  onPress,
  dimmed,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  dimmed?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.iconButton,
        active && { borderColor: WELLNESS_ACCENT, borderWidth: 1.5 },
        dimmed && { opacity: 0.4 },
      ]}
    >
      <View style={styles.iconButtonIcon}>{icon}</View>
      <Text
        style={[styles.iconButtonLabel, active && { color: WELLNESS_ACCENT }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16 },

  primarySection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  primaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  primaryInput: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1e3a5f',
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  primarySuffix: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  durationRow: { flexDirection: 'row', gap: 24 },
  durationCol: { alignItems: 'center', gap: 4 },
  durationInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e3a5f',
    minWidth: 60,
    textAlign: 'center',
    padding: 0,
  },
  durationLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500', letterSpacing: 0.5 },
  booleanRow: { flexDirection: 'row', gap: 12 },
  booleanTile: {
    width: 80,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  booleanTileActive: {
    borderColor: WELLNESS_ACCENT,
    borderWidth: 1.5,
    backgroundColor: WELLNESS_ACCENT + '15',
  },
  booleanText: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  booleanTextActive: { color: WELLNESS_ACCENT },
  ratingRow: { flexDirection: 'row', gap: 8 },
  textArea: {
    width: '100%',
    minHeight: 80,
    fontSize: 15,
    color: '#1f2937',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  coordsWrap: { alignItems: 'center', gap: 8 },
  coordsButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WELLNESS_ACCENT,
    backgroundColor: '#ffffff',
  },
  coordsButtonText: { fontSize: 14, fontWeight: '600', color: WELLNESS_ACCENT },
  coordsValue: { fontSize: 13, color: '#1f2937' },
  unsupportedText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },

  noteSection: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#6b7280',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1f2937',
    minHeight: 60,
    backgroundColor: '#ffffff',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  dateText: { flex: 1, fontSize: 14, color: '#1f2937', fontWeight: '500' },

  contextHeader: { alignSelf: 'flex-start', paddingVertical: 6 },
  contextHeaderText: { fontSize: 13, fontWeight: '600', color: WELLNESS_ACCENT },
  contextSection: { gap: 12 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
  },
  iconButtonIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  comingSoonNote: { fontSize: 11, fontStyle: 'italic', color: '#9ca3af' },
  inlinePanel: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  emptyPanelText: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },

  reflectionToggles: { flexDirection: 'row', gap: 8 },
  reflectionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  reflectionTileActive: {
    borderColor: '#1e3a5f',
    borderWidth: 1.5,
    backgroundColor: '#f0f4f9',
  },
  reflectionTileRose: {
    borderColor: '#ec4899',
    borderWidth: 1.5,
    backgroundColor: '#ec4899',
  },
  reflectionTileThorn: {
    borderColor: '#dc2626',
    borderWidth: 1.5,
    backgroundColor: '#dc2626',
  },
  reflectionText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  reflectionTextActive: { color: '#1e3a5f' },
  reflectionTextRose: { color: '#ffffff' },
  reflectionTextThorn: { color: '#ffffff' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: WELLNESS_ACCENT,
  },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
