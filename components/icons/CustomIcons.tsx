import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Polygon, Circle, Line, Polyline, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function NorthStarIcon({ size = 24, color = '#231f20', strokeWidth = 2 }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 144 144">
        <Polygon
          points="118.48 60.34 84.6 55.12 95.89 36.45 77.22 47.74 77.22 47.74 72 9.66 66.78 47.74 66.78 47.74 48.11 36.45 59.4 55.12 25.52 60.34 59.4 65.56 48.11 84.23 66.78 72.94 66.78 72.94 72 135.66 77.22 72.94 77.22 72.94 95.89 84.23 84.6 65.56 118.48 60.34"
          fill="none"
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

export function WellnessIcon({ size = 24, color = '#231f20', strokeWidth = 2.33 }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 144 144">
        <Path
          d="M104.83,97.55l-17.64-4.33c-.58-7.2-2.4-21.17-7.87-31.45-.72-1.36-.82-2.98-.08-4.34.87-1.57,1.57-3.24,2.06-5.01,3.08-11.12,1.24-23.05-5.04-32.72l-2.8-4.32c-1.5-2.31-4.47-3.43-6.99-2.32-3.21,1.41-4.27,5.27-2.45,8.08l2.96,4.57c4.56,7.03,5.89,15.68,3.66,23.75-1.12,4.04-4.15,7.27-7.85,8.56-.69.2-6.81,2-8.81,2.73-6,2.2-16.64,11.36-18.71,13.18-1.22,1.07-1.91,2.62-1.88,4.25.03,1.63.77,3.15,2.02,4.18l15.39,12.59c1.03.84,2.26,1.25,3.5,1.25.28,0,.55-.05.83-.09l-42.61,23.39c-2.91,1.6-4.39,5.19-3.01,8.21,1.06,2.32,3.32,3.65,5.66,3.65,1.01,0,2.04-.25,2.99-.77l47.98-26.34h13.86l12.87,3.16-10.02,13.8c-1.82,2.51-1.8,6.07.38,8.27,2.78,2.8,7.26,2.36,9.48-.69l15.66-21.56c1.22-1.68,1.52-3.85.81-5.79-.71-1.94-2.34-3.41-4.36-3.9Z"
          fill="none"
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx="52.74"
          cy="42.85"
          r="13.82"
          fill="none"
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

export function GoalIcon({ size = 24, color = '#231f20', strokeWidth = 1.36 }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 144 144">
        <Path
          d="M35.88,78.7c-.94-3.19-1.42-6.56-1.42-10.03,0-20.51,16.72-37.19,37.23-37.19,6.11,0,11.94,1.49,17,4.13l6.66-6.66c-6.94-4.13-15.02-6.56-23.66-6.56-25.57,0-46.29,20.78-46.29,46.29,0,4.82.73,9.47,2.12,13.85,2.12-2.36,5.1-3.75,8.36-3.82Z"
          fill={color}
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M104.72,51.71c2.6,5.1,4.13,10.86,4.13,16.97,0,20.51-16.65,37.2-37.16,37.2h-.52c.42,3.19-.49,6.42-2.6,8.95,1.04.11,2.08.14,3.12.14,25.5,0,46.22-20.75,46.22-46.29,0-8.6-2.36-16.72-6.52-23.63l-6.66,6.66Z"
          fill={color}
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M71.67,48.95c1.13,0,2.27.09,3.36.32l7.31-7.3c-3.31-1.36-6.9-2.09-10.66-2.09-15.92,0-28.85,12.93-28.85,28.81s12.93,28.85,28.85,28.85,28.81-12.93,28.81-28.85c0-3.77-.73-7.35-2.09-10.66l-7.31,7.3c.23,1.09.32,2.22.32,3.36,0,10.89-8.85,19.78-19.74,19.78s-19.78-8.89-19.78-19.78,8.89-19.74,19.78-19.74Z"
          fill={color}
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M134.74,19.88c-.53-1.27-1.77-2.1-3.15-2.1h-9.03v-9.03c0-1.38-.83-2.62-2.1-3.15-1.27-.52-2.73-.24-3.71.74l-9.32,9.32c-.64.64-1,1.5-1,2.41v9.41l-30.62,30.62c-1.29-.51-2.69-.81-4.16-.81-6.28,0-11.39,5.11-11.39,11.39s5.11,11.38,11.39,11.38,11.38-5.1,11.38-11.38c0-1.47-.3-2.87-.81-4.16l30.62-30.62h9.42c.9,0,1.77-.36,2.41-1l9.32-9.32c.97-.97,1.26-2.44.74-3.71Z"
          fill={color}
          stroke={color}
          strokeMiterlimit={10}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

export function RoleIcon({ size = 24, color = '#010101', strokeWidth = 2.67 }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 144 144">
        <Circle
          cx="68.16"
          cy="72.66"
          r="7.03"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <Path
          d="M49.74,83.09l8.82,8.73c.61.6.95,1.42.95,2.27v31.58"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <Path
          d="M76.81,125.68v-31.58c0-.85.34-1.68.95-2.27l6.59-3.47"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <Path
          d="M82.79,79.33c-4.83,2.17-11.9,5.24-13.23,5.24h-2.8c-2.07,0-4.07-.73-5.65-2.07l-6.25-5.27"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <Line
          x1="68.16"
          y1="125.68"
          x2="68.16"
          y2="109.92"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <G>
          <Path
            d="M126.56,87.57c2.47,0,4.48-1.86,4.48-4.15v-29.34c0-4.68-4.1-8.48-9.15-8.48h-25.34c-5.05,0-9.15,3.8-9.15,8.48v29.34c0,2.29,2.01,4.15,4.48,4.15"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Polyline
            points="122.91 66.53 122.91 72.58 122.91 82.86 122.91 125.68"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            x1="109.22"
            y1="91.38"
            x2="108.82"
            y2="125.68"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            x1="95.53"
            y1="125.68"
            x2="95.53"
            y2="66.53"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="109.22"
            cy="30.81"
            r="11.25"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </G>
        <G>
          <Path
            d="M14.89,78.43l-2.25-3.24c-.7-1.22-.92-2.66-.62-4.03l3.2-14.44,1.58-7.14.3-1.37c.89-4.03,4.47-6.9,8.59-6.9h11.72c3.99,0,7.48,2.68,8.51,6.54l6.19,23.3c.44,1.64.11,3.38-.89,4.75l-2.15,2.53"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Polyline
            points="23 54.17 15.42 90.97 48.01 90.97 40.43 54.17"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="31.45"
            cy="28.13"
            r="9.81"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            x1="21.6"
            y1="125.68"
            x2="19.41"
            y2="91.54"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            x1="31.2"
            y1="91.54"
            x2="31.2"
            y2="125.43"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            x1="40.8"
            y1="125.68"
            x2="42.98"
            y2="91.54"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </G>
        <Line
          x1="9"
          y1="125.68"
          x2="135"
          y2="125.68"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}
