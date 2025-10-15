import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DomainScore {
  domain: string;
  score: number;
  color: string;
}

interface BalanceBarChartProps {
  data: DomainScore[];
}

export function BalanceBarChart({ data }: BalanceBarChartProps) {
  console.log('[BalanceBarChart.native] Rendering with data:', data);

  // This component is for native platforms and uses a different rendering approach
  // For web, the .web.tsx version is used automatically
  return (
    <View style={styles.container}>
      <Text style={styles.noticeText}>
        Chart rendering is optimized for web. Please use the web version to view charts.
      </Text>
      {data && data.length > 0 && (
        <View style={styles.dataList}>
          {data.map((item, index) => (
            <View key={index} style={styles.dataItem}>
              <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
              <Text style={styles.domainText}>{item.domain}</Text>
              <Text style={styles.scoreText}>{Math.round(item.score)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noticeText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  dataList: {
    width: '100%',
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  domainText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});
