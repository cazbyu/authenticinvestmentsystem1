import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';

interface DomainScore {
  domain: string;
  score: number;
  color: string;
}

interface BalancePieChartProps {
  data: DomainScore[];
  maxScore?: number;
  unit?: string;
}

export function BalancePieChart({ data, maxScore = 100, unit = 'tasks' }: BalancePieChartProps) {
  console.log('[BalancePieChart.web] Rendering with data:', data);

  // Handle empty or invalid data
  if (!data || data.length === 0) {
    console.log('[BalancePieChart.web] No data provided');
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 32, 400);
  const center = chartSize / 2;
  const radius = (chartSize / 2) - 80;

  // Calculate total score
  const totalScore = data.reduce((sum, d) => sum + (isNaN(d.score) ? 0 : d.score), 0);

  console.log('[BalancePieChart.web] Total score:', totalScore);

  // If all scores are zero, show message
  if (totalScore === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Convert scores to angles
  interface SliceData {
    domain: string;
    score: number;
    color: string;
    percentage: number;
    startAngle: number;
    endAngle: number;
  }

  const slices: SliceData[] = [];
  let currentAngle = -Math.PI / 2; // Start at top

  data.forEach((d) => {
    const validScore = isNaN(d.score) ? 0 : d.score;
    if (validScore > 0) {
      const percentage = (validScore / totalScore) * 100;
      const angleSize = (validScore / totalScore) * 2 * Math.PI;
      const endAngle = currentAngle + angleSize;

      slices.push({
        domain: d.domain,
        score: validScore,
        color: d.color,
        percentage,
        startAngle: currentAngle,
        endAngle,
      });

      currentAngle = endAngle;
    }
  });

  console.log('[BalancePieChart.web] Slices:', slices);

  // Helper function to create arc path
  const createArcPath = (startAngle: number, endAngle: number, radius: number): string => {
    const startX = center + radius * Math.cos(startAngle);
    const startY = center + radius * Math.sin(startAngle);
    const endX = center + radius * Math.cos(endAngle);
    const endY = center + radius * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${center} ${center}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      'Z',
    ].join(' ');
  };

  // Calculate label position for each slice
  const calculateLabelPosition = (startAngle: number, endAngle: number, radius: number) => {
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius * 0.7; // Position label at 70% of radius
    const x = center + labelRadius * Math.cos(midAngle);
    const y = center + labelRadius * Math.sin(midAngle);
    return { x, y };
  };

  return (
    <View style={styles.container}>
      <Svg width={chartSize} height={chartSize}>
        {/* Draw pie slices */}
        {slices.map((slice, index) => {
          const path = createArcPath(slice.startAngle, slice.endAngle, radius);
          const labelPos = calculateLabelPosition(slice.startAngle, slice.endAngle, radius);

          return (
            <G key={index}>
              {/* Slice */}
              <Path d={path} fill={slice.color} stroke="#ffffff" strokeWidth={2} />

              {/* Score label inside slice */}
              <SvgText
                x={labelPos.x}
                y={labelPos.y}
                fontSize={14}
                fontWeight="700"
                fill="#ffffff"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {Math.round(slice.score)}
              </SvgText>
            </G>
          );
        })}

        {/* Center circle with total */}
        <Circle cx={center} cy={center} r={radius * 0.35} fill="#ffffff" stroke="#e5e7eb" strokeWidth={2} />
        <SvgText
          x={center}
          y={center - 10}
          fontSize={16}
          fontWeight="700"
          fill="#1f2937"
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          Total
        </SvgText>
        <SvgText
          x={center}
          y={center + 12}
          fontSize={20}
          fontWeight="700"
          fill="#0078d4"
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {Math.round(totalScore)}
        </SvgText>

        {/* Domain labels outside the pie */}
        {slices.map((slice, index) => {
          const midAngle = (slice.startAngle + slice.endAngle) / 2;
          const labelRadius = radius + 40;
          const x = center + labelRadius * Math.cos(midAngle);
          const y = center + labelRadius * Math.sin(midAngle);

          // Determine text anchor based on position
          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          if (x < center - 10) {
            textAnchor = 'end';
          } else if (x > center + 10) {
            textAnchor = 'start';
          }

          return (
            <G key={`label-${index}`}>
              {/* Connection line */}
              <Path
                d={`M ${center + (radius + 5) * Math.cos(midAngle)} ${center + (radius + 5) * Math.sin(midAngle)} L ${x - (textAnchor === 'start' ? 5 : textAnchor === 'end' ? -5 : 0)} ${y}`}
                stroke="#9ca3af"
                strokeWidth={1}
              />
              {/* Domain name */}
              <SvgText
                x={x}
                y={y}
                fontSize={11}
                fontWeight="600"
                fill="#1f2937"
                textAnchor={textAnchor}
                alignmentBaseline="middle"
              >
                {slice.domain}
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
