import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import type { BrainDumpTriageItem, TriageAction } from '@/lib/morningSparkV2Service';

interface BrainDumpTriageStepProps {
  items: BrainDumpTriageItem[];
  triageDecisions: Map<string, TriageAction>;
  onTriageDecision: (itemId: string, action: TriageAction) => void;
}

const ACTION_OPTIONS: { action: TriageAction; label: string; emoji: string; color: string }[] = [
  { action: 'add_task', label: 'Add Task', emoji: '\u{1F4CB}', color: '#3B82F6' },
  { action: 'deposit_idea', label: 'Deposit Idea', emoji: '\u{1F4A1}', color: '#F59E0B' },
  { action: 'journal_follow_up', label: 'Follow Up', emoji: '\u{1F4C5}', color: '#8B5CF6' },
  { action: 'keep_journal', label: 'Keep in Journal', emoji: '\u{1F4D3}', color: '#6B7280' },
];

function getSourceBadge(source: BrainDumpTriageItem['source']): string {
  return source === 'brain_dump' ? '\u{1F9E0} Brain Dump' : '\u{1F4C5} Follow Up';
}

export default function BrainDumpTriageStep({
  items,
  triageDecisions,
  onTriageDecision,
}: BrainDumpTriageStepProps) {
  const { colors } = useTheme();

  function handleAction(itemId: string, action: TriageAction) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onTriageDecision(itemId, action);
  }

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: '#ECFDF5' }]}>
        <Text style={styles.emptyIcon}>{'\u2705'}</Text>
        <Text style={[styles.emptyTitle, { color: '#065F46' }]}>
          Your mind is clear!
        </Text>
        <Text style={[styles.emptySubtext, { color: '#047857' }]}>
          Nothing to triage.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.header, { color: colors.text }]}>
        {'\u{1F9E0}'} Based on yesterday's thoughts...
      </Text>
      <Text style={[styles.subtext, { color: colors.textSecondary }]}>
        You have {items.length} item{items.length !== 1 ? 's' : ''} to process
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => {
          const selectedAction = triageDecisions.get(item.id);

          return (
            <View
              key={item.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.itemContent, { color: colors.text }]} numberOfLines={3}>
                  {item.content}
                </Text>
                <View style={[styles.sourceBadge, { backgroundColor: colors.background }]}>
                  <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
                    {getSourceBadge(item.source)}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsGrid}>
                {ACTION_OPTIONS.map((option) => {
                  const isSelected = selectedAction === option.action;

                  return (
                    <TouchableOpacity
                      key={option.action}
                      style={[
                        styles.actionButton,
                        isSelected
                          ? { backgroundColor: option.color, borderColor: option.color }
                          : { backgroundColor: 'transparent', borderColor: colors.border },
                      ]}
                      onPress={() => handleAction(item.id, option.action)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionEmoji}>{option.emoji}</Text>
                      <Text
                        style={[
                          styles.actionLabel,
                          { color: isSelected ? '#FFFFFF' : colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 14,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    gap: 8,
  },
  itemContent: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
    minWidth: '45%' as unknown as number,
    flexGrow: 1,
  },
  actionEmoji: {
    fontSize: 16,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    padding: 32,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '500',
  },
});
