import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Lightbulb, User, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { DepositIdea } from '@/lib/sparkUtils';

interface DepositIdeaCardProps {
  idea: DepositIdea & { roleNames?: string[]; domainNames?: string[] };
  viewMode: 'role' | 'zone';
  onActivate: (idea: DepositIdea) => void;
  disabled?: boolean;
}

export function DepositIdeaCard({
  idea,
  viewMode,
  onActivate,
  disabled = false,
}: DepositIdeaCardProps) {
  const { colors, isDarkMode } = useTheme();

  function handlePress() {
    if (disabled) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onActivate(idea);
  }

  function formatDaysAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }

  const tags = viewMode === 'role' ? idea.roleNames : idea.domainNames;
  const hasValidTags = tags && tags.length > 0 && tags[0] !== null && tags[0] !== undefined;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isDarkMode ? '#F59E0B20' : '#F59E0B10' },
          ]}
        >
          <Lightbulb size={20} color="#F59E0B" />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {idea.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {formatDaysAgo(idea.created_at)}
          </Text>

          {hasValidTags && (
            <>
              <Text style={[styles.separator, { color: colors.textSecondary }]}>
                •
              </Text>
              <View style={styles.tagsContainer}>
                {viewMode === 'role' ? (
                  <User size={12} color={colors.textSecondary} />
                ) : (
                  <Heart size={12} color={colors.textSecondary} />
                )}
                <Text
                  style={[styles.tagText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {tags!.slice(0, 2).join(', ')}
                  {tags!.length > 2 && ` +${tags!.length - 2}`}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View
        style={[
          styles.pointsBadge,
          { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' },
        ]}
      >
        <Text style={[styles.pointsText, { color: '#10B981' }]}>+5</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 13,
    fontWeight: '500',
  },
  separator: {
    fontSize: 13,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
