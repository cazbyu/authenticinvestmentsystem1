/**
 * useAlignmentCoach - Hook for managing AI coach interactions
 * during the Weekly Alignment ritual.
 *
 * Handles:
 * - One-way guidance (step enter/idle/complete/skip/return)
 * - Two-way conversation (user sends messages, coach responds)
 * - User state building (lazy, cached)
 * - Step transitions (reset messages, auto-request guidance)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getCoachGuidance,
  sendCoachMessage,
  buildStep1State,
  buildStep2State,
  buildFullState,
} from '@/lib/alignmentCoachService';
import type {
  AlignmentCoachResponse,
  AlignmentCoachUserState,
  AlignmentStep,
  CoachTrigger,
  ConversationMessage,
  CaptureOffer,
  Step1Context,
  StepContext,
} from '@/types/alignmentCoach';

// Map step keys from STEPS array to AlignmentStep type
const STEP_KEY_MAP: Record<string, AlignmentStep> = {
  star: 'step_1',
  roles: 'step_2',
  wellness: 'step_3',
  goals: 'step_4',
  alignment: 'step_5',
  tactical: 'step_6',
};

export function useAlignmentCoach(userId: string, guidedModeEnabled: boolean) {
  // Conversation state
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [latestResponse, setLatestResponse] = useState<AlignmentCoachResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Cached user state (built once, reused across messages in same session)
  const userStateRef = useRef<AlignmentCoachUserState | null>(null);
  const userStateStepRef = useRef<string | null>(null);

  // Current step tracking
  const currentStepRef = useRef<AlignmentStep>('step_1');
  const hasRequestedEnterRef = useRef<Set<string>>(new Set());

  // Step 1 context (ephemeral UI state for context-aware coaching)
  const step1ContextRef = useRef<Step1Context | null>(null);

  // Steps 2-6 context (lightweight flow state + context bag)
  const stepContextRef = useRef<StepContext | null>(null);

  // ============================================
  // USER STATE BUILDING
  // ============================================

  /**
   * Build user state appropriate to the step depth.
   * Caches aggressively — only rebuilds if step depth changes.
   */
  const loadUserState = useCallback(
    async (step: AlignmentStep): Promise<AlignmentCoachUserState> => {
      // Determine depth tier
      const tier =
        step === 'step_1' ? 'light' :
        step === 'step_2' || step === 'step_3' ? 'medium' : 'full';

      // Return cached if same tier
      if (userStateRef.current && userStateStepRef.current === tier) {
        return userStateRef.current;
      }

      let state: AlignmentCoachUserState;
      switch (tier) {
        case 'light':
          state = await buildStep1State(userId);
          break;
        case 'medium':
          state = await buildStep2State(userId);
          break;
        default:
          state = await buildFullState(userId);
          break;
      }

      userStateRef.current = state;
      userStateStepRef.current = tier;
      return state;
    },
    [userId]
  );

  // ============================================
  // ONE-WAY: REQUEST GUIDANCE
  // ============================================

  /**
   * Request a one-way guidance message from the coach.
   * Used for step entry, idle nudges, completion acknowledgments, etc.
   */
  const requestGuidance = useCallback(
    async (step: AlignmentStep, trigger: CoachTrigger) => {
      if (!guidedModeEnabled || !userId) return;

      setIsLoading(true);

      try {
        const userState = await loadUserState(step);

        const response = await getCoachGuidance({
          mode: 'weekly',
          step,
          trigger,
          userState,
          step1Context: step === 'step_1' ? step1ContextRef.current ?? undefined : undefined,
          stepContext: step !== 'step_1' ? stepContextRef.current ?? undefined : undefined,
        });

        setLatestResponse(response);

        // Add coach's response to conversation history
        if (response.text) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: response.text },
          ]);
        }

        // Auto-open the bubble when guidance arrives
        if (trigger === 'enter' || trigger === 'return') {
          setChatOpen(true);
        }
      } catch (err) {
        console.error('[useAlignmentCoach] guidance error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, guidedModeEnabled, loadUserState]
  );

  // ============================================
  // TWO-WAY: SEND MESSAGE
  // ============================================

  /**
   * Send a user message and get a coach response.
   * Maintains full conversation history for context.
   */
  const sendUserMessage = useCallback(
    async (text: string, step: AlignmentStep) => {
      if (!text.trim() || !userId) return;

      const userMsg: ConversationMessage = { role: 'user', content: text.trim() };

      // Add user message immediately
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        const userState = await loadUserState(step);

        const response = await sendCoachMessage({
          mode: 'weekly',
          step,
          messages: updatedMessages,
          userState,
          step1Context: step === 'step_1' ? step1ContextRef.current ?? undefined : undefined,
          stepContext: step !== 'step_1' ? stepContextRef.current ?? undefined : undefined,
        });

        setLatestResponse(response);

        // Add coach's response
        if (response.text) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: response.text },
          ]);
        }
      } catch (err) {
        console.error('[useAlignmentCoach] send error:', err);
        // Add error fallback message
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I'm having trouble connecting right now. Give me a moment and try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, messages, loadUserState]
  );

  // ============================================
  // STEP MANAGEMENT
  // ============================================

  /**
   * Called when the user navigates to a new step.
   * Resets conversation and auto-requests entry guidance.
   */
  const onStepChange = useCallback(
    (stepKey: string) => {
      const step = STEP_KEY_MAP[stepKey] || ('step_1' as AlignmentStep);
      currentStepRef.current = step;

      // Reset conversation for the new step
      setMessages([]);
      setLatestResponse(null);
      setChatOpen(false);

      // Auto-request guidance on step entry (only once per step visit)
      if (guidedModeEnabled && !hasRequestedEnterRef.current.has(step)) {
        hasRequestedEnterRef.current.add(step);
        // Small delay so the step component renders first
        setTimeout(() => {
          requestGuidance(step, 'enter');
        }, 500);
      }
    },
    [guidedModeEnabled, requestGuidance]
  );

  /**
   * Update the Step 1 context (called by parent when UI state changes).
   * This keeps the context fresh for both guidance requests and 2-way chat.
   */
  const setStep1Context = useCallback((ctx: Step1Context | null) => {
    step1ContextRef.current = ctx;
  }, []);

  /**
   * Update the Steps 2-6 context (called by parent when triggers fire or UI state changes).
   */
  const setStepContext = useCallback((ctx: StepContext | null) => {
    stepContextRef.current = ctx;
  }, []);

  /**
   * Toggle the chat panel open/closed.
   */
  const toggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  /**
   * Get the current step key for external use.
   */
  const getCurrentStep = useCallback((): AlignmentStep => {
    return currentStepRef.current;
  }, []);

  // ============================================
  // AUTO-GUIDANCE ON INITIAL MOUNT
  // ============================================

  useEffect(() => {
    if (guidedModeEnabled && userId) {
      // Request guidance for the initial step (step_1) after mount
      const timer = setTimeout(() => {
        if (!hasRequestedEnterRef.current.has('step_1')) {
          hasRequestedEnterRef.current.add('step_1');
          requestGuidance('step_1', 'enter');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [guidedModeEnabled, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    messages,
    latestResponse,
    isLoading,
    chatOpen,

    // Actions
    requestGuidance,
    sendMessage: sendUserMessage,
    toggleChat,
    onStepChange,
    getCurrentStep,
    setStep1Context,
    setStepContext,
  };
}
