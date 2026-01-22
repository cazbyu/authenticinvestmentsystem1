import React from 'react';
import { Defs, LinearGradient, Stop, Path, G } from 'react-native-svg';

interface ColorRingProps {
  visible: boolean;
  size?: number;
}

export const ColorRing: React.FC<ColorRingProps> = ({ visible, size = 288 }) => {
  if (!visible) return null;

  const center = size / 2; // 144
  const outerRadius = 102; // Match the middle circle in SVG
  const innerRadius = 45;  // Inside the star points

  // Function to create a wedge/segment path
  const createWedgePath = (startAngle: number, endAngle: number): string => {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;

    const x1 = center + outerRadius * Math.cos(startRad);
    const y1 = center + outerRadius * Math.sin(startRad);
    const x2 = center + outerRadius * Math.cos(endRad);
    const y2 = center + outerRadius * Math.sin(endRad);
    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1}
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
            L ${x3} ${y3}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
            Z`;
  };

  // Define the 8 segments with their colors matching the original SVG
  const segments = [
    { start: 0, end: 45, colors: ['#e7731f', '#ffd400'], id: 'seg1' },      // N to NE: Orange to Yellow
    { start: 45, end: 90, colors: ['#ffd400', '#39b54a'], id: 'seg2' },     // NE to E: Yellow to Green
    { start: 90, end: 135, colors: ['#39b54a', '#00abc5'], id: 'seg3' },    // E to SE: Green to Cyan
    { start: 135, end: 180, colors: ['#00abc5', '#0066b3'], id: 'seg4' },   // SE to S: Cyan to Blue
    { start: 180, end: 225, colors: ['#0066b3', '#752e87'], id: 'seg5' },   // S to SW: Blue to Purple
    { start: 225, end: 270, colors: ['#752e87', '#ed1c24'], id: 'seg6' },   // SW to W: Purple to Red
    { start: 270, end: 315, colors: ['#ed1c24', '#e7731f'], id: 'seg7' },   // W to NW: Red to Orange
    { start: 315, end: 360, colors: ['#e7731f', '#e7731f'], id: 'seg8' },   // NW to N: Orange to Orange
  ];

  return (
    <G opacity={0.7}>
      <Defs>
        {segments.map((seg) => (
          <LinearGradient
            key={seg.id}
            id={seg.id}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={seg.colors[0]} />
            <Stop offset="100%" stopColor={seg.colors[1]} />
          </LinearGradient>
        ))}
      </Defs>
      {segments.map((seg) => (
        <Path
          key={seg.id}
          d={createWedgePath(seg.start, seg.end)}
          fill={`url(#${seg.id})`}
        />
      ))}
    </G>
  );
};
