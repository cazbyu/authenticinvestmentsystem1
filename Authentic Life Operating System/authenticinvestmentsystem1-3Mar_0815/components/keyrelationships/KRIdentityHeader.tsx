import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { VisionBlock } from '@/components/common/VisionBlock';

/**
 * KRIdentityHeader — R-6-components-A sibling of components/roles/RoleIdentityHeader.tsx,
 * intentionally simplified per audit v2 Q1 lock (Vision-only, no Power Q box).
 *
 * Identity card for a KR-detail page. Composes:
 *   - avatar (image if present, else colored initials circle tinted with accent)
 *   - KR name
 *   - subtitle: "Key Relationship in {parentRoleName}"
 *   - vision_statement VisionBlock (inline-edit, persists via onVisionUpdate callback)
 *
 * Per audit v2 Q1: NO Power Question box in the header. Power Q content lives
 * in the KRToolshed Power Q Journal tile (R-6-components-C placeholder).
 *
 * Future archaeology: Role IdentityHeader currently uses two-box pattern
 * (Vision + Power Q with internal Supabase writes). KR side establishes the
 * cleaner pattern that Role side may migrate to in a future commit:
 *   1. Single Vision box (Power Q content moves to its own surface)
 *   2. Parent-owned write via callback (this component is fully presentational)
 *
 * Avatar pattern: tinted circle with initials when no image. Avoids the slug-keyed
 * RoleIcon system since KRs don't have per-KR icon mappings; matches existing
 * KRTile component's avatar pattern but uses the parent role's accent color
 * for the background tint (per Q6 lock: KRs inherit parent role accent color).
 */

export interface KRIdentityHeaderProps {
  name: string | null;
  vision: string | null;
  imageUrl?: string | null;
  parentRoleName?: string | null;
  accentColor: string;
  onVisionUpdate: (vision: string) => Promise<void>;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function initialsFrom(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (parts.length === 1 ? first : first + last).toUpperCase();
}

export function KRIdentityHeader({
  name,
  vision,
  imageUrl,
  parentRoleName,
  accentColor,
  onVisionUpdate,
}: KRIdentityHeaderProps) {
  const { colors } = useTheme();

  const handleSaveVision = (text: string) => {
    // VisionBlock.onSave is synchronous void; convert to fire-and-forget promise
    // with internal error logging. Mirrors RoleIdentityHeader's handleSaveField pattern.
    onVisionUpdate(text).catch((err) => {
      console.error('[KRIdentityHeader] failed to save vision:', err);
    });
  };

  const subtitle = parentRoleName
    ? `Key Relationship in ${parentRoleName}`
    : 'Key Relationship';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
        ) : (
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: hexToRgba(accentColor, 0.15) },
            ]}
          >
            <Text style={[styles.avatarInitials, { color: accentColor }]}>
              {initialsFrom(name)}
            </Text>
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {name ?? '(unnamed)'}
          </Text>
          <Text
            style={[styles.meta, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.blockWrap}>
        <VisionBlock
          label="Vision"
          value={vision}
          placeholder="What does thriving in this relationship look like?"
          accentColor={accentColor}
          onSave={handleSaveVision}
        />
      </View>

      {/* Per audit v2 Q1: NO Power Question box here. Lives in
          KRToolshed Power Q Journal tile (R-6-components-C). */}
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
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '600',
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
