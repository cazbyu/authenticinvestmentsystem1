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
  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 32, 400);
  const center = chartSize / 2;
  const maxRadius = (chartSize / 2) - 60;

  // Calculate polygon points for the radar chart
  const calculatePoint = (score: number, index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    const radius = (score / 100) * maxRadius;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
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
});
