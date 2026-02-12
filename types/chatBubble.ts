/**
 * Chat Bubble v9 - TypeScript interfaces
 */

import type { CaptureType, RitualType } from '@/constants/chatBubble';

export interface CaptureData {
  title: string;
  role?: string;
  wellness?: string[];
  relationships?: string[];
  goalLink?: {
    name: string;
    type: '12wk' | 'custom';
    id?: string;
  };
  date?: string;
  time?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'capture_offer' | 'system';
  captureType?: CaptureType;
  captureData?: CaptureData;
  sequenceNumber: number;
  createdAt: string;
}

export interface RitualSession {
  id: string;
  userId: string;
  ritualType: RitualType;
  sessionDate: string;
  fuelLevel?: 1 | 2 | 3;
  fuelReason?: string;
  status: 'active' | 'completed' | 'abandoned';
}

export interface ConversationSummary {
  id: string;
  sessionId: string;
  summaryText: string;
  keyCommitments: string[];
  patternsNoted: string[];
  generatedAt: string;
}
