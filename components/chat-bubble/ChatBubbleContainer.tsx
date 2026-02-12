/**
 * ChatBubbleContainer - Manages ChatPanel, Gauge, and CaptureOverlay
 * FAB lives in parent; parent opens coach via FAB menu and passes chatOpen.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { saveCapture } from '@/lib/chatBubbleService';
import type { RitualType } from '@/constants/chatBubble';
import { MorningSparkGauge } from './MorningSparkGauge';
import { ChatPanel } from './ChatPanel';
import { CaptureOverlay } from './CaptureOverlay';
import type { CaptureType } from '@/constants/chatBubble';
import type { CaptureData } from '@/types/chatBubble';

export function detectActiveRitual(): RitualType {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  if (day === 0) return 'weekly';
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 17) return 'evening';
  return 'morning';
}

interface ChatBubbleContainerProps {
  ritualType: RitualType;
  userId: string | null;
  /** Coach panel visibility — controlled by parent (FAB menu) */
  chatOpen: boolean;
  onCloseChat: () => void;
}

export function ChatBubbleContainer({
  ritualType,
  userId,
  chatOpen,
  onCloseChat,
}: ChatBubbleContainerProps) {
  const { colors } = useTheme();
  const [morningGaugeComplete, setMorningGaugeComplete] = useState(
    ritualType !== 'morning'
  );
  const [morningFuel, setMorningFuel] = useState<1 | 2 | 3 | null>(null);
  const [morningReason, setMorningReason] = useState<string | null>(null);
  const [captureOverlay, setCaptureOverlay] = useState<{
    type: CaptureType;
    data: CaptureData;
  } | null>(null);

  const handleGaugeComplete = useCallback((level: 1 | 2 | 3, reasonId: string) => {
    setMorningFuel(level);
    setMorningReason(reasonId);
    setMorningGaugeComplete(true);
  }, []);

  const handleSaveCapture = useCallback(
    async (captureType: CaptureType, data: CaptureData) => {
      if (!userId) return;
      try {
        const supabase = getSupabaseClient();
        const { data: session } = await supabase
          .from('0008-ap-ritual-sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('ritual_type', ritualType)
          .eq('session_date', new Date().toISOString().split('T')[0])
          .maybeSingle();

        await saveCapture(userId, session?.id ?? null, captureType, data);
        setCaptureOverlay(null);
      } catch (err) {
        console.error('[ChatBubble] save capture error:', err);
      }
    },
    [userId, ritualType]
  );

  return (
    <>
      {ritualType === 'morning' && !morningGaugeComplete && (
        <View style={styles.gaugeWrapper}>
          <MorningSparkGauge
            onComplete={handleGaugeComplete}
            colors={colors}
          />
        </View>
      )}

      {chatOpen && userId && (
        <View style={styles.panelBackdrop} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={onCloseChat}
          />
          <ChatPanel
            userId={userId}
            ritualType={ritualType}
            fuelLevel={morningFuel}
            fuelReason={morningReason}
            onClose={onCloseChat}
            onOpenCaptureOverlay={(type, data) =>
              setCaptureOverlay({ type, data })
            }
          />
        </View>
      )}

      {captureOverlay && (
        <CaptureOverlay
          visible={!!captureOverlay}
          captureType={captureOverlay.type}
          initialData={captureOverlay.data}
          ritualType={ritualType}
          onSave={handleSaveCapture}
          onCancel={() => setCaptureOverlay(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gaugeWrapper: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});
