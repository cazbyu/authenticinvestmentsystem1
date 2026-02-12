/**
 * YourGuideContainer - Your Guide panel + FAB for non-ritual screens
 * Dashboard, Role Bank, Wellness Bank.
 * NOT for: Weekly Alignment, Morning Spark, Evening Review, Goal Bank.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { saveCapture } from '@/lib/chatBubbleService';
import { YourGuidePanel } from './YourGuidePanel';
import { CaptureOverlay } from '@/components/chat-bubble/CaptureOverlay';
import type { CaptureType } from '@/constants/chatBubble';
import type { CaptureData } from '@/types/chatBubble';

interface YourGuideContainerProps {
  screenContext: string;
  userId: string | null;
  guideEnabled?: boolean;
  onOpenCaptureSelector?: () => void;
}

export function YourGuideContainer({
  screenContext,
  userId,
  guideEnabled = true,
  onOpenCaptureSelector,
}: YourGuideContainerProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [captureOverlay, setCaptureOverlay] = useState<{
    type: CaptureType;
    data: CaptureData;
  } | null>(null);

  const handleFabPress = () => {
    if (!guideEnabled && onOpenCaptureSelector) {
      onOpenCaptureSelector();
      return;
    }
    setChatOpen(true);
  };

  const handleSaveCapture = useCallback(
    async (captureType: CaptureType, data: CaptureData) => {
      if (!userId) return;
      try {
        const supabase = getSupabaseClient();
        const { data: session } = await supabase
          .from('0008-ap-ritual-sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('ritual_type', 'guide')
          .eq('session_date', new Date().toISOString().split('T')[0])
          .maybeSingle();

        await saveCapture(userId, session?.id ?? null, captureType, data);
        setCaptureOverlay(null);
      } catch (err) {
        console.error('[YourGuide] save capture error:', err);
      }
    },
    [userId]
  );

  const showFab = !chatOpen && userId;

  return (
    <>
      {/* Single FAB - 💬 when closed, hidden when chat open */}
      {showFab && (guideEnabled || onOpenCaptureSelector) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleFabPress}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>💬</Text>
        </TouchableOpacity>
      )}

      {/* Your Guide Panel with sidebar */}
      {chatOpen && userId && guideEnabled && (
        <View style={styles.panelBackdrop} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={() => setChatOpen(false)}
          />
          <YourGuidePanel
            userId={userId}
            screenContext={screenContext}
            onClose={() => setChatOpen(false)}
            onOpenCaptureOverlay={(type, data) => setCaptureOverlay({ type, data })}
          />
        </View>
      )}

      {/* Capture Overlay - from sidebar or chat offer */}
      {captureOverlay && (
        <CaptureOverlay
          visible={!!captureOverlay}
          captureType={captureOverlay.type}
          initialData={captureOverlay.data}
          ritualType="weekly"
          onSave={handleSaveCapture}
          onCancel={() => setCaptureOverlay(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ed1c24',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  fabIcon: {
    fontSize: 28,
  },
  panelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
