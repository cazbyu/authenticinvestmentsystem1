import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G, Polygon, Rect } from 'react-native-svg';

interface MiniCompassProps {
  size?: number;
}

export function MiniCompass({ size = 60 }: MiniCompassProps) {
  // Scale factor from original 288 viewBox
  const scale = size / 288;
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 288 288">
        {/* Simplified compass base */}
        <Circle cx="144" cy="144" r="102" fill="#fff" stroke="#333" strokeWidth="2" />
        
        {/* Cardinal lines (simplified) */}
        <Rect x="142" y="42" width="4" height="204" fill="#333" />
        <Rect x="42" y="142" width="204" height="4" fill="#333" />
        
        {/* Outer ring */}
        <Circle cx="144" cy="144" r="112" fill="none" stroke="#333" strokeWidth="2.5" />
        
        {/* Inner decorative circle */}
        <Circle cx="144" cy="144" r="86" fill="none" stroke="#333" strokeWidth="1.5" />
        
        {/* Star points - simplified 8-point star */}
        <G id="Star">
          {/* Main 4 points */}
          <Polygon points="144,8 152,117 144,144 136,117" fill="#333" />
          <Polygon points="144,280 136,171 144,144 152,171" fill="#333" />
          <Polygon points="8,144 117,136 144,144 117,152" fill="#333" />
          <Polygon points="280,144 171,152 144,144 171,136" fill="#333" />
          
          {/* Diagonal points */}
          <Polygon points="64,64 120,128 144,144 128,120" fill="#333" />
          <Polygon points="224,64 160,120 144,144 168,128" fill="#333" />
          <Polygon points="64,224 128,168 144,144 120,160" fill="#333" />
          <Polygon points="224,224 168,160 144,144 160,168" fill="#333" />
        </G>
        
        {/* Center hub */}
        <Circle cx="144" cy="144" r="20" fill="#fff" stroke="#333" strokeWidth="2" />
        <Circle cx="144" cy="144" r="12" fill="#333" />
        <Circle cx="144" cy="144" r="6" fill="#fff" />
        
        {/* Gold Spindle - pointing North (0°) */}
        <G id="GoldSpindle">
          <Path
            d="M144,144 L140,60 L144,32 L148,60 Z"
            fill="#D4AF37"
            stroke="#8B7500"
            strokeWidth="1"
          />
          <Path
            d="M144,144 L148,228 L144,256 L140,228 Z"
            fill="#F5E6A3"
            stroke="#8B7500"
            strokeWidth="1"
          />
        </G>
        
        {/* Silver Spindle - pointing North (0°) */}
        <G id="SilverSpindle">
          <Path
            d="M144,144 L141,72 L144,48 L147,72 Z"
            fill="#C0C0C0"
            stroke="#808080"
            strokeWidth="0.5"
          />
          <Path
            d="M144,144 L147,216 L144,240 L141,216 Z"
            fill="#E8E8E8"
            stroke="#808080"
            strokeWidth="0.5"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});