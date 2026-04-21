import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getStatusPipColor } from './StatusPip';

/**
 * KRTile — Minimalist Executive design system
 * Key-relationship person tile showing avatar, name, relationship
 * type, and a recency badge driven by StatusPip logic.
 */

export interface KRTileProps {
  name: string;
  relationshipType: string;
  lastInteractionDate: string | null;
  imageUri?: string | null;
  onPress: () => void;
}

const AVATAR_PALETTE = [
  '#7c3aed',
  '#16a34a',
  '#d97706',
  '#0891b2',
  '#db2777',
  '#4f46e5',
  '#dc2626',
  '#059669',
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (parts.length === 1 ? first : first + last).toUpperCase();
}

function recencyLabel(lastInteractionDate: string | null): string {
  if (!lastInteractionDate) return 'No contact';
  const then = new Date(lastInteractionDate);
  if (Number.isNaN(then.getTime())) return 'No contact';
  const daysSince = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (daysSince <= 0) return 'Today';
  if (daysSince === 1) return 'Yesterday';
  return `${daysSince} days ago`;
}

export function KRTile({
  name,
  relationshipType,
  lastInteractionDate,
  imageUri,
  onPress,
}: KRTileProps) {
  const avatarColor = pickAvatarColor(name);
  const initials = initialsFrom(name);
  const pipColor = getStatusPipColor(lastInteractionDate);
  const label = recencyLabel(lastInteractionDate);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && { borderColor: '#1e3a5f', borderWidth: 1.5 },
      ]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.typeTag}>
          <Text style={styles.typeTagText} numberOfLines={1}>
            {relationshipType}
          </Text>
        </View>
      </View>
      <View style={styles.badge}>
        <View style={[styles.badgeDot, { backgroundColor: pipColor }]} />
        <Text style={[styles.badgeText, { color: pipColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  typeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  typeTagText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#ffffff',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
