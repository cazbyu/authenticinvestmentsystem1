/**
 * TaskReconciliationCard — Evening Review task card with "dresser drawer" UI.
 *
 * Shows: Done ✓ button + dresser icon with 3 collapsible drawers:
 *   1. Wellness Zones — toggle on/off for 8 zones
 *   2. Roles — toggle on/off with KRs shown beside linked roles
 *   3. Reflections — text input for reflection + Rose/Thorn/Deposit Idea sub-inputs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import { useTheme } from '@/contexts/ThemeContext';

// ============ Types ============

interface RoleWithKRs {
  id: string;
  label: string;
  keyRelationships: Array<{ id: string; name: string }>;
}

interface DomainItem {
  id: string;
  name: string;
}

interface Props {
  task: {
    id: string;
    title: string;
    status: string;
    roles: Array<{ id: string; label: string }>;
    domains: Array<{ id: string; label: string }>;
    goal_title: string | null;
  };
  userId: string;
  isDone: boolean;
  onToggleDone: (taskId: string) => void;
  allRoles: RoleWithKRs[];
  allDomains: DomainItem[];
}

// ============ Component ============

export default function TaskReconciliationCard({
  task,
  userId,
  isDone,
  onToggleDone,
  allRoles,
  allDomains,
}: Props) {
  const { colors } = useTheme();

  // Drawer state
  const [openDrawer, setOpenDrawer] = useState<'wz' | 'roles' | 'reflections' | null>(null);

  // WZ state — initialized from task's current domains
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(
    new Set(task.domains.map((d) => d.id)),
  );
  const [wzDirty, setWzDirty] = useState(false);
  const [wzSaving, setWzSaving] = useState(false);

  // Role state — initialized from task's current roles
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set(task.roles.map((r) => r.id)),
  );
  const [roleDirty, setRoleDirty] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);

  // Reflection state
  const [reflectionText, setReflectionText] = useState('');
  const [roseTexts, setRoseTexts] = useState<string[]>([]);
  const [thornTexts, setThornTexts] = useState<string[]>([]);
  const [depositTexts, setDepositTexts] = useState<string[]>([]);
  const [reflectionSaving, setReflectionSaving] = useState(false);

  // ---- Drawer toggle ----
  const toggleDrawer = (drawer: 'wz' | 'roles' | 'reflections') => {
    setOpenDrawer((prev) => (prev === drawer ? null : drawer));
  };

  // ---- WZ toggle ----
  const toggleDomain = (domainId: string) => {
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
    setWzDirty(true);
  };

  const saveWZChanges = async () => {
    setWzSaving(true);
    try {
      const supabase = getSupabaseClient();
      // Delete existing domain joins for this task
      await supabase
        .from('0008-ap-universal-domains-join')
        .delete()
        .eq('parent_id', task.id)
        .eq('parent_type', 'task');

      // Insert new ones
      if (selectedDomainIds.size > 0) {
        const joins = Array.from(selectedDomainIds).map((domainId) => ({
          parent_id: task.id,
          parent_type: 'task',
          domain_id: domainId,
        }));
        await supabase.from('0008-ap-universal-domains-join').insert(joins);
      }

      setWzDirty(false);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to save WZ changes:', err);
    } finally {
      setWzSaving(false);
    }
  };

  // ---- Role toggle ----
  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
    setRoleDirty(true);
  };

  const saveRoleChanges = async () => {
    setRoleSaving(true);
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('0008-ap-universal-roles-join')
        .delete()
        .eq('parent_id', task.id)
        .eq('parent_type', 'task');

      if (selectedRoleIds.size > 0) {
        const joins = Array.from(selectedRoleIds).map((roleId) => ({
          parent_id: task.id,
          parent_type: 'task',
          role_id: roleId,
        }));
        await supabase.from('0008-ap-universal-roles-join').insert(joins);
      }

      setRoleDirty(false);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to save role changes:', err);
    } finally {
      setRoleSaving(false);
    }
  };

  // ---- Reflection save ----
  const saveReflection = async (content: string, type: 'reflection' | 'rose' | 'thorn') => {
    if (!content.trim()) return;
    setReflectionSaving(true);
    try {
      const supabase = getSupabaseClient();
      const todayStr = toLocalISOString(new Date()).split('T')[0];

      const { data: inserted, error } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          content: content.trim(),
          reflection_type: 'daily',
          date: todayStr,
          parent_id: task.id,
          parent_type: 'task',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Copy task's role/domain joins to the reflection
      if (selectedRoleIds.size > 0) {
        const roleJoins = Array.from(selectedRoleIds).map((roleId) => ({
          parent_id: inserted.id,
          parent_type: 'reflection',
          role_id: roleId,
        }));
        await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
      }
      if (selectedDomainIds.size > 0) {
        const domainJoins = Array.from(selectedDomainIds).map((domainId) => ({
          parent_id: inserted.id,
          parent_type: 'reflection',
          domain_id: domainId,
        }));
        await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
      }

      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error(`Failed to save ${type}:`, err);
    } finally {
      setReflectionSaving(false);
    }
  };

  const saveDepositIdea = async (content: string) => {
    if (!content.trim()) return;
    setReflectionSaving(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.from('0008-ap-deposit-ideas').insert({
        title: content.trim(),
        user_id: userId,
      });
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Failed to save deposit idea:', err);
    } finally {
      setReflectionSaving(false);
    }
  };

  // ---- Render ----
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isDone ? '#4CAF50' : colors.border,
          borderWidth: isDone ? 2 : 1,
        },
      ]}
    >
      {/* Top row: Done + Title + pills */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: isDone ? '#4CAF50' : 'transparent', borderColor: '#4CAF50' }]}
          onPress={() => onToggleDone(task.id)}
        >
          <Text style={{ color: isDone ? '#FFF' : '#4CAF50', fontSize: 13, fontWeight: '600' }}>
            {isDone ? 'Done ✓' : 'Done'}
          </Text>
        </TouchableOpacity>

        <View style={styles.titlePillArea}>
          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={styles.pillRow}>
            {task.goal_title && (
              <View style={[styles.pill, { backgroundColor: '#dbeafe' }]}>
                <Text style={[styles.pillText, { color: '#1d4ed8' }]} numberOfLines={1}>{task.goal_title}</Text>
              </View>
            )}
            {task.roles.slice(0, 2).map((r) => (
              <View key={r.id} style={[styles.pill, { backgroundColor: '#fce7f3' }]}>
                <Text style={[styles.pillText, { color: '#9333ea' }]} numberOfLines={1}>{r.label}</Text>
              </View>
            ))}
            {task.roles.length > 2 && (
              <View style={[styles.pill, { backgroundColor: '#fce7f3' }]}>
                <Text style={[styles.pillText, { color: '#9333ea' }]}>+{task.roles.length - 2}</Text>
              </View>
            )}
            {task.domains.slice(0, 2).map((d) => (
              <View key={d.id} style={[styles.pill, { backgroundColor: '#fed7aa' }]}>
                <Text style={[styles.pillText, { color: '#c2410c' }]} numberOfLines={1}>{d.label}</Text>
              </View>
            ))}
            {task.domains.length > 2 && (
              <View style={[styles.pill, { backgroundColor: '#fed7aa' }]}>
                <Text style={[styles.pillText, { color: '#c2410c' }]}>+{task.domains.length - 2}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Dresser drawers */}
      <View style={[styles.dresser, { borderColor: colors.border }]}>
        {/* WZ Drawer */}
        <TouchableOpacity
          style={[styles.drawerTab, { borderBottomColor: openDrawer === 'wz' ? '#39b54a' : colors.border }]}
          onPress={() => toggleDrawer('wz')}
        >
          <Text style={[styles.drawerTabText, { color: openDrawer === 'wz' ? '#39b54a' : colors.textSecondary }]}>
            🌿 Wellness Zones
          </Text>
        </TouchableOpacity>
        {openDrawer === 'wz' && (
          <View style={styles.drawerContent}>
            <View style={styles.toggleGrid}>
              {allDomains.map((d) => {
                const isActive = selectedDomainIds.has(d.id);
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.toggleChip,
                      {
                        backgroundColor: isActive ? '#dcfce7' : colors.background,
                        borderColor: isActive ? '#39b54a' : colors.border,
                      },
                    ]}
                    onPress={() => toggleDomain(d.id)}
                  >
                    <Text style={{ color: isActive ? '#166534' : colors.textSecondary, fontSize: 13, fontWeight: isActive ? '600' : '400' }}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {wzDirty && (
              <TouchableOpacity style={styles.saveButton} onPress={saveWZChanges} disabled={wzSaving}>
                {wzSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Roles Drawer */}
        <TouchableOpacity
          style={[styles.drawerTab, { borderBottomColor: openDrawer === 'roles' ? '#9370DB' : colors.border }]}
          onPress={() => toggleDrawer('roles')}
        >
          <Text style={[styles.drawerTabText, { color: openDrawer === 'roles' ? '#9370DB' : colors.textSecondary }]}>
            👥 Roles
          </Text>
        </TouchableOpacity>
        {openDrawer === 'roles' && (
          <View style={styles.drawerContent}>
            {allRoles.map((role) => {
              const isActive = selectedRoleIds.has(role.id);
              return (
                <View key={role.id} style={styles.roleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleChip,
                      {
                        backgroundColor: isActive ? '#f3e8ff' : colors.background,
                        borderColor: isActive ? '#9370DB' : colors.border,
                        flex: 1,
                      },
                    ]}
                    onPress={() => toggleRole(role.id)}
                  >
                    <Text style={{ color: isActive ? '#7c3aed' : colors.textSecondary, fontSize: 13, fontWeight: isActive ? '600' : '400' }}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                  {role.keyRelationships.length > 0 && (
                    <View style={styles.krList}>
                      {role.keyRelationships.map((kr) => (
                        <View key={kr.id} style={[styles.krChip, { backgroundColor: '#e0f2fe' }]}>
                          <Text style={{ fontSize: 11, color: '#0369a1' }}>{kr.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {roleDirty && (
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#9370DB' }]} onPress={saveRoleChanges} disabled={roleSaving}>
                {roleSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Reflections Drawer */}
        <TouchableOpacity
          style={[styles.drawerTab, { borderBottomColor: openDrawer === 'reflections' ? '#4169E1' : colors.border }]}
          onPress={() => toggleDrawer('reflections')}
        >
          <Text style={[styles.drawerTabText, { color: openDrawer === 'reflections' ? '#4169E1' : colors.textSecondary }]}>
            💭 Reflections
          </Text>
        </TouchableOpacity>
        {openDrawer === 'reflections' && (
          <View style={styles.drawerContent}>
            {/* General reflection */}
            <Text style={[styles.reflectionLabel, { color: colors.text }]}>Reflection</Text>
            <TextInput
              style={[styles.reflectionInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="What did you learn or notice?"
              placeholderTextColor={colors.textSecondary}
              value={reflectionText}
              onChangeText={setReflectionText}
              multiline
            />
            {reflectionText.trim() && (
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: '#4169E1', marginBottom: 12 }]}
                onPress={async () => {
                  await saveReflection(reflectionText, 'reflection');
                  setReflectionText('');
                }}
                disabled={reflectionSaving}
              >
                <Text style={styles.saveButtonText}>Save Reflection</Text>
              </TouchableOpacity>
            )}

            {/* Rose inputs */}
            <Text style={[styles.reflectionLabel, { color: '#e11d48' }]}>🌹 Roses (wins, gratitude)</Text>
            {roseTexts.map((text, i) => (
              <TextInput
                key={`rose-${i}`}
                style={[styles.reflectionInput, { backgroundColor: '#fff1f2', color: colors.text, borderColor: '#fecdd3', marginBottom: 6 }]}
                placeholder="A win or something you're grateful for..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={(v) => {
                  const next = [...roseTexts];
                  next[i] = v;
                  setRoseTexts(next);
                }}
                multiline
                onBlur={() => {
                  if (text.trim()) saveReflection(text, 'rose');
                }}
              />
            ))}
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => setRoseTexts([...roseTexts, ''])}
            >
              <Text style={[styles.addMoreText, { color: '#e11d48' }]}>+ Add Rose</Text>
            </TouchableOpacity>

            {/* Thorn inputs */}
            <Text style={[styles.reflectionLabel, { color: '#c2410c', marginTop: 8 }]}>🌵 Thorns (challenges)</Text>
            {thornTexts.map((text, i) => (
              <TextInput
                key={`thorn-${i}`}
                style={[styles.reflectionInput, { backgroundColor: '#fff7ed', color: colors.text, borderColor: '#fed7aa', marginBottom: 6 }]}
                placeholder="A challenge or frustration..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={(v) => {
                  const next = [...thornTexts];
                  next[i] = v;
                  setThornTexts(next);
                }}
                multiline
                onBlur={() => {
                  if (text.trim()) saveReflection(text, 'thorn');
                }}
              />
            ))}
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => setThornTexts([...thornTexts, ''])}
            >
              <Text style={[styles.addMoreText, { color: '#c2410c' }]}>+ Add Thorn</Text>
            </TouchableOpacity>

            {/* Deposit Idea inputs */}
            <Text style={[styles.reflectionLabel, { color: '#0369a1', marginTop: 8 }]}>💡 Deposit Ideas</Text>
            {depositTexts.map((text, i) => (
              <TextInput
                key={`deposit-${i}`}
                style={[styles.reflectionInput, { backgroundColor: '#f0f9ff', color: colors.text, borderColor: '#bae6fd', marginBottom: 6 }]}
                placeholder="An idea to explore later..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={(v) => {
                  const next = [...depositTexts];
                  next[i] = v;
                  setDepositTexts(next);
                }}
                multiline
                onBlur={() => {
                  if (text.trim()) saveDepositIdea(text);
                }}
              />
            ))}
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => setDepositTexts([...depositTexts, ''])}
            >
              <Text style={[styles.addMoreText, { color: '#0369a1' }]}>+ Add Deposit Idea</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ============ Styles ============

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  titlePillArea: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  dresser: {
    borderTopWidth: 1,
  },
  drawerTab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
  },
  drawerTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  drawerContent: {
    padding: 12,
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  krList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  krChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: '#39b54a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reflectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  reflectionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  addMoreButton: {
    paddingVertical: 6,
  },
  addMoreText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
