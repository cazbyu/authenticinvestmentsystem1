import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { VictoryPolarAxis, VictoryArea, VictoryChart } from 'victory-native';

interface DomainScore {
  domain: string;
  score: number;
  color: string;
}

interface BalanceWheelChartProps {
  data: DomainScore[];
}

export function BalanceWheelChart({ data }: BalanceWheelChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 32, 400);

  return (
    <View style={styles.container}>
      <VictoryChart
        polar
        height={chartSize}
        width={chartSize}
        padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
      >
        <VictoryPolarAxis
          dependentAxis
          style={{
            axis: { stroke: '#e5e7eb', strokeWidth: 1 },
            grid: { stroke: '#e5e7eb', strokeWidth: 0.5 },
            tickLabels: { fill: '#6b7280', fontSize: 10 },
          }}
          tickValues={[0, 25, 50, 75, 100]}
          domain={[0, 100]}
        />
        <VictoryPolarAxis
          labelPlacement="perpendicular"
          style={{
            axis: { stroke: 'none' },
            grid: { stroke: '#e5e7eb', strokeWidth: 1 },
            tickLabels: { fill: '#1f2937', fontSize: 12, fontWeight: '600' },
          }}
          tickValues={data.map((_, i) => i)}
          tickFormat={data.map(d => d.domain)}
        />
        <VictoryArea
          data={data.map((d, i) => ({ x: i, y: d.score }))}
          style={{
            data: {
              fill: '#3b82f6',
              fillOpacity: 0.4,
              stroke: '#3b82f6',
              strokeWidth: 2,
            },
          }}
          interpolation="catmullRom"
        />
      </VictoryChart>
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
});
