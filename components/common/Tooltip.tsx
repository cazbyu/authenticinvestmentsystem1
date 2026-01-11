import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const showTooltip = () => setVisible(true);
  const hideTooltip = () => setVisible(false);

  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.container}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {children}
        {visible && (
          <View style={[styles.tooltip, { backgroundColor: '#1f2937' }]}>
            <Text style={styles.tooltipText}>{content}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onLongPress={showTooltip}
        delayLongPress={500}
        activeOpacity={0.9}
      >
        {children}
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideTooltip}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={hideTooltip}
        >
          <View style={[styles.modalTooltip, { backgroundColor: '#1f2937' }]}>
            <Text style={styles.tooltipText}>{content}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: 8 }],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    maxWidth: 200,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalTooltip: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
