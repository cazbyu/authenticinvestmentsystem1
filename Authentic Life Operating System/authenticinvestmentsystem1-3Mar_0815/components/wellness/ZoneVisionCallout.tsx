import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * ZoneVisionCallout — Minimalist Executive design system
 * Cream callout that displays the zone-vision question (read from
 * 0008-ap-power-questions) and the user's saved answer (read/written
 * to 0008-ap-question-responses with context_type='zone_landing').
 */

export interface ZoneVisionCalloutProps {
  domainId: string;   // 0008-ap-domains.id (FK target for wellness_zone_id)
  zoneName: string;   // e.g. 'Physical' — lowercased for question lookup
  userId: string;     // current authenticated user id
}

interface QuestionRow {
  id: string;
  question_text: string;
  compass_coordinate_id: string | null;
}

export function ZoneVisionCallout({
  domainId,
  zoneName,
  userId,
}: ZoneVisionCalloutProps) {
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch: question row + most recent answer
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const wellnessZone = zoneName.toLowerCase();

        const { data: qData, error: qErr } = await supabase
          .from('0008-ap-power-questions')
          .select('id, question_text, compass_coordinate_id')
          .eq('power_question_id', 3)
          .eq('app_output', 'vision')
          .eq('context_level', 'zone')
          .eq('wellness_zone', wellnessZone)
          .maybeSingle();

        if (cancelled) return;
        if (qErr) throw qErr;
        if (!qData) {
          setQuestion(null);
          setAnswer(null);
          setError('Vision question not available.');
          return;
        }
        setQuestion(qData as QuestionRow);

        const { data: aData, error: aErr } = await supabase
          .from('0008-ap-question-responses')
          .select('response_text')
          .eq('user_id', userId)
          .eq('question_id', qData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (aErr) throw aErr;
        setAnswer(aData?.response_text ?? null);
        setDraft(aData?.response_text ?? '');
      } catch (e: any) {
        if (!cancelled) {
          console.error('[ZoneVisionCallout] load failed', e);
          setError('Could not load your vision.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [domainId, zoneName, userId]);

  // Reset draft if answer changes externally
  useEffect(() => {
    if (!editing) setDraft(answer ?? '');
  }, [answer, editing]);

  const handleBlur = useCallback(async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (answer ?? '').trim()) return;
    if (!question) return;

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error: insertErr } = await supabase
        .from('0008-ap-question-responses')
        .insert({
          user_id: userId,
          question_id: question.id,
          response_text: trimmed,
          context_type: 'zone_landing',
          domain: 'wellness',
          wellness_zone_id: domainId,
          compass_coordinate_id: question.compass_coordinate_id,
          slot_code: 'wellness',
          week_start: null,
        });
      if (insertErr) throw insertErr;
      setAnswer(trimmed);
    } catch (e: any) {
      console.error('[ZoneVisionCallout] save failed', e);
      Alert.alert('Save failed', 'Your vision could not be saved. Please try again.');
      // Keep the typed text so the user does not lose work
      setDraft(trimmed);
    } finally {
      setSaving(false);
    }
  }, [draft, answer, question, userId, domainId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>VISION FOR THIS ZONE</Text>
        <View style={styles.skeletonPrompt} />
        <View style={styles.skeletonAnswer} />
      </View>
    );
  }

  if (error && !question) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>VISION FOR THIS ZONE</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const hasAnswer = (answer ?? '').trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>VISION FOR THIS ZONE</Text>
      <Text style={styles.prompt}>{question?.question_text}</Text>

      {editing ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={handleBlur}
          multiline
          style={styles.input}
          placeholder="Tap to write your vision"
          placeholderTextColor="#9ca3af"
        />
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.answerPress}>
          {hasAnswer ? (
            <Text style={styles.answer}>{answer}</Text>
          ) : (
            <Text style={styles.placeholder}>Tap to write your vision</Text>
          )}
        </Pressable>
      )}

      {!editing && (
        <View style={styles.hintRow}>
          {saving ? (
            <>
              <ActivityIndicator size="small" color="#92400e" />
              <Text style={styles.hint}>Saving…</Text>
            </>
          ) : (
            <Text style={styles.hint}>Tap to edit</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffbeb',
    borderLeftColor: '#d97706',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  prompt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 20,
  },
  answerPress: {
    minHeight: 24,
    justifyContent: 'center',
  },
  answer: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#111827',
    lineHeight: 20,
  },
  placeholder: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#9ca3af',
    lineHeight: 20,
  },
  input: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#111827',
    lineHeight: 20,
    minHeight: 24,
    padding: 0,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  hint: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
  errorText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  skeletonPrompt: {
    height: 16,
    width: '85%',
    backgroundColor: '#fde68a',
    borderRadius: 4,
    marginBottom: 8,
    opacity: 0.5,
  },
  skeletonAnswer: {
    height: 14,
    width: '60%',
    backgroundColor: '#fde68a',
    borderRadius: 4,
    opacity: 0.4,
  },
});
