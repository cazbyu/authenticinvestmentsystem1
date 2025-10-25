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
  maxScore?: number;
  unit?: string;
}

export function BalanceBarChart({ data, maxScore = 100, unit = 'tasks' }: BalanceBarChartProps) {
  console.log('[BalanceBarChart.web] Rendering with data:', data);

  // Handle empty or invalid data
  if (!data || data.length === 0) {
    console.log('[BalanceBarChart.web] No data provided');
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 32, 500);
  const chartHeight = 400;
  const padding = { top: 30, bottom: 100, left: 50, right: 20 };

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const barWidth = Math.min(30, plotWidth / (data.length * 2));
  const barSpacing = plotWidth / data.length;

  // Y-axis scale based on actual maxScore
  const maxValue = maxScore;
  const yTicks = [
    0,
    Math.round(maxScore * 0.25),
    Math.round(maxScore * 0.5),
    Math.round(maxScore * 0.75),
    maxScore
  ];

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
          // Ensure score is valid and add minimum height for visibility
          const validScore = isNaN(d.score) ? 0 : d.score;
          const calculatedHeight = (validScore / maxValue) * plotHeight;
          // Minimum bar height of 3px for non-zero values for visibility
          const barHeight = validScore > 0 ? Math.max(calculatedHeight, 3) : 0;
          const y = padding.top + plotHeight - barHeight;

          console.log(`[BalanceBarChart.web] Bar ${i} (${d.domain}):`, {
            score: d.score,
            validScore,
            calculatedHeight,
            barHeight,
            y
          });

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

              {/* Score label on top of bar - only show if bar has height */}
              {barHeight > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={Math.max(y - 10, padding.top + 10)}
                  fontSize={12}
                  fontWeight="600"
                  fill="#1f2937"
                  textAnchor="middle"
                >
                  {Math.round(validScore)}
                </SvgText>
              )}

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
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    padding: 40,
  },
});
