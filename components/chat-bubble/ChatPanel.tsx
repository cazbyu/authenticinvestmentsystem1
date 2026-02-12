/**
 * ChatPanel - Main chat interface for AI coaching
 * Conversation continuity, capture offers, message flow
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getOrCreateSession,
  loadSessionMessages,
  saveMessage,
  gatherUserContext,
} from '@/lib/chatBubbleService';
import type { ChatMessage, CaptureData } from '@/types/chatBubble';
import type { RitualType } from '@/constants/chatBubble';
import { RITUAL_META } from '@/constants/chatBubble';
import type { CaptureType } from '@/constants/chatBubble';

interface ChatPanelProps {
  userId: string;
  ritualType: RitualType;
  fuelLevel?: 1 | 2 | 3 | null;
  fuelReason?: string | null;
  onClose: () => void;
  onOpenCaptureOverlay?: (captureType: CaptureType, data: CaptureData) => void;
}

export function ChatPanel({
  userId,
  ritualType,
  fuelLevel = null,
  fuelReason = null,
  onClose,
  onOpenCaptureOverlay,
}: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  const meta = RITUAL_META[ritualType];

  useEffect(() => {
    initSession();
  }, []);

  async function initSession() {
    try {
      const session = await getOrCreateSession(
        userId,
        ritualType,
        fuelLevel ?? undefined,
        fuelReason ?? undefined
      );
      setSessionId(session.id);

      const existing = await loadSessionMessages(session.id);
      if (existing.length > 0) {
        setMessages(existing);
        setLoading(false);
        return;
      }

      const ctx = await gatherUserContext(userId);
      setUserContext(ctx);

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('coaching-chat', {
        body: {
          messages: [{ role: 'user', content: 'I just opened the coaching chat.' }],
          ritualType,
          fuelLevel: fuelLevel ?? null,
          fuelReason: fuelReason ?? null,
          userContext: ctx,
        },
      });

      if (error) throw error;

      const text = data?.text || "Hey. I'm here to help you align your actions with what matters. What's on your mind?";
      const seq = 1;

      await saveMessage(session.id, userId, {
        role: 'assistant',
        content: text,
        messageType: 'text',
        sequenceNumber: seq,
      });

      setMessages([
        {
          id: `gen-${Date.now()}`,
          role: 'assistant',
          content: text,
          messageType: 'text',
          sequenceNumber: seq,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error('[ChatPanel] init error:', err);
      setMessages([
        {
          id: 'fallback',
          role: 'assistant',
          content: "Hey. I'm here when you need to talk. What's on your mind?",
          messageType: 'text',
          sequenceNumber: 1,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId || sending) return;

    setInput('');
    setSending(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      messageType: 'text',
      sequenceNumber: messages.length + 1,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    try {
      await saveMessage(sessionId, userId, {
        role: 'user',
        content: text,
        messageType: 'text',
        sequenceNumber: userMsg.sequenceNumber,
      });

      const ctx = userContext || (await gatherUserContext(userId));
      if (!userContext) setUserContext(ctx);

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('coaching-chat', {
        body: {
          messages: history,
          ritualType,
          fuelLevel: fuelLevel ?? null,
          fuelReason: fuelReason ?? null,
          userContext: ctx,
        },
      });

      if (error) throw error;

      const replyText = data?.text || "I hear you. Tell me more.";
      const captures = data?.captures || [];
      const nextSeq = messages.length + 2;

      await saveMessage(sessionId, userId, {
        role: 'assistant',
        content: replyText,
        messageType: captures.length ? 'capture_offer' : 'text',
        captureType: captures[0]?.captureType,
        captureData: captures[0]?.data,
        sequenceNumber: nextSeq,
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        messageType: captures.length ? 'capture_offer' : 'text',
        captureType: captures[0]?.captureType,
        captureData: captures[0]?.data,
        sequenceNumber: nextSeq,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);

      if (captures.length > 0 && onOpenCaptureOverlay) {
        // Show capture offer in UI - parent can open overlay on accept
      }
    } catch (err) {
      console.error('[ChatPanel] send error:', err);
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I hit a snag. Try again in a moment.",
          messageType: 'text',
          sequenceNumber: messages.length + 2,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleAcceptCapture(msg: ChatMessage) {
    if (msg.captureType && msg.captureData && onOpenCaptureOverlay) {
      onOpenCaptureOverlay(msg.captureType, msg.captureData);
    }
  }

  if (loading) {
    return (
      <View style={[styles.panel, styles.loadingPanel]}>
        <ActivityIndicator size="large" color={meta.color} />
        <Text style={styles.loadingText}>Starting your coaching session...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.panel}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{meta.icon}</Text>
          <View>
            <Text style={styles.headerTitle}>Alignment Coach</Text>
            <Text style={styles.headerSubtitle}>{meta.label}</Text>
          </View>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: meta.color }]}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={styles.bubbleText}>{msg.content}</Text>
            {msg.messageType === 'capture_offer' && msg.captureType && (
              <View style={styles.captureOffer}>
                <TouchableOpacity
                  style={[styles.captureBtn, styles.captureAccept]}
                  onPress={() => handleAcceptCapture(msg)}
                >
                  <Text style={styles.captureBtnText}>✓ Yes, capture it</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.captureBtn, styles.captureSkip]}>
                  <Text style={styles.captureSkipText}>Not now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        {sending && (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? '#ed1c24' : '#9ca3af' },
          ]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 70,
    left: 12,
    right: 12,
    height: '65%',
    maxHeight: 500,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  loadingPanel: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d4a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#ed1c24',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#2d2d4a',
  },
  bubbleText: {
    color: '#fff',
    fontSize: 15,
  },
  captureOffer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  captureBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  captureAccept: {
    backgroundColor: '#10b981',
  },
  captureBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  captureSkip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280',
  },
  captureSkipText: {
    color: '#9ca3af',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2d2d4a',
  },
  input: {
    flex: 1,
    backgroundColor: '#2d2d4a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    maxHeight: 120,
  },
  sendBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
  },
});
