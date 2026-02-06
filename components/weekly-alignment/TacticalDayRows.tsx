import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Plus, Clock } from 'lucide-react-native';

export interface EnrichedItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  roles: Array<{ id: string; label: string; color?: string }>;
  domains: Array<{ id: string; name: string }>;
  goals: Array<{ id: string; title: string }>;
  has_delegates?: boolean;
  delegateName?: string;
}

export interface WeekDay {
  date: string;
  label: string;
}

interface TacticalDayRowsProps {
  items: EnrichedItem[];
  dateField: 'due_date' | 'start_date';
  weekDays: WeekDay[];
  committedIds: Set<string>;
  onToggleCommit: (id: string) => void;
  onEditItem: (item: EnrichedItem) => void;
  colors: any;
  showPriority?: boolean;
}

function getPriorityColor(item: EnrichedItem): string {
  if (item.is_urgent && item.is_important) return '#EF4444';
  if (!item.is_urgent && item.is_important) return '#10B981';
  if (item.is_urgent && !item.is_important) return '#F59E0B';
  return '#6B7280';
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return timeStr;
  }
}

export default function TacticalDayRows({
  items,
  dateField,
  weekDays,
  committedIds,
  onToggleCommit,
  onEditItem,
  colors,
  showPriority = false,
}: TacticalDayRowsProps) {
  const grouped = new Map<string, EnrichedItem[]>();
  for (const day of weekDays) {
    grouped.set(day.date, []);
  }
  for (const item of items) {
    const date = item[dateField];
    if (date && grouped.has(date)) {
      grouped.get(date)!.push(item);
    }
  }

  return (
    <View style={styles.container}>
      {weekDays.map((day) => {
        const dayItems = grouped.get(day.date) || [];
        return (
          <View key={day.date} style={styles.daySection}>
            <View style={[styles.dayHeader, { backgroundColor: colors.background }]}>
              <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
                {day.label}
              </Text>
              {dayItems.length > 0 && (
                <Text style={[styles.dayCount, { color: colors.textSecondary }]}>
                  {dayItems.length}
                </Text>
              )}
            </View>

            {dayItems.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={[styles.emptyText, { color: colors.border }]}>--</Text>
              </View>
            ) : (
              dayItems.map((item) => {
                const isCommitted = committedIds.has(item.id);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      {
                        backgroundColor: isCommitted ? '#10B98108' : 'transparent',
                        borderColor: isCommitted ? '#10B98140' : colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => onToggleCommit(item.id)}
                      style={[
                        styles.checkbox,
                        { borderColor: isCommitted ? '#10B981' : colors.border },
                      ]}
                    >
                      {isCommitted && <CheckCircle2 size={16} color="#10B981" />}
                    </TouchableOpacity>

                    <View style={styles.itemContent}>
                      <Text
                        style={[
                          styles.itemTitle,
                          { color: colors.text },
                          isCommitted && styles.committed,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <View style={styles.chipRow}>
                        {showPriority && (
                          <View
                            style={[
                              styles.priorityDot,
                              { backgroundColor: getPriorityColor(item) },
                            ]}
                          />
                        )}
                        {item.start_time && (
                          <View style={styles.timeChip}>
                            <Clock size={10} color={colors.textSecondary} />
                            <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
                              {formatTime(item.start_time)}
                            </Text>
                          </View>
                        )}
                        {item.roles.map((r) => (
                          <View
                            key={r.id}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: (r.color || '#6B7280') + '18',
                                borderColor: (r.color || '#6B7280') + '50',
                              },
                            ]}
                          >
                            <Text
                              style={[styles.chipLabel, { color: r.color || '#6B7280' }]}
                              numberOfLines={1}
                            >
                              {r.label}
                            </Text>
                          </View>
                        ))}
                        {item.domains.map((d) => (
                          <View
                            key={d.id}
                            style={[
                              styles.chip,
                              { backgroundColor: '#39b54a15', borderColor: '#39b54a40' },
                            ]}
                          >
                            <Text
                              style={[styles.chipLabel, { color: '#39b54a' }]}
                              numberOfLines={1}
                            >
                              {d.name}
                            </Text>
                          </View>
                        ))}
                        {item.goals.map((g) => (
                          <View
                            key={g.id}
                            style={[
                              styles.chip,
                              { backgroundColor: '#3B82F615', borderColor: '#3B82F640' },
                            ]}
                          >
                            <Text
                              style={[styles.chipLabel, { color: '#3B82F6' }]}
                              numberOfLines={1}
                            >
                              {g.title.length > 18 ? g.title.substring(0, 18) + '...' : g.title}
                            </Text>
                          </View>
                        ))}
                        {item.has_delegates && item.delegateName && (
                          <View
                            style={[
                              styles.chip,
                              { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' },
                            ]}
                          >
                            <Text style={[styles.chipLabel, { color: '#F59E0B' }]}>
                              {item.delegateName}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => onEditItem(item)}
                      style={[styles.editBtn, { borderColor: colors.border }]}
                    >
                      <Plus size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  daySection: {
    marginBottom: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 3,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyDay: {
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  emptyText: {
    fontSize: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 3,
  },
  committed: {
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    maxWidth: 130,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
