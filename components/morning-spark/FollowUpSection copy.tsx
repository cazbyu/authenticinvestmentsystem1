import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface FollowUpItem {
  id: string;
  title: string;
  parent_type: string;
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

  const getItemTypeLabel = (parentType: string): string => {
    if (parentType === 'task') return 'Task';
    if (parentType === 'event') return 'Event';
    if (parentType === 'depositIdea') return 'Idea';
    if (parentType === 'reflection') return 'Note';
    if (parentType.includes('goal')) return 'Goal';
    return 'Item';
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (!showFollowUp && followUpItems.length > 0) {
            setShowFollowUp(true);
          } else {
            setShowFollowUp(!showFollowUp);
          }
        }}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            🚩 Follow Up
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            ({followUpItems.length})
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showFollowUp ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showFollowUp && followUpItems.length > 0 && (
        <>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
            Items you've marked for follow-up today. Time to take action or reschedule.
          </Text>

          {loadingFollowUp ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.followUpContainer, { backgroundColor: colors.surface }]}>
              {followUpItems.map((item) => (
                <View
                  key={item.id}
                  style={[styles.followUpItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={styles.followUpHeader}>
                    <View style={styles.followUpFlag}>
                      <Text style={styles.followUpFlagEmoji}>🚩</Text>
                      <Text style={[styles.followUpType, { color: colors.textSecondary }]}>
                        {getItemTypeLabel(item.parent_type)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.followUpTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.followUpActions}>
                    <TouchableOpacity
                      style={[styles.followUpButton, { backgroundColor: '#10B981' }]}
                      onPress={() => handleCompleteFollowUp(item)}
                    >
                      <Text style={[styles.followUpButtonText, { color: '#FFFFFF' }]}>
                        ✓ Done
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.followUpButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                      onPress={() => handleSnoozeFollowUp(item)}
                    >
                      <Text style={[styles.followUpButtonText, { color: colors.text }]}>
                        💤 Tomorrow
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
    borderWidth: 1,
    marginTop: 12,
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
  },
  followUpTitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  followUpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  followUpButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  followUpButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});