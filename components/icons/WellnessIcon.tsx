import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { WELLNESS_PATHS } from './WellnessPaths';

interface WellnessIconProps {
  name: string;
  color?: string;
  size?: number;
}

export const WellnessIcon = ({ name, color = "#64748b", size = 24 }: WellnessIconProps) => {
  // Convert name to slug format (e.g., "Spiritual" -> "spiritual")
  const iconKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pathData = WELLNESS_PATHS[iconKey];

  // Fallback for missing icons
  if (!pathData) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
        <Path d="M12 8v4M12 16h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {pathData}
    </Svg>
  );
};