import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { VictoryBar, VictoryChart, VictoryAxis, VictoryLabel } from 'victory-native';

interface DomainScore {
  domain: string;
  score: number;
  color: string;
}

interface BalanceBarChartProps {
  data: DomainScore[];
}

export function BalanceBarChart({ data }: BalanceBarChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 32, 500);

  return (
    <View style={styles.container}>
      <VictoryChart
        height={400}
        width={chartWidth}
        padding={{ top: 30, bottom: 80, left: 50, right: 20 }}
        domainPadding={{ x: 20 }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: '#e5e7eb', strokeWidth: 1 },
            tickLabels: {
              fill: '#1f2937',
              fontSize: 10,
              fontWeight: '600',
              angle: -45,
              textAnchor: 'end',
              verticalAnchor: 'middle',
            },
          }}
          tickFormat={data.map(d => d.domain)}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: '#e5e7eb', strokeWidth: 1 },
            grid: { stroke: '#e5e7eb', strokeWidth: 0.5 },
            tickLabels: { fill: '#6b7280', fontSize: 10 },
          }}
          domain={[0, 100]}
          tickValues={[0, 25, 50, 75, 100]}
        />
        <VictoryBar
          data={data.map((d, i) => ({ x: i + 1, y: d.score, fill: d.color }))}
          style={{
            data: { fill: ({ datum }) => datum.fill },
          }}
          cornerRadius={{ top: 4 }}
          barWidth={30}
          labels={({ datum }) => `${Math.round(datum.y)}`}
          labelComponent={
            <VictoryLabel
              dy={-10}
              style={{ fill: '#1f2937', fontSize: 12, fontWeight: '600' }}
            />
          }
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
