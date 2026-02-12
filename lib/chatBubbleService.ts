/**
 * Chat Bubble v9 - Service layer
 * Session, message, capture management and context gathering
 */

import { getSupabaseClient } from '@/lib/supabase';
import type { ChatMessage, RitualSession, CaptureData } from '@/types/chatBubble';
import type { CaptureType, RitualType } from '@/constants/chatBubble';

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function getOrCreateSession(
  userId: string,
  ritualType: RitualType,
  fuelLevel?: number,
  fuelReason?: string
): Promise<RitualSession> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('ritual_type', ritualType)
    .eq('session_date', today)
    .maybeSingle();

  if (existing) {
    if (ritualType === 'morning' && fuelLevel !== undefined && existing.fuel_level == null) {
      await supabase
        .from('0008-ap-ritual-sessions')
        .update({
          fuel_level: fuelLevel,
          fuel_reason: fuelReason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }
    return existing as RitualSession;
  }

  const { data: newSession, error } = await supabase
    .from('0008-ap-ritual-sessions')
    .insert({
      user_id: userId,
      ritual_type: ritualType,
      session_date: today,
      fuel_level: fuelLevel ?? null,
      fuel_reason: fuelReason ?? null,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return newSession as RitualSession;
}

export async function getOrCreateGuideSession(
  userId: string,
  screenContext: string
): Promise<RitualSession> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('ritual_type', 'guide')
    .eq('session_date', today)
    .maybeSingle();

  if (existing) {
    if (screenContext && existing.screen_context !== screenContext) {
      await supabase
        .from('0008-ap-ritual-sessions')
        .update({ screen_context: screenContext, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing as RitualSession;
  }

  const { data: newSession, error } = await supabase
    .from('0008-ap-ritual-sessions')
    .insert({
      user_id: userId,
      ritual_type: 'guide',
      session_date: today,
      screen_context: screenContext,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return newSession as RitualSession;
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

export async function loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('0008-ap-conversation-messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    messageType: row.message_type,
    captureType: row.capture_type,
    captureData: row.capture_data,
    sequenceNumber: row.sequence_number,
    createdAt: row.created_at,
  }));
}

export async function saveMessage(
  sessionId: string,
  userId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    messageType: 'text' | 'capture_offer' | 'system';
    captureType?: string;
    captureData?: CaptureData;
    sequenceNumber: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('0008-ap-conversation-messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: message.role,
    content: message.content,
    message_type: message.messageType,
    capture_type: message.captureType ?? null,
    capture_data: message.captureData ?? null,
    sequence_number: message.sequenceNumber,
  });

  if (error) throw error;
}

// ============================================
// CAPTURE MANAGEMENT
// ============================================

export async function saveCapture(
  userId: string,
  sessionId: string | null,
  captureType: CaptureType,
  data: CaptureData
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: inserted, error } = await supabase
    .from('0008-ap-captures')
    .insert({
      user_id: userId,
      session_id: sessionId,
      capture_type: captureType,
      title: data.title,
      notes: data.notes ?? null,
      role: data.role ?? null,
      wellness_zones: data.wellness ?? [],
      relationships: data.relationships ?? [],
      goal_link: data.goalLink ?? null,
      due_date: captureType === 'task' && data.date ? data.date : null,
      event_date: captureType === 'event' && data.date ? data.date : null,
      event_time: captureType === 'event' && data.time ? data.time : null,
      source: 'chat',
    })
    .select('id')
    .single();

  if (error) throw error;
  return inserted.id;
}

// ============================================
// CONTEXT GATHERING FOR AI
// ============================================

function normalizeCoreValues(cv: unknown): string[] {
  if (!cv) return [];
  if (Array.isArray(cv)) {
    return cv.map((v) => (typeof v === 'object' && v && 'name' in v ? String((v as any).name) : String(v)));
  }
  return [];
}

export async function gatherUserContext(userId: string): Promise<{
  northStar: { mission: string | null; vision: string | null; coreValues: string[] };
  recentTaskStats: { completed: number; total: number; topRole: string | null };
  activeStreaks: string[];
  recentSummaries: string[];
  topRolesThisWeek: string[];
  wellnessGaps: string[];
  overdueItems: string[];
}> {
  const supabase = getSupabaseClient();

  const { data: ns } = await supabase
    .from('0008-ap-north-star')
    .select('mission_statement, "5yr_vision", core_values')
    .eq('user_id', userId)
    .maybeSingle();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const { data: recentCaptures } = await supabase
    .from('0008-ap-captures')
    .select('capture_type, is_completed, role')
    .eq('user_id', userId)
    .eq('capture_type', 'task')
    .gte('created_at', weekAgoStr);

  const tasks = recentCaptures || [];
  const completed = tasks.filter((t: any) => t.is_completed).length;
  const roleCounts: Record<string, number> = {};
  tasks.forEach((t: any) => {
    if (t.role) roleCounts[t.role] = (roleCounts[t.role] || 0) + 1;
  });
  const topRole =
    Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 28);
  const { data: summaries } = await supabase
    .from('0008-ap-conversation-summaries')
    .select('summary_text')
    .eq('user_id', userId)
    .gte('generated_at', monthAgo.toISOString())
    .order('generated_at', { ascending: false })
    .limit(8);

  const { data: weekCaptures } = await supabase
    .from('0008-ap-captures')
    .select('role')
    .eq('user_id', userId)
    .gte('created_at', weekAgoStr)
    .not('role', 'is', null);

  const allRoleCounts: Record<string, number> = {};
  (weekCaptures || []).forEach((c: any) => {
    if (c.role) allRoleCounts[c.role] = (allRoleCounts[c.role] || 0) + 1;
  });
  const topRolesThisWeek = Object.entries(allRoleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([role]) => role);

  const today = new Date().toISOString().split('T')[0];
  const { data: overdue } = await supabase
    .from('0008-ap-captures')
    .select('title, role, due_date')
    .eq('user_id', userId)
    .eq('capture_type', 'task')
    .eq('is_completed', false)
    .lt('due_date', today)
    .limit(5);

  return {
    northStar: {
      mission: ns?.mission_statement ?? null,
      vision: (ns as any)?.['5yr_vision'] ?? null,
      coreValues: normalizeCoreValues(ns?.core_values),
    },
    recentTaskStats: { completed, total: tasks.length, topRole },
    activeStreaks: [],
    recentSummaries: (summaries || []).map((s: any) => s.summary_text),
    topRolesThisWeek,
    wellnessGaps: [],
    overdueItems: (overdue || []).map(
      (o: any) => `${o.title} (${o.role || 'No role'}, due ${o.due_date})`
    ),
  };
}

// ============================================
// SESSION COMPLETION
// ============================================

export async function completeSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('0008-ap-ritual-sessions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}
