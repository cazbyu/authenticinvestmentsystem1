import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleIcon } from '@/components/icons/RoleIcon';
import { VisionBlock } from '@/components/common/VisionBlock';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

/**
 * RoleIdentityHeader — R-2 sibling of components/wellness/ZoneIdentityHeader.tsx.
 *
 * Identity card for a role-detail page. Composes:
 *   - tinted role icon circle (uses role.color as accent)
 *   - role label
 *   - meta line: "Active role · N key relationship(s)"
 *   - vision_statement VisionBlock (inline-edit, persists to 0008-ap-roles)
 *   - power_question_answer VisionBlock (inline-edit, persists to 0008-ap-roles)
 *
 * Per audit §1.1: nothing else below the Power Question — no chip, no
 * placeholder.
 *
 * Per-role glyph via @/components/icons/RoleIcon (the slug-keyed component
 * the hub uses), with fallback chain role.icon || role.label. NOT the
 * generic glyph at @/components/icons/CustomIcons.
 *
 * DB writes go directly to 0008-ap-roles via getSupabaseClient(). The
 * existing roles.tsx updateRoleField helper does the same write — when
 * R-5 mounts this component and removes the inline VisionBlocks at
 * roles.tsx:1701-1754, this component becomes the sole write path.
 *
 * onUpdate is an optional callback fired after a successful write so
 * the parent can refresh local state (e.g. fetchRoles() to pick up the
 * new vision_statement).
 */

export interface RoleIdentityHeaderRole {
  id: string;
  label: string;
  color: string;
  icon?: string;
  vision_statement: string | null;
  power_question_answer: string | null;
}

export interface RoleIdentityHeaderProps {
  role: RoleIdentityHeaderRole;
  keyRelationshipsCount: number;
  onUpdate?: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function RoleIdentityHeader({
  role,
  keyRelationshipsCount,
  onUpdate,
}: RoleIdentityHeaderProps) {
  const { colors } = useTheme();

  const handleSaveField = async (
    field: 'vision_statement' | 'power_question_answer',
    value: string,
  ) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-roles')
        .update({ [field]: value, updated_at: toLocalISOString(new Date()) })
        .eq('id', role.id);
      if (error) throw error;
      onUpdate?.();
    } catch (err) {
      console.error(`[RoleIdentityHeader] failed to save ${field}:`, err);
    }
  };

  const krLabel =
    keyRelationshipsCount === 1
      ? '1 key relationship'
      : `${keyRelationshipsCount} key relationships`;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: hexToRgba(role.color, 0.15) },
          ]}
        >
          <RoleIcon name={role.icon || role.label} color={role.color} size={28} />
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {role.label}
          </Text>
          <Text
            style={[styles.meta, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Active role · {krLabel}
          </Text>
        </View>
      </View>

      <View style={styles.blockWrap}>
        <VisionBlock
          label="Vision for this role"
          value={role.vision_statement}
          placeholder="Tap to write your vision for this role"
          accentColor={role.color}
          onSave={(text) => handleSaveField('vision_statement', text)}
        />
      </View>

      <View style={styles.blockWrap}>
        <VisionBlock
          label="Power Question"
          value={role.power_question_answer}
          placeholder="Tap to answer this role's power question"
          accentColor={role.color}
          onSave={(text) => handleSaveField('power_question_answer', text)}
        />
      </View>

      {/* Per audit §1.1: nothing else below the Power Question. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  blockWrap: {
    // VisionBlock has its own padding/border; just provides spacing in the card
  },
});
