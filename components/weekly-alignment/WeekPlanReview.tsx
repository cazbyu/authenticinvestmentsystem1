// ============================================================================
// WeekPlanReview.tsx - Review accumulated week plan items in Step 5
// ============================================================================
// Displays the accumulated Week Plan as a reviewable list, grouped by source:
// - From Roles: [task list]
// - From Wellness: [task/event list]
// - From Goals: [task list]
// - Ideas to Deposit: [idea list]
// Users can remove items before signing their weekly contract.
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Check, Trash2, Plus, Calendar, Lightbulb, CheckCircle2 } from 'lucide-react-native';
import type { WeekPlanItem } from '@/types/weekPlan';

interface WeekPlanReviewProps {
  items: WeekPlanItem[];
  onRemoveItem: (id: string) => void;
  onAddMore: () => void;
  colors: any;
}

const STEP_LABELS: Record<number, { label: string; color: string }> = {
  2: { label: 'From Roles', color: '#6b3fa0' },
  3: { label: 'From Wellness', color: '#39b54a' },
  4: { label: 'From Goals', color: '#2196F3' },
};

function getItemIcon(type: WeekPlanItem['type']) {
  switch (type) {
    case 'task':
      return CheckCircle2;
    case 'event':
      return Calendar;
    case 'idea':
      return Lightbulb;
  }
}

function getItemTypeLabel(type: WeekPlanItem['type']) {
  switch (type) {
    case 'task':
      return 'Task';
    case 'event':
      return 'Event';
    case 'idea':
      return 'Idea';
  }
}

export function WeekPlanReview({
  items,
  onRemoveItem,
  onAddMore,
  colors,
}: WeekPlanReviewProps) {
  // Group items by source step
  const groupedItems: Record<number, WeekPlanItem[]> = {};
  const ideaItems: WeekPlanItem[] = [];

  items.forEach(item => {
    if (item.type === 'idea') {
      ideaItems.push(item);
    } else {
      if (!groupedItems[item.source_step]) {
        groupedItems[item.source_step] = [];
      }
      groupedItems[item.source_step].push(item);
    }
  });

  const stepOrder = [2, 3, 4];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Your Week Plan
      </Text>

      {items.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No items captured yet. Add tasks, events, or ideas to build your aligned week.
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#ed1c24' }]}
            onPress={onAddMore}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Actions Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Grouped by step */}
          {stepOrder.map(step => {
            const stepItems = groupedItems[step];
            if (!stepItems || stepItems.length === 0) return null;
            const stepMeta = STEP_LABELS[step];

            return (
              <View key={step} style={styles.group}>
                <View style={[styles.groupHeader, { borderLeftColor: stepMeta.color }]}>
                  <Text style={[styles.groupTitle, { color: stepMeta.color }]}>
                    {stepMeta.label}
                  </Text>
                  <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
                    {stepItems.length} {stepItems.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>

                {stepItems.map(item => {
                  const Icon = getItemIcon(item.type);
                  return (
                    <View
                      key={item.id}
                      style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Icon size={16} color={stepMeta.color} />
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.itemContext, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.source_context}
                          {item.aligned_to ? ` • ${item.aligned_to}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.typeBadge, { backgroundColor: `${stepMeta.color}15` }]}>
                        <Text style={[styles.typeBadgeText, { color: stepMeta.color }]}>
                          {getItemTypeLabel(item.type)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => onRemoveItem(item.id)}
                        style={styles.removeButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}

          {/* Ideas section */}
          {ideaItems.length > 0 && (
            <View style={styles.group}>
              <View style={[styles.groupHeader, { borderLeftColor: '#f59e0b' }]}>
                <Text style={[styles.groupTitle, { color: '#f59e0b' }]}>
                  Ideas to Deposit
                </Text>
                <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
                  {ideaItems.length} {ideaItems.length === 1 ? 'idea' : 'ideas'}
                </Text>
              </View>

              {ideaItems.map(item => (
                <View
                  key={item.id}
                  style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Lightbulb size={16} color="#f59e0b" />
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemContext, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.source_context}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onRemoveItem(item.id)}
                    style={styles.removeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add More button */}
          <TouchableOpacity
            style={[styles.addMoreButton, { borderColor: colors.border }]}
            onPress={onAddMore}
          >
            <Plus size={16} color={colors.textSecondary} />
            <Text style={[styles.addMoreText, { color: colors.textSecondary }]}>
              Add More Actions
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyState: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  group: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  groupCount: {
    fontSize: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemContext: {
    fontSize: 12,
    marginTop: 2,
  },
  typeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  removeButton: {
    padding: 4,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default WeekPlanReview;
