import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface DraggableFabProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  size?: number;
  backgroundColor?: string;
}

export function DraggableFab({
  onPress,
  children,
  style,
  size = 56,
  backgroundColor
}: DraggableFabProps) {
  const { colors } = useTheme();
  const fabBackgroundColor = backgroundColor || colors.primary;

  const [position, setPosition] = useState({ x: window.innerWidth - 76, y: window.innerHeight - 156 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const totalDragDistance = useRef(0);

  const handleMouseDown = useCallback((e: any) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    totalDragDistance.current = 0;
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    totalDragDistance.current = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;

    const clampedX = Math.max(0, Math.min(window.innerWidth - size, newX));
    const clampedY = Math.max(0, Math.min(window.innerHeight - size, newY));

    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging, size]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (totalDragDistance.current < 5) {
      onPress();
      return;
    }

    const screenWidth = window.innerWidth;
    const fabCenterX = position.x + size / 2;

    const snapToRight = fabCenterX > screenWidth / 2;
    const newX = snapToRight ? screenWidth - size - 20 : 20;

    setPosition({ x: newX, y: position.y });
  }, [isDragging, position, size, onPress]);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <View
      onMouseDown={handleMouseDown}
      style={[
        styles.fab,
        {
          left: position.x,
          top: position.y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fabBackgroundColor,
          cursor: isDragging ? 'grabbing' : 'grab',
          transform: isDragging ? 'scale(1.1)' : 'scale(1)',
          transition: isDragging ? 'none' : 'all 0.3s ease',
        } as any,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
});
