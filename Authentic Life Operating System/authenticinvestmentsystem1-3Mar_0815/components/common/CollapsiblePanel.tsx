import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Plus, X } from 'lucide-react-native';

/**
 * CollapsiblePanel — Minimalist Executive design system
 * A tile that expands its content inline when opened. Parent
 * controls isOpen so a containing grid can enforce one-open-at-a-time.
 */

export interface CollapsiblePanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accentColor: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function CollapsiblePanel({
  title,
  icon,
  children,
  accentColor,
  isOpen,
  onToggle,
}: CollapsiblePanelProps) {
  return (
    <View
      style={[
        styles.container,
        { borderColor: accentColor, borderWidth: isOpen ? 1.5 : 1 },
      ]}
    >
      <Pressable onPress={onToggle} style={styles.header}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text
          style={[
            styles.title,
            isOpen && { color: accentColor, fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {isOpen ? (
          <X size={18} color={accentColor} strokeWidth={2.5} />
        ) : (
          <Plus size={18} color={accentColor} strokeWidth={2.5} />
        )}
      </Pressable>
      {isOpen ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  iconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
    width: 16,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
