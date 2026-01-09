import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface FollowUpItem {
  id: string;
  user_id: string;
  parent_type: string;
  parent_id: string;
  follow_up_date: string;
  title: string;
  completed_at?: string;
  archived: boolean;
}

interface FollowUpSectionProps {
  followUpItems: FollowUpItem[];
  colors: any;
  loadingFollowUp: boolean;
  handleCompleteFollowUp: (item: FollowUpItem) => void;
  handleSnoozeFollowUp: (item: FollowUpItem) => void;
}

export function FollowUpSection({
  followUpItems,
  colors,
  loadingFollowUp,
  handleCompleteFollowUp,
  handleSnoozeFollowUp,
}: FollowUpSectionProps) {
  const [showFollowUp, setShowFollowUp] = useState(false);

  if (followUpItems.length === 0 && !loadingFollowUp) return null;

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'task': return '✓';
      case 'event': return '📅';
      case 'depositIdea': return '💡';
      case 'reflection': return '💭';
      case 'goal_12wk':
      case 'goal_1y':
      case 'goal_custom':
        return '🎯';
      default: return '📌';
    }
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowFollowUp(!showFollowUp)}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            🔔 Follow Up
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            ({followUpItems.length})
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showFollowUp ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showFollowUp && (
        <>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
            Items you flagged for follow-up today
          </Text>

          {loadingFollowUp ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : followUpItems.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                All clear! No follow-ups for today.
              </Text>
            </View>
          ) : (
            <View style={[styles.followUpContainer, { backgroundColor: colors.surface }]}>
              {followUpItems.map((item) => (
                <View key={item.id} style={[styles.followUpItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.followUpHeader}>
                    <View style={styles.followUpFlag}>
                      <Text style={styles.followUpFlagEmoji}>{getTypeEmoji(item.parent_type)}</Text>
                      <Text style={[styles.followUpType, { color: colors.textSecondary }]}>
                        {item.parent_type.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.followUpTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <View style={styles.followUpActions}>
                    <TouchableOpacity
                      style={[styles.followUpButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleCompleteFollowUp(item)}
                    >
                      <Text style={[styles.followUpButtonText, { color: '#FFFFFF' }]}>
                        Done
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.followUpButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => handleSnoozeFollowUp(item)}
                    >
                      <Text style={[styles.followUpButtonText, { color: colors.text }]}>
                        Tomorrow
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsibleCount: {
    fontSize: 14,
    fontWeight: '400',
  },
  collapsibleIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  followUpContainer: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  followUpItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followUpFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpFlagEmoji: {
    fontSize: 16,
  },
  followUpType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followUpTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  followUpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  followUpButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  followUpButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});