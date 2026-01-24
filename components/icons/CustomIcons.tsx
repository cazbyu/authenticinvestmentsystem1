import React from 'react';
import Svg, { Path, Polygon, Circle, Line, Polyline, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function NorthStarIcon({ size = 24, color = '#231f20', strokeWidth = 4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 144 144">
      <Polygon
        points="118.48 66.57 84.6 61.35 95.89 42.68 77.22 53.97 77.22 53.97 72 15.89 66.78 53.97 66.78 53.97 48.11 42.68 59.4 61.35 25.52 66.57 59.4 71.79 48.11 90.46 66.78 79.17 66.78 79.17 72 141.89 77.22 79.17 77.22 79.17 95.89 90.46 84.6 71.79 118.48 66.57"
        fill="none"
        stroke={color}
        strokeMiterlimit={10}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function WellnessIcon({ size = 24, color = '#231f20' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 144 144">
      <Path
        d="M104.83,97.55l-17.64-4.33c-.58-7.2-2.4-21.17-7.87-31.45-.72-1.36-.82-2.98-.08-4.34.87-1.57,1.57-3.24,2.06-5.01,3.08-11.12,1.24-23.05-5.04-32.72l-2.8-4.32c-1.5-2.31-4.47-3.43-6.99-2.32-3.21,1.41-4.27,5.27-2.45,8.08l2.96,4.57c4.56,7.03,5.89,15.68,3.66,23.75-1.12,4.04-4.15,7.27-7.85,8.56-.69.2-6.81,2-8.81,2.73-6,2.2-16.64,11.36-18.71,13.18-1.22,1.07-1.91,2.62-1.88,4.25.03,1.63.77,3.15,2.02,4.18l15.39,12.59c1.03.84,2.26,1.25,3.5,1.25.28,0,.55-.05.83-.09l-42.61,23.39c-2.91,1.6-4.39,5.19-3.01,8.21,1.06,2.32,3.32,3.65,5.66,3.65,1.01,0,2.04-.25,2.99-.77l47.98-26.34h13.86l12.87,3.16-10.02,13.8c-1.82,2.51-1.8,6.07.38,8.27,2.78,2.8,7.26,2.36,9.48-.69l15.66-21.56c1.22-1.68,1.52-3.85.81-5.79-.71-1.94-2.34-3.41-4.36-3.9ZM47.6,78.06c3.13-2.5,6.45-4.93,8.71-6.19l.82,13.99-9.53-7.8Z"
        fill={color}
      />
      <Path
        d="M52.74,56.67c7.63,0,13.82-6.19,13.82-13.82s-6.19-13.82-13.82-13.82-13.82,6.19-13.82,13.82,6.19,13.82,13.82,13.82Z"
        fill={color}
      />
      <Path
        d="M129.88,51.4c-4.92-3.21-11.54-1.8-15.21,2.79l-1.26,1.57c-.28.35-.82.35-1.1,0l-1.56-1.95c-4.1-5.14-11.79-5.72-16.64-1.03-3.91,3.79-4.22,9.87-1.33,14.4h6.93l3.24-5.45c.37-.63,1.05-1.02,1.78-1.02s1.41.39,1.78,1.02l5.91,9.94,2.06-3.47c.37-.63,1.05-1.01,1.78-1.01h5.88c1.15,0,2.07.93,2.07,2.08s-.93,2.07-2.07,2.07h-4.7l-3.24,5.45c-.38.63-1.05,1.01-1.78,1.01s-1.41-.39-1.78-1.01l-5.91-9.94-2.06,3.47c-.37.63-1.05,1.01-1.78,1.01h-4.94l13.6,17.02c1.69,2.12,4.91,2.12,6.6,0l16.38-20.5c4.1-5.14,2.98-12.76-2.66-16.45Z"
        fill={color}
      />
    </Svg>
  );
}

export function GoalIcon({ size = 24, color = '#231f20', strokeWidth = 1.36 }: IconProps) {
  return (
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
      <Path
        d="M60.08,103.75l-13.51-1.83c-.52-.07-.98-.4-1.21-.87l-5.92-12.29c-1.34-2.78-5.29-2.78-6.62,0l-5.92,12.29c-.23.47-.68.8-1.2.87l-13.52,1.83c-3.05.41-4.28,4.17-2.05,6.3l9.86,9.42c.38.36.55.89.46,1.41l-2.44,13.42c-.55,3.03,2.65,5.35,5.36,3.89l12.01-6.47c.46-.25,1.02-.25,1.48,0l12.01,6.47c2.71,1.46,5.91-.86,5.36-3.89l-2.44-13.42c-.09-.52.08-1.05.46-1.41l9.86-9.42c2.23-2.13,1.01-5.89-2.05-6.3Z"
        fill={color}
        stroke={color}
        strokeMiterlimit={10}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function RoleIcon({ size = 24, color = '#010101', strokeWidth = 6 }: IconProps) {
  return (
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
  );
}
