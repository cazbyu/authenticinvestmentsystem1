import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Calendar, Flower, CircleAlert as AlertCircle, Lightbulb, FileText } from 'lucide-react-native';

interface HoverStatsPopupProps {
  scheduledByWeek: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  reflectionStats: {
    roses: number;
    thorns: number;
    depositIdeas: number;
    reflectionsAndNotes: number;
  };
  visible: boolean;
}

export function HoverStatsPopup({
  scheduledByWeek,
  reflectionStats,
  visible
}: HoverStatsPopupProps) {
  if (!visible) return null;

  return (
    <View style={styles.popup}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Calendar size={14} color="#6b7280" />
          <Text style={styles.sectionTitle}>Scheduled Deposits</Text>
        </View>
        <View style={styles.scheduleGrid}>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>W1:</Text>
            <Text style={styles.scheduleValue}>{scheduledByWeek.week1}</Text>
          </View>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>W2:</Text>
            <Text style={styles.scheduleValue}>{scheduledByWeek.week2}</Text>
          </View>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>W3:</Text>
            <Text style={styles.scheduleValue}>{scheduledByWeek.week3}</Text>
          </View>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>W4:</Text>
            <Text style={styles.scheduleValue}>{scheduledByWeek.week4}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reflections</Text>
        <View style={styles.reflectionGrid}>
          <View style={styles.reflectionItem}>
            <Flower size={20} color="#ec4899" />
            <Text style={styles.reflectionValue}>{reflectionStats.roses}</Text>
          </View>
          <View style={styles.reflectionItem}>
            <AlertCircle size={20} color="#ef4444" />
            <Text style={styles.reflectionValue}>{reflectionStats.thorns}</Text>
          </View>
          <View style={styles.reflectionItem}>
            <Lightbulb size={20} color="#f59e0b" />
            <Text style={styles.reflectionValue}>{reflectionStats.depositIdeas}</Text>
          </View>
          <View style={styles.reflectionItem}>
            <FileText size={20} color="#6b7280" />
            <Text style={styles.reflectionValue}>{reflectionStats.reflectionsAndNotes}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: Platform.OS === 'web' ? 'translateX(-50%)' : undefined,
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    minWidth: 220,
    ...Platform.select({
      web: {
        transform: [{ translateX: '-50%' }],
      },
      default: {
        marginLeft: -110,
      },
    }),
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleGrid: {
    gap: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  scheduleValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  reflectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  reflectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
  },
  reflectionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});
