import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Circle, Line, Polygon, G, Text as SvgText } from 'react-native-svg';

interface DomainScore {
  domain: string;
  score: number;
  color: string;
}

interface BalanceWheelChartProps {
  data: DomainScore[];
}

export function BalanceWheelChart({ data }: BalanceWheelChartProps) {
  console.log('[BalanceWheelChart.web] Rendering with data:', data);

  // Handle empty or invalid data
  if (!data || data.length === 0) {
    console.log('[BalanceWheelChart.web] No data provided');
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 32, 400);
  const center = chartSize / 2;
  const maxRadius = (chartSize / 2) - 60;

  // Calculate polygon points for the radar chart
  const calculatePoint = (score: number, index: number, total: number) => {
    if (total === 0) {
      console.warn('[BalanceWheelChart.web] Total is 0, returning center point');
      return { x: center, y: center };
    }

    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    // Ensure score is a valid number, default to 0 if not
    const validScore = isNaN(score) ? 0 : score;
    // Add minimum radius for visibility (5% of max) if score > 0
    const minRadius = validScore > 0 ? maxRadius * 0.05 : 0;
    const radius = Math.max((validScore / 100) * maxRadius, minRadius);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    // Validate coordinates
    if (isNaN(x) || isNaN(y)) {
      console.warn('[BalanceWheelChart.web] Invalid coordinates:', { x, y, score, angle });
      return { x: center, y: center };
    }

    return { x, y };
  };

  // Calculate label position (outside the chart)
  const calculateLabelPoint = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    const radius = maxRadius + 30;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y };
  };

  // Generate points for the filled area
  const polygonPoints = data
    .map((d, i) => {
      const point = calculatePoint(d.score, i, data.length);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  console.log('[BalanceWheelChart.web] Polygon points:', polygonPoints);

  // Check if all points are at the center (all zeros)
  const allZeros = data.every(d => d.score === 0);
  if (allZeros) {
    console.log('[BalanceWheelChart.web] All scores are zero');
  }

  // Generate grid circles
  const gridLevels = [25, 50, 75, 100];

  return (
    <View style={styles.container}>
      <Svg width={chartSize} height={chartSize}>
        {/* Grid circles */}
        {gridLevels.map((level) => {
          const radius = (level / 100) * maxRadius;
          return (
            <Circle
              key={level}
              cx={center}
              cy={center}
              r={radius}
              stroke="#e5e7eb"
              strokeWidth={1}
              fill="none"
            />
          );
        })}

        {/* Grid lines from center to each axis */}
        {data.map((_, i) => {
          const point = calculatePoint(100, i, data.length);
          return (
            <Line
              key={i}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon */}
        <Polygon
          points={polygonPoints}
          fill="#3b82f6"
          fillOpacity={0.4}
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* Axis labels */}
        {data.map((d, i) => {
          const labelPoint = calculateLabelPoint(i, data.length);
          return (
            <SvgText
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              fontSize={12}
              fontWeight="600"
              fill="#1f2937"
              textAnchor="middle"
            >
              {d.domain}
            </SvgText>
          );
        })}

        {/* Center dot */}
        <Circle
          cx={center}
          cy={center}
          r={3}
          fill="#1f2937"
        />
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
