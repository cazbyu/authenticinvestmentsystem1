// UpcomingView.tsx
// Dashboard D1 component — Upcoming tasks and events, grouped by day

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Circle } from 'lucide-react-native';

export type UpcomingItem = {
  id: string;
  title: string;
  type: 'event' | 'task';
  due_date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM:SS for events
  role_tag?: string | null;
};

interface UpcomingViewProps {
  items: UpcomingItem[];
}

function formatTimeForDisplay(t: string | null | undefined): string {
  if (!t) return '';
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h24 = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h24)) return t;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function dayLabelForDate(target: Date, diffDays: number): string {
  if (diffDays === 1) {
    return `Tomorrow — ${target.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })}`;
  }
  return target.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function UpcomingView({ items }: UpcomingViewProps) {
  if (!items || items.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Nothing upcoming — enjoy the clear horizon.
      </Text>
    );
  }

  // Group by ISO date string
  const grouped = new Map<string, UpcomingItem[]>();
  for (const item of items) {
    const list = grouped.get(item.due_date) ?? [];
    list.push(item);
    grouped.set(item.due_date, list);
  }

  // Build display buckets:
  //   diff 1–6   → individual day labels
  //   diff >= 7  → merged into "This week"
  //   diff <= 0  → skipped (not upcoming)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKeys = Array.from(grouped.keys()).sort();
  const displayBuckets: Array<{ label: string; items: UpcomingItem[] }> = [];
  const thisWeekItems: UpcomingItem[] = [];

  for (const dateKey of dateKeys) {
    const target = new Date(dateKey);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((target.getTime() - today.getTime()) / 86400000);
    const itemsAtKey = grouped.get(dateKey)!;
    if (diffDays >= 1 && diffDays <= 6) {
      displayBuckets.push({ label: dayLabelForDate(target, diffDays), items: itemsAtKey });
    } else if (diffDays >= 7) {
      thisWeekItems.push(...itemsAtKey);
    }
  }
  if (thisWeekItems.length > 0) {
    displayBuckets.push({ label: 'This week', items: thisWeekItems });
  }

  return (
    <View>
      {displayBuckets.map((bucket) => (
        <View key={bucket.label} style={styles.dayGroup}>
          <Text style={styles.dayLabel}>{bucket.label}</Text>
          {bucket.items.map((item) =>
            item.type === 'event' ? (
              <View key={item.id} style={styles.eventRow}>
                <Text style={styles.eventTime}>
                  {formatTimeForDisplay(item.start_time)}
                </Text>
                <View style={styles.eventDot} />
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
            ) : (
              <View key={item.id} style={styles.taskRow}>
                <Circle size={16} color="#9ca3af" strokeWidth={2} />
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.role_tag ? (
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>{item.role_tag}</Text>
                  </View>
                ) : null}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    paddingVertical: 24,
  },
  dayGroup: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6b7280',
    marginBottom: 6,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  eventTime: {
    fontSize: 11,
    color: '#6b7280',
    width: 64,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a855f7',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  itemTitle: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  roleTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10,
    color: '#3730a3',
    fontWeight: '600',
  },
});
