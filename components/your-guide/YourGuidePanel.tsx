/**
 * YourGuidePanel - Chat with capture sidebar
 * Helps users understand the app and get the most from it.
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
import { getSupabaseClient } from '@/lib/supabase';
import {
  getOrCreateGuideSession,
  loadSessionMessages,
  saveMessage,
  gatherUserContext,
} from '@/lib/chatBubbleService';
import type { ChatMessage, CaptureData } from '@/types/chatBubble';
import type { CaptureType } from '@/constants/chatBubble';

const SIDEBAR_CAPTURE_TYPES: { type: CaptureType; icon: string; label: string; color: string }[] = [
  { type: 'task', icon: '✓', label: 'Task', color: '#4A90D9' },
  { type: 'event', icon: '📅', label: 'Event', color: '#E8963A' },
  { type: 'deposit_idea', icon: '💡', label: 'Idea', color: '#FFC107' },
  { type: 'rose', icon: '🌹', label: 'Rose', color: '#E91E63' },
  { type: 'thorn', icon: '🌵', label: 'Thorn', color: '#795548' },
  { type: 'reflection', icon: '💭', label: 'Refl.', color: '#5C6BC0' },
];

interface YourGuidePanelProps {
  userId: string;
  screenContext: string;
  onClose: () => void;
  onOpenCaptureOverlay?: (captureType: CaptureType, data: CaptureData) => void;
}

export function YourGuidePanel({
  userId,
  screenContext,
  onClose,
  onOpenCaptureOverlay,
}: YourGuidePanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    initSession();
  }, []);

  async function initSession() {
    try {
      const session = await getOrCreateGuideSession(userId, screenContext);
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
          messages: [{ role: 'user', content: 'I just opened Your Guide.' }],
          ritualType: 'guide',
          screenContext,
          userContext: ctx,
        },
      });

      if (error) throw error;

      const text =
        data?.text ||
        "Hi! I'm Your Guide — think of me as a knowledgeable friend who knows every feature here. Ask me how anything works, or tap the icons on the left to capture a task, event, rose, thorn, idea, or reflection. What would you like to explore?";
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
      console.error('[YourGuidePanel] init error:', err);
      setMessages([
        {
          id: 'fallback',
          role: 'assistant',
          content: "Hi! I'm here to help. What would you like to know?",
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
          ritualType: 'guide',
          screenContext,
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
    } catch (err) {
      console.error('[YourGuidePanel] send error:', err);
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

  function handleSidebarCapture(type: CaptureType) {
    if (onOpenCaptureOverlay) {
      onOpenCaptureOverlay(type, { title: '' });
    }
  }

  if (loading) {
    return (
      <View style={[styles.panel, styles.loadingPanel]}>
        <ActivityIndicator size="large" color="#ed1c24" />
        <Text style={styles.loadingText}>Starting Your Guide...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.panel}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header - full width */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>💬</Text>
          <View>
            <Text style={styles.headerTitle}>Your Guide</Text>
            <Text style={styles.headerSubtitle}>{screenContext}</Text>
          </View>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Middle: Sidebar + Chat */}
      <View style={styles.middleRow}>
        {/* Capture Sidebar - left ~20% */}
        <View style={styles.sidebar}>
          {SIDEBAR_CAPTURE_TYPES.map((item) => (
            <TouchableOpacity
              key={item.type}
              style={styles.sidebarBtn}
              onPress={() => handleSidebarCapture(item.type)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sidebarIcon, { color: item.color }]}>{item.icon}</Text>
              <Text style={styles.sidebarLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chat area - right ~80% */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
      </View>

      {/* Input - full width */}
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
          style={[styles.sendBtn, { backgroundColor: input.trim() ? '#ed1c24' : '#9ca3af' }]}
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
    bottom: 24,
    left: 12,
    right: 12,
    height: '65%',
    maxHeight: 520,
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
    backgroundColor: '#ed1c24',
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
  middleRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: '20%',
    minWidth: 56,
    backgroundColor: '#232340',
    borderRightWidth: 1,
    borderRightColor: '#2d2d4a',
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sidebarBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sidebarIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  sidebarLabel: {
    fontSize: 9,
    color: '#9ca3af',
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
