import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { parseLocalDate } from '@/lib/dateUtils';

export interface TrendLineChartProps {
  data: { date: string; value: number }[];
  accentColor: string;
  goalValue?: number | null;
  goalValueMax?: number | null;
  height?: number;
}

const PAD_LEFT = 34;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatShortDate(iso: string): string {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrendLineChart({
  data,
  accentColor,
  goalValue,
  goalValueMax,
  height = 200,
}: TrendLineChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== containerWidth) setContainerWidth(w);
  };

  if (data.length < 2) {
    return (
      <View onLayout={handleLayout} style={[styles.container, { height }]}>
        <Text style={styles.placeholderText}>Not enough data</Text>
      </View>
    );
  }

  if (containerWidth === 0) {
    return <View onLayout={handleLayout} style={[styles.container, { height }]} />;
  }

  const width = containerWidth;
  const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 10);
  const plotHeight = Math.max(height - PAD_TOP - PAD_BOTTOM, 10);

  const values = data.map(d => d.value);
  const goalCandidates: number[] = [];
  if (typeof goalValue === 'number') goalCandidates.push(goalValue);
  if (typeof goalValueMax === 'number') goalCandidates.push(goalValueMax);
  const allY = [...values, ...goalCandidates];
  const rawMin = Math.min(...allY);
  const rawMax = Math.max(...allY);
  const span = rawMax - rawMin || 1;
  const yPad = span * 0.1;
  const yMin = rawMin - yPad;
  const yMax = rawMax + yPad;
  const yRange = yMax - yMin;

  const scaleX = (i: number) =>
    PAD_LEFT + (i / (data.length - 1)) * plotWidth;
  const scaleY = (v: number) =>
    PAD_TOP + (1 - (v - yMin) / yRange) * plotHeight;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(d.value).toFixed(2)}`)
    .join(' ');

  const labelIndices = (() => {
    const n = data.length;
    if (n <= 5) return data.map((_, i) => i);
    return [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
  })();

  const yTicks = [rawMax, rawMin];

  return (
    <View onLayout={handleLayout} style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        {yTicks.map((tick, i) => (
          <SvgText
            key={`y-${i}`}
            x={PAD_LEFT - 4}
            y={scaleY(tick) + 3}
            fontSize={10}
            fill="#6b7280"
            textAnchor="end"
          >
            {Number.isInteger(tick) ? String(tick) : tick.toFixed(1)}
          </SvgText>
        ))}

        {typeof goalValue === 'number' && typeof goalValueMax === 'number' && (
          <Rect
            x={PAD_LEFT}
            y={scaleY(Math.max(goalValue, goalValueMax))}
            width={plotWidth}
            height={Math.abs(
              scaleY(Math.min(goalValue, goalValueMax)) -
              scaleY(Math.max(goalValue, goalValueMax)),
            )}
            fill="rgba(156,163,175,0.1)"
          />
        )}

        {typeof goalValue === 'number' && (
          <Line
            x1={PAD_LEFT}
            y1={scaleY(goalValue)}
            x2={PAD_LEFT + plotWidth}
            y2={scaleY(goalValue)}
            stroke="#9ca3af"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        <Path d={linePath} stroke={accentColor} strokeWidth={2} fill="none" />

        {data.map((d, i) => (
          <Circle
            key={`pt-${i}`}
            cx={scaleX(i)}
            cy={scaleY(d.value)}
            r={3}
            fill={accentColor}
          />
        ))}

        {labelIndices.map(i => (
          <SvgText
            key={`x-${i}`}
            x={scaleX(i)}
            y={height - 8}
            fontSize={10}
            fill="#6b7280"
            textAnchor="middle"
          >
            {formatShortDate(data[i].date)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
