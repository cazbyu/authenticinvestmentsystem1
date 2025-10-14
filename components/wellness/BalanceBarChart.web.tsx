import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';

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
  const chartHeight = 400;
  const padding = { top: 30, bottom: 100, left: 50, right: 20 };

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const barWidth = Math.min(30, plotWidth / (data.length * 2));
  const barSpacing = plotWidth / data.length;

  // Y-axis scale
  const maxValue = 100;
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => {
          const y = padding.top + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <G key={tick}>
              <Line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
              <SvgText
                x={padding.left - 10}
                y={y}
                fontSize={10}
                fill="#6b7280"
                textAnchor="end"
                alignmentBaseline="middle"
              >
                {tick}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis */}
        <Line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={chartWidth - padding.right}
          y2={padding.top + plotHeight}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Y-axis */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Bars and labels */}
        {data.map((d, i) => {
          const x = padding.left + (i + 0.5) * barSpacing - barWidth / 2;
          const barHeight = (d.score / maxValue) * plotHeight;
          const y = padding.top + plotHeight - barHeight;

          return (
            <G key={i}>
              {/* Bar */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={d.color}
                rx={4}
                ry={4}
              />

              {/* Score label on top of bar */}
              <SvgText
                x={x + barWidth / 2}
                y={y - 10}
                fontSize={12}
                fontWeight="600"
                fill="#1f2937"
                textAnchor="middle"
              >
                {Math.round(d.score)}
              </SvgText>

              {/* Domain name label (rotated) */}
              <SvgText
                x={padding.left + (i + 0.5) * barSpacing}
                y={padding.top + plotHeight + 20}
                fontSize={10}
                fontWeight="600"
                fill="#1f2937"
                textAnchor="start"
                transform={`rotate(-45 ${padding.left + (i + 0.5) * barSpacing} ${padding.top + plotHeight + 20})`}
              >
                {d.domain}
              </SvgText>
            </G>
          );
        })}
      </Svg>
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
