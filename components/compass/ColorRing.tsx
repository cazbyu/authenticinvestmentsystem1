import React from 'react';
import { G, Path } from 'react-native-svg';

interface ColorRingProps {
  visible: boolean;
  size?: number;
}

export const ColorRing: React.FC<ColorRingProps> = ({ visible, size = 288 }) => {
  if (!visible) return null;

  const center = size / 2;
  const outerRadius = 95;
  const innerRadius = 50;

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const createWedgePath = (startAngle: number, endAngle: number): string => {
    const outerStart = polarToCartesian(startAngle, outerRadius);
    const outerEnd = polarToCartesian(endAngle, outerRadius);
    const innerStart = polarToCartesian(startAngle, innerRadius);
    const innerEnd = polarToCartesian(endAngle, innerRadius);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

    return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
  };

  const segments = [
    { start: 0, end: 45, color: '#e7731f' },
    { start: 45, end: 90, color: '#ffd400' },
    { start: 90, end: 135, color: '#39b54a' },
    { start: 135, end: 180, color: '#00abc5' },
    { start: 180, end: 225, color: '#0066b3' },
    { start: 225, end: 270, color: '#752e87' },
    { start: 270, end: 315, color: '#ed1c24' },
    { start: 315, end: 360, color: '#e7731f' },
  ];

  return (
    <G>
      {segments.map((seg, i) => (
        <Path
          key={i}
          d={createWedgePath(seg.start, seg.end)}
          fill={seg.color}
          opacity={0.75}
        />
      ))}
    </G>
  );
};
