import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * ToolTileGrid — Minimalist Executive design system
 * 3-column grid of tool tiles with a show-more expander when the
 * total tile count exceeds maxVisible.
 */

export interface ToolTile {
  id: string;
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
}

export interface ToolTileGridProps {
  tools: ToolTile[];
  maxVisible?: number;
  accentColor: string;
}

export function ToolTileGrid({
  tools,
  maxVisible = 6,
  accentColor,
}: ToolTileGridProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = tools.length > maxVisible;
  const visibleTools =
    expanded || !hasOverflow ? tools : tools.slice(0, maxVisible);
  const hiddenCount = tools.length - maxVisible;

  return (
    <View>
      <View style={styles.grid}>
        {visibleTools.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={tool.onPress}
            style={({ pressed }) => [
              styles.tile,
              pressed && {
                borderColor: accentColor,
                borderWidth: 1.5,
              },
            ]}
          >
            <View style={styles.iconWrap}>{tool.icon}</View>
            <Text style={styles.title} numberOfLines={2}>
              {tool.title}
            </Text>
          </Pressable>
        ))}
      </View>
      {hasOverflow ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={styles.expander}
        >
          <Text style={[styles.expanderText, { color: accentColor }]}>
            {expanded
              ? 'Show fewer tools'
              : `Show ${hiddenCount} more tool${hiddenCount === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '31.5%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 16,
  },
  expander: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  expanderText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
