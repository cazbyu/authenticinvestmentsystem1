// ============================================================================
// AlignmentCheckStep.tsx - Step 5 of Weekly Alignment (Alignment Check)
// ============================================================================
// Reflective moment between Goals Review and Tactical Deployment.
// Flow: PQ3 (honest mirror) → bridge → PQ5 (alignment check) → library offer → complete
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  selectPQ3Question,
  selectPQ5Question,
  savePQ3Response,
  savePQ5Response,
  addToPersonalLibrary,
  ensureWeeklyAlignmentRow,
  getBridgeMessage,
  type PowerQuestion,
  type PQ3Selection,
} from '@/lib/step5-alignment';
import { updateStepTimestamp } from '@/lib/weeklyAlignment';
import { AlignmentEscortCard } from './AlignmentEscortCard';

const ALIGNMENT_ACCENT = '#FF6B35';
const ALIGNMENT_LIGHT = '#FF6B3520';
const ALIGNMENT_BORDER = '#FF6B3540';

type AlignmentPhase = 'loading' | 'pq3' | 'bridge' | 'pq5' | 'library_offer' | 'complete';

interface AlignmentCheckStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onRegisterBackHandler: (handler: () => boolean) => void;
  guidedModeEnabled: boolean;
  weekStartDate: string;
  weekEndDate: string;
  weeklyAlignmentId: string | null;
  onAlignmentRowCreated: (id: string) => void;
}

export function AlignmentCheckStep({
  userId,
  colors,
  onNext,
  onBack,
  onRegisterBackHandler,
  guidedModeEnabled,
  weekStartDate,
  weekEndDate,
  weeklyAlignmentId,
  onAlignmentRowCreated,
}: AlignmentCheckStepProps) {
  const [phase, setPhase] = useState<AlignmentPhase>('loading');
  const [alignmentRowId, setAlignmentRowId] = useState<string | null>(weeklyAlignmentId);

  const [pq3Selection, setPq3Selection] = useState<PQ3Selection | null>(null);
  const [pq3Response, setPq3Response] = useState('');
  const [pq3Skipped, setPq3Skipped] = useState(false);
  const [pq3Saving, setPq3Saving] = useState(false);

  const [pq5Question, setPq5Question] = useState<PowerQuestion | null>(null);
  const [pq5Response, setPq5Response] = useState('');
  const [pq5Skipped, setPq5Skipped] = useState(false);
  const [pq5Saving, setPq5Saving] = useState(false);

  const [librarySaving, setLibrarySaving] = useState(false);
  const [libraryAdded, setLibraryAdded] = useState(false);

  useEffect(() => {
    initializeStep();
  }, []);

  useEffect(() => {
    onRegisterBackHandler(() => {
      if (phase === 'bridge' || phase === 'pq5' || phase === 'library_offer' || phase === 'complete') {
        return false;
      }
      if (phase === 'pq3') {
        return false;
      }
      return false;
    });
  }, [phase]);

  useEffect(() => {
    if (phase === 'complete') {
      const timer = setTimeout(() => {
        onNext();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  async function initializeStep() {
    let rowId = weeklyAlignmentId;
    if (!rowId) {
      rowId = await ensureWeeklyAlignmentRow(userId, weekStartDate, weekEndDate);
      if (rowId) {
        setAlignmentRowId(rowId);
        onAlignmentRowCreated(rowId);
      } else {
        console.error('Failed to create weekly alignment row');
        setPhase('complete');
        return;
      }
    }
    setAlignmentRowId(rowId);

    const pq3 = await selectPQ3Question(userId, weekStartDate);
    if (pq3) {
      setPq3Selection(pq3);
      setPhase('pq3');
      updateStepTimestamp(userId, weekStartDate, weekEndDate, 'step_5_started');
    } else {
      setPhase('complete');
    }
  }

  async function handlePQ3Submit() {
    if (!pq3Selection || !alignmentRowId) return;
    setPq3Saving(true);

    await savePQ3Response(
      userId,
      pq3Selection.question.id,
      pq3Response.trim(),
      weekStartDate,
      alignmentRowId
    );

    setPq3Saving(false);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setTimeout(() => setPhase('bridge'), 500);
  }

  function handlePQ3Skip() {
    setPq3Skipped(true);
    setPhase('bridge');
  }

  async function handleBridgeContinue() {
    const pq5 = await selectPQ5Question(userId, weekStartDate);

    if (pq5) {
      setPq5Question(pq5);
      setPhase('pq5');
    } else {
      setPhase(pq3Skipped ? 'complete' : 'library_offer');
    }
  }

  async function handlePQ5Submit() {
    if (!pq5Question || !alignmentRowId) return;
    setPq5Saving(true);

    await savePQ5Response(
      userId,
      pq5Question.id,
      pq5Response.trim(),
      weekStartDate,
      alignmentRowId
    );

    setPq5Saving(false);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!pq3Skipped && pq3Selection) {
      setPhase('library_offer');
    } else {
      setPhase('complete');
    }
  }

  function handlePQ5Skip() {
    setPq5Skipped(true);
    if (!pq3Skipped && pq3Selection) {
      setPhase('library_offer');
    } else {
      setPhase('complete');
    }
  }

  async function handleAddToLibrary() {
    if (!pq3Selection || !alignmentRowId) return;
    setLibrarySaving(true);

    const success = await addToPersonalLibrary(userId, pq3Selection.question, alignmentRowId);

    setLibrarySaving(false);
    setLibraryAdded(success);

    if (success && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setTimeout(() => setPhase('complete'), 1500);
  }

  function handleSkipLibrary() {
    setPhase('complete');
  }

  function renderQuestionCard(
    question: PowerQuestion,
    response: string,
    setResponse: (v: string) => void,
    onSubmit: () => void,
    onSkip: () => void,
    submitLabel: string,
    placeholder: string,
    saving: boolean
  ) {
    const canSubmit = response.trim().length >= 20;
    // Filter out "Focus: The Target..." and similar boilerplate - only show genuine context
    const displayContext = question.question_context?.startsWith('Focus:') ||
      question.question_context?.includes('The Target. Examples:')
      ? null
      : question.question_context;

    return (
      <View style={[styles.questionCard, { backgroundColor: colors.surface }]}>
        {displayContext && (
          <Text style={styles.contextText}>{displayContext}</Text>
        )}
        <Text style={styles.questionText}>{question.question_text}</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: '#E5E7EB',
              color: colors.text,
              backgroundColor: colors.background,
            },
          ]}
          value={response}
          onChangeText={setResponse}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !canSubmit && styles.primaryButtonDisabled,
          ]}
          onPress={onSubmit}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipLink} onPress={onSkip} disabled={saving}>
          <Text style={[styles.skipLinkText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBridge() {
    const message = getBridgeMessage(
      pq3Selection?.question.role_name || null,
      pq3Skipped
    );

    return (
      <View style={styles.bridgeContainer}>
        <Text style={styles.bridgeEmoji}>🪞</Text>
        <Text style={[styles.bridgeMessage, { color: colors.text }]}>{message}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleBridgeContinue}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderLibraryOffer() {
    return (
      <View style={[styles.questionCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.libraryTitle, { color: colors.text }]}>
          Want to revisit this question regularly?
        </Text>
        {pq3Selection && (
          <Text style={[styles.libraryQuestion, { color: colors.textSecondary }]}>
            "{pq3Selection.question.question_text}"
          </Text>
        )}
        {libraryAdded ? (
          <Text style={[styles.libraryConfirmation, { color: '#10b981' }]}>
            ✓ Added to your questions
          </Text>
        ) : (
          <View style={styles.libraryButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAddToLibrary}
              disabled={librarySaving}
            >
              {librarySaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Add to My Questions</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleSkipLibrary}
              disabled={librarySaving}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Not now
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderComplete() {
    return (
      <View style={styles.completeContainer}>
        <Text style={styles.completeEmoji}>✅</Text>
        <Text style={[styles.completeTitle, { color: colors.text }]}>
          Your compass is calibrated.
        </Text>
        <Text style={[styles.completeSubtitle, { color: colors.textSecondary }]}>
          Now let's put it into action...
        </Text>
      </View>
    );
  }

  if (phase === 'loading') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ALIGNMENT_ACCENT} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Preparing your alignment check...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header - matching TacticalDeploymentStep pattern */}
        {(phase === 'pq3' || phase === 'pq5' || phase === 'bridge' || phase === 'library_offer' || phase === 'complete') && (
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.iconContainer, { backgroundColor: ALIGNMENT_LIGHT }]}>
                <Text style={styles.headerEmoji}>🪞</Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.headerStepLabel, { color: ALIGNMENT_ACCENT }]}>Step 5</Text>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Alignment Check</Text>
                <Text style={styles.headerSubtitle}>Where am I going?</Text>
              </View>
            </View>
          </View>
        )}

        {/* Escort card - PQ3 and PQ5 phases only */}
        {guidedModeEnabled && phase === 'pq3' && (
          <AlignmentEscortCard
            type="nudge"
            message="This is your honest mirror. Read the question below and reflect on what your actions — not your intentions — actually say."
            stepColor={ALIGNMENT_ACCENT}
          />
        )}
        {guidedModeEnabled && phase === 'pq5' && (
          <AlignmentEscortCard
            type="nudge"
            message="Now look forward. What's one concrete thing you can commit to this week?"
            stepColor={ALIGNMENT_ACCENT}
          />
        )}

        {phase === 'pq3' &&
          pq3Selection &&
          renderQuestionCard(
            pq3Selection.question,
            pq3Response,
            setPq3Response,
            handlePQ3Submit,
            handlePQ3Skip,
            'Reflect & Continue',
            'Be honest with yourself...',
            pq3Saving
          )}

        {phase === 'bridge' && renderBridge()}

        {phase === 'pq5' &&
          pq5Question &&
          renderQuestionCard(
            pq5Question,
            pq5Response,
            setPq5Response,
            handlePQ5Submit,
            handlePQ5Skip,
            'Commit & Continue',
            "What's one thing you can do this week...",
            pq5Saving
          )}

        {phase === 'library_offer' && renderLibraryOffer()}

        {phase === 'complete' && renderComplete()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 36,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerStepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contextText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
    lineHeight: 26,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    minHeight: 100,
    padding: 16,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipLink: {
    marginTop: 12,
    alignSelf: 'center',
  },
  skipLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  bridgeContainer: {
    alignItems: 'center',
    padding: 24,
  },
  bridgeEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  bridgeMessage: {
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  libraryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  libraryQuestion: {
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 20,
    lineHeight: 22,
  },
  libraryConfirmation: {
    fontSize: 16,
    fontWeight: '600',
  },
  libraryButtons: {
    gap: 12,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  completeContainer: {
    alignItems: 'center',
    padding: 48,
  },
  completeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});
