/**
 * ChatBubbleContainer - Wraps FAB, Panel, Gauge, and Overlay
 * Integrates into ritual screens (weekly alignment, morning spark, evening review)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { saveCapture } from '@/lib/chatBubbleService';
import type { RitualType } from '@/constants/chatBubble';
import { RITUAL_META } from '@/constants/chatBubble';
import { MorningSparkGauge } from './MorningSparkGauge';
import { ChatPanel } from './ChatPanel';
import { CaptureOverlay } from './CaptureOverlay';
import { ChatBubbleFAB } from './ChatBubbleFAB';
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
}

export function ChatBubbleContainer({
  ritualType,
  userId,
}: ChatBubbleContainerProps) {
  const { colors } = useTheme();
  const [chatOpen, setChatOpen] = useState(false);
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

  const showFAB = ritualType === 'morning' ? morningGaugeComplete : true;

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

      {showFAB && (
        <ChatBubbleFAB
          isOpen={chatOpen}
          onPress={() => setChatOpen((o) => !o)}
          ritualColor={RITUAL_META[ritualType].color}
          hasNotification={false}
          visible={!!userId}
        />
      )}

      {chatOpen && userId && (
        <ChatPanel
          userId={userId}
          ritualType={ritualType}
          fuelLevel={morningFuel}
          fuelReason={morningReason}
          onClose={() => setChatOpen(false)}
          onOpenCaptureOverlay={(type, data) =>
            setCaptureOverlay({ type, data })
          }
        />
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
