import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { ChevronRight, ChevronLeft, Edit3, Lightbulb, HelpCircle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { NorthStarIcon } from '@/components/icons/CustomIcons';
import { MiniCompass } from '@/components/compass/MiniCompass';
import { LifeCompass } from '@/components/compass/LifeCompass';
import { 
  trackQuestionShown, 
  trackQuestionAnswered, 
  trackQuestionSkipped 
} from '@/lib/analytics';
import { updateStepTimestamp } from '@/lib/weeklyAlignment';
import { getTourGuideMessage } from '@/lib/tour-guide';
import { buildStep1State } from '@/lib/tour-guide-state';
import type { TourGuideResponse, TourGuideUserState } from '@/types/tour-guide';

interface TouchYourStarStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  onDataCapture: (data: {
    missionReflection?: string;
    visionAcknowledged?: boolean;
    valuesAcknowledged?: boolean;
  }) => void;
  guidedModeEnabled?: boolean;
  weekStartDate: string;
  weekEndDate: string;
  onTourGuideMessage?: (message: string | null, isLoading: boolean) => void;
}

interface NorthStarData {
  identity?: string;
  identityInsights?: string;
  mission?: string;
  vision?: string;
  values?: Array<{ id: string; name: string; commitment: string }>;
}

interface PowerQuestion {
  id: string;
  question_text: string;
  question_context?: string;
  question_type?: string;
  display_order?: number;
}

interface QuestionResponse {
  questionId: string;
  questionText: string;
  response: string;
}

interface SparkListOption {
  id: string;
  value: string;
  label: string;
  isCustom: boolean;
}

interface PromptData {
  id: string;
  prompt_text: string;
  prompt_hint?: string;
  variant_group: string;
  test_name?: string;
}

// Default Spark List (fallback if DB not loaded)
const DEFAULT_SPARK_LIST: SparkListOption[] = [
  { id: '1', value: 'child-of-god', label: 'Child of God', isCustom: false },
  { id: '2', value: 'human-being', label: 'Human Being', isCustom: false },
  { id: '3', value: 'seeker-of-truth', label: 'Seeker of Truth', isCustom: false },
  { id: '4', value: 'steward', label: 'Steward', isCustom: false },
  { id: '5', value: 'custom', label: '[custom]', isCustom: true },
];

// Default prompt (fallback)
const DEFAULT_PROMPT = 'Finish this sentence: At my absolute core, before anything else I am a...';

// Confirmation text that fades in after selection
const CONFIRMATION_TEXT = 'This foundational identity anchors everything else—your Mission (purpose), Vision (direction), and Core Values (guardrails).';

type FlowState = 
  | 'loading'
  | 'hero-question'       // Select identity from Spark List
  | 'identity-hub'        // Main screen: shows identity, offers Mission/Vision/Values
  | 'choice'              // "I Have One Ready" vs "Guide Me Through"
  | 'direct-input'        // Text input for statement
  | 'guided-questions'    // Question flow
  | 'synthesis'           // AI suggestions
  | 'value-entry';        // Special: entering a single value

type DomainType = 'mission' | 'vision' | 'values';

export function TouchYourStarStep({
  userId,
  colors,
  onNext,
  onRegisterBackHandler,
  onDataCapture,
  guidedModeEnabled = true,
  weekStartDate,
  weekEndDate,
  onTourGuideMessage,
}: TouchYourStarStepProps) {
  // Core state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [northStarData, setNorthStarData] = useState<NorthStarData>({});
  const [currentDomain, setCurrentDomain] = useState<DomainType>('mission');
  
  // Compass ceremony state
  const [showCompass, setShowCompass] = useState(true);
  const [ceremonyComplete, setCeremonyComplete] = useState(false);
  
  // Tour guide AI state
  const [tourGuideMessage, setTourGuideMessage] = useState<TourGuideResponse | null>(null);
  const [tourGuideLoading, setTourGuideLoading] = useState(false);
  const [userState, setUserState] = useState<TourGuideUserState | null>(null);
  const [stepStartTime, setStepStartTime] = useState<Date>(new Date());
  
  // Identity state
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [customIdentity, setCustomIdentity] = useState('');
  const [sparkListOptions, setSparkListOptions] = useState<SparkListOption[]>(DEFAULT_SPARK_LIST);
  
  // Prompt state (for A/B testing)
  const [heroPrompt, setHeroPrompt] = useState<PromptData | null>(null);
  const [promptShownAt, setPromptShownAt] = useState<Date | null>(null);
  
  // Questions state
  const [questions, setQuestions] = useState<PowerQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  
  // Direct input state
  const [directInput, setDirectInput] = useState('');

  // Values-specific state
  const [currentValueName, setCurrentValueName] = useState('');
  const [currentValueCommitment, setCurrentValueCommitment] = useState('');
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null);

  // Edit state
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainType | null>(null);

  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);

  // Animation values
  const confirmationOpacity = useRef(new Animated.Value(0)).current;
  const buttonColorAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Question timing
  const questionStartTime = useRef<number>(Date.now());

  // AI support
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Synthesis state
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]); // For multi-select (values)
  const [customStatement, setCustomStatement] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ domain: DomainType; hasResponses: boolean } | null>(null);

  // Escort card dismissed state
  const [escortDismissed, setEscortDismissed] = useState<Record<string, boolean>>({});

  // Custom input ref for auto-focus
  const customInputRef = useRef<TextInput>(null);

  // ============ BACK HANDLER FIX ============
  // Refs to track current state for back handler (avoids stale closures and infinite loops)
  const flowStateRef = useRef<FlowState>(flowState);
  const questionsLengthRef = useRef(questions.length);

  // Keep refs in sync with state
  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  useEffect(() => {
    questionsLengthRef.current = questions.length;
  }, [questions.length]);

  // Stable back handler function using refs - doesn't change on re-renders
  const handleBack = useCallback(() => {
    const currentFlowState = flowStateRef.current;
    const currentQuestionsLength = questionsLengthRef.current;
    
    // Return true if we handled the back, false if parent should handle exit
    if (currentFlowState === 'identity-hub') {
      // From identity-hub, exit the step (identity already selected)
      // User can tap "Edit" on Core Identity card to change their identity
      return false;
    } else if (currentFlowState === 'choice') {
      // From choice, go back to identity-hub
      setFlowState('identity-hub');
      return true;
    } else if (currentFlowState === 'direct-input') {
      // From direct-input, go back to choice
      setFlowState('choice');
      return true;
    } else if (currentFlowState === 'guided-questions') {
      // From questions, go back to choice
      resetDomainState();
      setFlowState('choice');
      return true;
    } else if (currentFlowState === 'synthesis') {
      // From synthesis, go back to questions or choice
      if (currentQuestionsLength > 0) {
        setFlowState('guided-questions');
      } else {
        setFlowState('choice');
      }
      return true;
    } else if (currentFlowState === 'value-entry') {
      // From value entry, go back to identity-hub
      setEditingValueIndex(null);
      setCurrentValueName('');
      setCurrentValueCommitment('');
      setFlowState('identity-hub');
      return true;
    } else if (currentFlowState === 'hero-question') {
      // At the root - let parent handle exit
      return false;
    }
    return false;
  }, []); // Empty deps - uses refs for all state access

  // Register back handler with parent - only once on mount
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(handleBack);
    }
    // Intentionally only run on mount to prevent infinite loops
    // The handleBack function uses refs to always access current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ============ END BACK HANDLER FIX ============

  useEffect(() => {
    loadInitialData();
    setStepStartTime(new Date());
  }, []);

  // Track flow state changes and trigger tour guide on state transitions
  useEffect(() => {
    if (userState && guidedModeEnabled) {
      // Determine trigger based on state
      let trigger: 'enter' | 'complete' | 'return' = 'enter';
      
      if (flowState === 'identity-hub' && northStarData.identity) {
        trigger = 'complete'; // User just saved identity
      }
      
      // Call tour guide for major flow transitions
      if (flowState === 'identity-hub' || flowState === 'synthesis') {
        callTourGuide(trigger);
      }
    }
  }, [flowState, userState]);

  // Idle nudge timer
  useEffect(() => {
    if (!tourGuideMessage || !guidedModeEnabled) return;
    
    const nudgeSeconds = tourGuideMessage.next_nudge_seconds || 0;
    if (nudgeSeconds === 0) return; // Don't nudge
    
    const timer = setTimeout(() => {
      const secondsOnStep = Math.round((new Date().getTime() - stepStartTime.getTime()) / 1000);
      
      if (userState) {
        callTourGuide('idle', { ...userState, current_step_time_seconds: secondsOnStep });
      }
    }, nudgeSeconds * 1000);
    
    return () => clearTimeout(timer);
  }, [tourGuideMessage, stepStartTime]);

  // Write step_1_started on mount
  useEffect(() => {
    if (userId && weekStartDate && weekEndDate) {
      updateStepTimestamp(userId, weekStartDate, weekEndDate, 'step_1_started');
    }
  }, [userId, weekStartDate, weekEndDate]);

  // Animate confirmation text and button when identity selected
  useEffect(() => {
    const hasValidSelection = selectedIdentity && (selectedIdentity !== 'custom' || customIdentity.trim());
    
    if (hasValidSelection) {
      Animated.parallel([
        Animated.timing(confirmationOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonColorAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      confirmationOpacity.setValue(0);
      buttonColorAnim.setValue(0);
    }
  }, [selectedIdentity, customIdentity]);

  // Auto-focus custom input when selected
  useEffect(() => {
    if (selectedIdentity === 'custom') {
      setTimeout(() => {
        customInputRef.current?.focus();
      }, 100);
    }
  }, [selectedIdentity]);

  // Track question shown
  useEffect(() => {
    if (flowState === 'guided-questions' && 
        questions.length > 0 && questions[currentQuestionIndex]) {
      const q = questions[currentQuestionIndex];
      trackQuestionShown(
        userId,
        q.id,
        q.question_text,
        'onboarding',
        currentQuestionIndex + 1,
        questions.length,
        currentDomain
      );
      questionStartTime.current = Date.now();
    }
  }, [flowState, currentQuestionIndex, questions, userId]);

  // Generate AI suggestions when entering synthesis
  useEffect(() => {
    if (flowState === 'synthesis' && responses.length > 0 && aiSuggestions.length === 0) {
      setLoadingSuggestions(true);
      generateAISuggestions()
        .then(suggestions => {
          setAiSuggestions(suggestions);
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }
  }, [flowState]);

  async function loadInitialData() {
    try {
      const supabase = getSupabaseClient();

      // Load prompts for A/B testing
      const { data: prompts } = await supabase
        .from('0008-ap-question-prompts')
        .select('id, prompt_text, prompt_hint, variant_group, test_name')
        .eq('ritual_type', 'weekly_alignment')
        .eq('step_number', 1)
        .eq('domain', 'identity')
        .eq('is_active', true);

      if (prompts && prompts.length > 0) {
        // For A/B testing: randomly select a variant (or use default 'A')
        // For now, just use variant A
        const selectedPrompt = prompts.find(p => p.variant_group === 'A') || prompts[0];
        setHeroPrompt(selectedPrompt);
      }

      // Load spark list options
      const { data: sparkOptions } = await supabase
        .from('0008-ap-spark-list-options')
        .select('id, option_value, option_label, is_custom_option')
        .eq('domain', 'identity')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (sparkOptions && sparkOptions.length > 0) {
        setSparkListOptions(sparkOptions.map(opt => ({
          id: opt.id,
          value: opt.option_value,
          label: opt.option_label,
          isCustom: opt.is_custom_option,
        })));
      }

      // Build tour guide user state for Step 1
      const state = await buildStep1State(userId);
      setUserState(state);

      // Check if user has already answered the identity prompt
      const { data: existingPromptResponse } = await supabase
        .from('0008-ap-prompt-responses')
        .select('id, selected_option')
        .eq('user_id', userId)
        .eq('ritual_type', 'weekly_alignment')
        .eq('step_number', 1)
        .maybeSingle();

      // Load existing North Star data
      const { data: northStar } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, core_values, core_identity, identity_insights')
        .eq('user_id', userId)
        .maybeSingle();

      // Transform values from storage format
      let formattedValues: Array<{ id: string; name: string; commitment: string }> = [];
      if (northStar?.core_values && Array.isArray(northStar.core_values)) {
        formattedValues = northStar.core_values.map((v: any, index: number) => {
          if (typeof v === 'string') {
            return { id: `value-${index}`, name: v, commitment: '' };
          } else if (typeof v === 'object') {
            return { 
              id: v.id || `value-${index}`, 
              name: v.name || v.value || '', 
              commitment: v.commitment || v.description || '' 
            };
          }
          return { id: `value-${index}`, name: String(v), commitment: '' };
        });
      }

      const data: NorthStarData = {
        identity: northStar?.core_identity,
        identityInsights: northStar?.identity_insights,
        mission: northStar?.mission_statement,
        vision: northStar?.['5yr_vision'],
        values: formattedValues,
      };
      setNorthStarData(data);

      // Check for partial progress
      const { data: existingResponses } = await supabase
        .from('0008-ap-question-responses')
        .select('domain')
        .eq('user_id', userId)
        .eq('context_type', 'onboarding')
        .eq('used_in_synthesis', false);

      // Determine initial state
      // If user has identity, skip to hub (user can tap Edit on Core Identity card to change)
      if (data.identity) {
        setSelectedIdentity(data.identity);
        
        // Check if there's partial progress to resume
        if (existingResponses && existingResponses.length > 0) {
          const domains = [...new Set(existingResponses.map(r => r.domain))];
          if (domains.length > 0) {
            const resumeDomain = domains[0] as DomainType;
            const domainComplete = 
              (resumeDomain === 'mission' && data.mission) ||
              (resumeDomain === 'vision' && data.vision) ||
              (resumeDomain === 'values' && data.values && data.values.length > 0);
            
            if (!domainComplete) {
              setResumePrompt({ domain: resumeDomain, hasResponses: true });
            }
          }
        }
        
        setFlowState('identity-hub');
        setCeremonyComplete(true); // Skip ceremony if returning user
        
        // Call tour guide for returning user
        if (guidedModeEnabled) {
          callTourGuide('return');
        }
      } else {
        // Show hero question with compass ceremony
        setPromptShownAt(new Date());
        setFlowState('hero-question');
        // Compass ceremony will play automatically, then tour guide triggers
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      setFlowState('hero-question');
    }
  }

  /**
   * Call the Tour Guide AI for personalized coaching
   */
  async function callTourGuide(
    trigger: 'enter' | 'idle' | 'complete' | 'skip' | 'return',
    stateOverride?: TourGuideUserState
  ) {
    if (!guidedModeEnabled) return;
    
    const state = stateOverride || userState;
    if (!state) return;
    
    setTourGuideLoading(true);
    onTourGuideMessage?.(null, true);
    
    try {
      const response = await getTourGuideMessage('step_1', trigger, state);
      setTourGuideMessage(response);
      onTourGuideMessage?.(response.message, false);
    } catch (err) {
      console.error('Tour guide call failed:', err);
      onTourGuideMessage?.(null, false);
    } finally {
      setTourGuideLoading(false);
    }
  }

  /**
   * Load questions for a domain from the NEW 0008-ap-power-questions table.
   * 
   * MIGRATION NOTES:
   * - Old table: 0008-ap-user-power-questions (deprecated)
   * - New table: 0008-ap-power-questions
   * 
   * Query logic:
   * - Filter by strategy_type (mission/vision/values) instead of old 'domain' column
   * - Filter role_type IS NULL (only strategy questions, not role-specific)
   * - Filter by user's core_identity OR universal questions (core_identity IS NULL)
   * - Order by ob_priority (onboarding priority) instead of old 'display_order'
   * - Identity-specific questions appear first, then universal fallbacks
   */
  async function loadQuestionsForDomain(domain: DomainType | 'identity'): Promise<PowerQuestion[]> {
    const supabase = getSupabaseClient();
    
    // Get user's core identity for filtering identity-specific questions
    const userIdentity = northStarData.identity || null;
    
    // Get already-answered question IDs to exclude
    const { data: answeredQuestions } = await supabase
      .from('0008-ap-question-responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('domain', domain);
    
    const answeredIds = (answeredQuestions || []).map(q => q.question_id);

    // ========== MIGRATED: Now queries 0008-ap-power-questions ==========
    // Filter by strategy_type (mission/vision/values) and exclude role-specific questions
    let questionsQuery = supabase
      .from('0008-ap-power-questions')
      .select('id, question_text, question_context, question_type, ob_priority, core_identity')
      .eq('strategy_type', domain)      // NEW: was 'domain', now 'strategy_type'
      .is('role_type', null)            // NEW: Only strategy questions, not role-specific
      .eq('show_in_onboarding', true)
      .eq('is_active', true);
    
    // Filter by identity: show user's identity-specific questions OR universal (null) questions
    if (userIdentity) {
      // Get questions matching user's identity OR universal questions (core_identity is null)
      questionsQuery = questionsQuery.or(`core_identity.eq.${userIdentity},core_identity.is.null`);
    } else {
      // No identity set - only show universal questions
      questionsQuery = questionsQuery.is('core_identity', null);
    }
    
    // Exclude already-answered questions
    if (answeredIds.length > 0) {
      questionsQuery = questionsQuery.not('id', 'in', `(${answeredIds.join(',')})`);
    }
    
    // Order by ob_priority (NEW: was 'display_order', now 'ob_priority')
    questionsQuery = questionsQuery.order('ob_priority', { ascending: true });
    
    const { data: allQuestions, error: questionsError } = await questionsQuery.limit(8); // Get more to allow sorting
    
    if (questionsError) {
      console.error('Error loading questions:', questionsError);
    }

    // Sort to prioritize identity-specific questions over universal ones
    let sortedQuestions = allQuestions || [];
    if (userIdentity && sortedQuestions.length > 0) {
      sortedQuestions = sortedQuestions.sort((a: any, b: any) => {
        // Identity-specific questions first (core_identity matches user's identity)
        const aIsIdentitySpecific = a.core_identity === userIdentity ? 0 : 1;
        const bIsIdentitySpecific = b.core_identity === userIdentity ? 0 : 1;
        
        if (aIsIdentitySpecific !== bIsIdentitySpecific) {
          return aIsIdentitySpecific - bIsIdentitySpecific;
        }
        // Then by ob_priority
        return (a.ob_priority || 999) - (b.ob_priority || 999);
      });
    }
    
    // Take top 4 questions
    const domainQuestions = sortedQuestions.slice(0, 4);

    if (domainQuestions.length > 0) {
      // Map to expected format (display_order from ob_priority for compatibility)
      setQuestions(domainQuestions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_context: q.question_context,
        question_type: q.question_type,
        display_order: q.ob_priority,  // Map ob_priority to display_order for compatibility
      })));
    } else {
      setQuestions([]);
    }

    // Load existing responses for synthesis
    const { data: existingResponses } = await supabase
      .from('0008-ap-question-responses')
      .select('question_id, response_text, created_at')
      .eq('user_id', userId)
      .eq('domain', domain)
      .eq('context_type', 'onboarding')
      .order('created_at', { ascending: true });

    if (existingResponses && existingResponses.length > 0) {
      const questionIds = existingResponses.map(r => r.question_id);
      // ========== MIGRATED: Query NEW table for question texts ==========
      const { data: questionTexts } = await supabase
        .from('0008-ap-power-questions')
        .select('id, question_text')
        .in('id', questionIds);
      
      const questionMap = new Map(
        (questionTexts || []).map(q => [q.id, q.question_text])
      );

      const latestResponses = new Map<string, QuestionResponse>();
      existingResponses.forEach(r => {
        latestResponses.set(r.question_id, {
          questionId: r.question_id,
          questionText: questionMap.get(r.question_id) || '',
          response: r.response_text,
        });
      });
      
      setResponses(Array.from(latestResponses.values()));
    } else {
      setResponses([]);
    }

    return domainQuestions || [];
  }

  async function saveResponse(questionId: string, responseText: string) {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('0008-ap-question-responses')
        .upsert({
          user_id: userId,
          question_id: questionId,
          response_text: responseText,
          context_type: 'onboarding',
          domain: currentDomain,
        }, {
          onConflict: 'user_id,question_id',
          ignoreDuplicates: false,
        });
    } catch (error) {
      console.error('Error saving response:', error);
    }
  }

  async function saveIdentity() {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      
      const identityValue = selectedIdentity === 'custom' ? customIdentity.trim() : selectedIdentity;
      
      // Calculate time to answer
      const timeToAnswer = promptShownAt 
        ? Math.round((Date.now() - promptShownAt.getTime()) / 1000)
        : null;

      // Save to north star
      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('0008-ap-north-star')
          .update({ 
            core_identity: identityValue,
            identity_prompt_id: heroPrompt?.id,
            identity_answered_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({ 
            user_id: userId, 
            core_identity: identityValue,
            identity_prompt_id: heroPrompt?.id,
            identity_answered_at: new Date().toISOString(),
          });
      }

      // Record prompt response for A/B analytics (don't ask again)
      if (heroPrompt) {
        await supabase
          .from('0008-ap-prompt-responses')
          .upsert({
            user_id: userId,
            prompt_id: heroPrompt.id,
            selected_option: identityValue,
            response_text: selectedIdentity === 'custom' ? customIdentity.trim() : null,
            ritual_type: 'weekly_alignment',
            step_number: 1,
            variant_group: heroPrompt.variant_group,
            test_name: heroPrompt.test_name,
            shown_at: promptShownAt?.toISOString(),
            answered_at: new Date().toISOString(),
            time_to_answer_seconds: timeToAnswer,
          }, {
            onConflict: 'user_id,prompt_id',
          });
      }

      // Update local state
      setNorthStarData(prev => ({ 
        ...prev, 
        identity: identityValue,
      }));
      
      // Update user state for tour guide
      if (userState) {
        setUserState({
          ...userState,
          core_identity: identityValue,
        });
      }
      
      // Slide animation to identity hub
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setFlowState('identity-hub');
        slideAnim.setValue(0);
        
        // Call tour guide after identity saved
        if (guidedModeEnabled) {
          callTourGuide('complete');
        }
      });

    } catch (error) {
      console.error('Error saving identity:', error);
    } finally {
      setSaving(false);
    }
  }

  async function saveStatement(statementText: string) {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      
      const fieldName = currentDomain === 'vision' ? '5yr_vision' : 'mission_statement';
      
      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('0008-ap-north-star')
          .update({ [fieldName]: statementText })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({ user_id: userId, [fieldName]: statementText });
      }

      if (responses.length > 0) {
        const questionIds = responses.map(r => r.questionId);
        await supabase
          .from('0008-ap-question-responses')
          .update({ used_in_synthesis: true })
          .eq('user_id', userId)
          .in('question_id', questionIds);
      }

      if (currentDomain === 'vision') {
        setNorthStarData(prev => ({ ...prev, vision: statementText }));
      } else {
        setNorthStarData(prev => ({ ...prev, mission: statementText }));
      }
      
      resetDomainState();
      setFlowState('identity-hub');

    } catch (error) {
      console.error('Error saving statement:', error);
    } finally {
      setSaving(false);
    }
  }

  async function saveValue(name: string, commitment: string) {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      
      const newValue = {
        id: `value-${Date.now()}`,
        name,
        commitment,
      };

      const updatedValues = editingValueIndex !== null
        ? northStarData.values?.map((v, i) => i === editingValueIndex ? newValue : v) || [newValue]
        : [...(northStarData.values || []), newValue];

      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('0008-ap-north-star')
          .update({ core_values: updatedValues })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({ user_id: userId, core_values: updatedValues });
      }

      if (responses.length > 0) {
        const questionIds = responses.map(r => r.questionId);
        await supabase
          .from('0008-ap-question-responses')
          .update({ used_in_synthesis: true })
          .eq('user_id', userId)
          .in('question_id', questionIds);
      }

      setNorthStarData(prev => ({ ...prev, values: updatedValues }));
      
      resetDomainState();
      setEditingValueIndex(null);
      setFlowState('identity-hub');

    } catch (error) {
      console.error('Error saving value:', error);
    } finally {
      setSaving(false);
    }
  }

  async function saveMultipleValues(valuesToSave: Array<{ name: string; commitment: string }>) {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      
      const newValues = valuesToSave.map((v, i) => ({
        id: `value-${Date.now()}-${i}`,
        name: v.name,
        commitment: v.commitment,
      }));

      const updatedValues = [...(northStarData.values || []), ...newValues];

      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('0008-ap-north-star')
          .update({ core_values: updatedValues })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({ user_id: userId, core_values: updatedValues });
      }

      if (responses.length > 0) {
        const questionIds = responses.map(r => r.questionId);
        await supabase
          .from('0008-ap-question-responses')
          .update({ used_in_synthesis: true })
          .eq('user_id', userId)
          .in('question_id', questionIds);
      }

      setNorthStarData(prev => ({ ...prev, values: updatedValues }));
      
      resetDomainState();
      setFlowState('identity-hub');

    } catch (error) {
      console.error('Error saving multiple values:', error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteValue(index: number) {
    try {
      const supabase = getSupabaseClient();
      
      const updatedValues = northStarData.values?.filter((_, i) => i !== index) || [];

      await supabase
        .from('0008-ap-north-star')
        .update({ core_values: updatedValues })
        .eq('user_id', userId);

      setNorthStarData(prev => ({ ...prev, values: updatedValues }));
    } catch (error) {
      console.error('Error deleting value:', error);
    }
  }

  function resetDomainState() {
    setResponses([]);
    setAiSuggestions([]);
    setSelectedSuggestion(null);
    setSelectedSuggestions([]);
    setCustomStatement('');
    setShowCustomInput(false);
    setCurrentQuestionIndex(0);
    setCurrentAnswer('');
    setDirectInput('');
    setCurrentValueName('');
    setCurrentValueCommitment('');
  }

  function handleSkipQuestion() {
    const currentQuestion = questions[currentQuestionIndex];
    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
    
    trackQuestionSkipped(
      userId,
      currentQuestion.id,
      currentQuestion.question_text,
      'onboarding',
      timeSpent,
      currentDomain
    );
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentAnswer('');
    } else {
      if (responses.length > 0) {
        setFlowState('synthesis');
      } else {
        setFlowState('identity-hub');
      }
    }
  }
  
  function handleNextQuestion() {
    if (!currentAnswer.trim()) return;

    const currentQuestion = questions[currentQuestionIndex];
    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
    
    trackQuestionAnswered(
      userId,
      currentQuestion.id,
      currentQuestion.question_text,
      'onboarding',
      currentAnswer.trim().length,
      timeSpent,
      currentDomain
    );
    
    const newResponse: QuestionResponse = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.question_text,
      response: currentAnswer.trim(),
    };
    
    setResponses(prev => [...prev, newResponse]);
    saveResponse(currentQuestion.id, currentAnswer.trim());
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentAnswer('');
    } else {
      setFlowState('synthesis');
    }
  }

  function handlePreviousQuestion() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      const prevResponse = responses[currentQuestionIndex - 1];
      if (prevResponse) {
        setCurrentAnswer(prevResponse.response);
        setResponses(prev => prev.slice(0, -1));
      }
    } else {
      setFlowState('choice');
    }
  }

  function handleSaveAndComeBack() {
    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
    
    if (questions[currentQuestionIndex]) {
      const q = questions[currentQuestionIndex];
      trackQuestionSkipped(userId, q.id, q.question_text, 'onboarding', timeSpent, currentDomain);
    }
    
    if (currentAnswer.trim() && questions[currentQuestionIndex]) {
      saveResponse(questions[currentQuestionIndex].id, currentAnswer.trim());
    }
    
    onDataCapture({
      missionReflection: northStarData.mission,
      visionAcknowledged: !!northStarData.vision,
      valuesAcknowledged: !!(northStarData.values && northStarData.values.length > 0),
    });
    // Write step_1_completed before advancing
    updateStepTimestamp(userId, weekStartDate, weekEndDate, 'step_1_completed');
    onNext();
  }

  async function generateAISuggestions(): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase.functions.invoke('generate-mission', {
        body: { 
          responses, 
          domain: currentDomain,
          identity: northStarData.identity,
        },
      });

      if (error) throw error;
      
      return data.suggestions || [];
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      return generateFallbackSuggestions();
    }
  }

  function generateFallbackSuggestions(): string[] {
    if (currentDomain === 'values') {
      return [
        `Integrity: I am committed to speaking truth and keeping promises, even when difficult.`,
        `Service: I am committed to putting others' needs alongside my own.`,
        `Growth: I am committed to continuous learning and self-improvement.`,
      ];
    }

    if (currentDomain === 'vision') {
      return [
        `A life where I have made a lasting positive impact on my family and community.`,
        `A world where my work has created opportunities for those who need them most.`,
        `A home filled with peace, purpose, and the fruits of intentional living.`,
      ];
    }

    return [
      `To create sustainable opportunities that empower communities and transform lives.`,
      `To nurture and guide my family toward lives of purpose and fulfillment.`,
      `To serve others with wisdom and compassion, making a positive difference wherever I go.`,
    ];
  }

  function hasValidSelection(): boolean {
    if (currentDomain === 'values') {
      return selectedSuggestions.length > 0 || (showCustomInput && !!customStatement.trim());
    }
    return selectedSuggestion !== null || (showCustomInput && !!customStatement.trim());
  }

  function handleSelectSuggestion(index: number) {
    if (currentDomain === 'values') {
      // Multi-select for values
      setSelectedSuggestions(prev => {
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        } else {
          return [...prev, index];
        }
      });
    } else {
      // Single select for mission/vision
      setSelectedSuggestion(index);
      setShowCustomInput(false);
    }
  }

  function handleChooseCustom() {
    setSelectedSuggestion(null);
    setShowCustomInput(true);
  }

  function handleSaveFinalStatement() {
    const suggestions = aiSuggestions.length > 0 ? aiSuggestions : generateFallbackSuggestions();
    
    if (currentDomain === 'values') {
      // Save multiple values
      const valuesToSave: Array<{ name: string; commitment: string }> = [];
      
      // Add selected suggestions
      selectedSuggestions.forEach(index => {
        const suggestion = suggestions[index];
        const colonIndex = suggestion.indexOf(':');
        if (colonIndex > 0) {
          valuesToSave.push({
            name: suggestion.substring(0, colonIndex).trim(),
            commitment: suggestion.substring(colonIndex + 1).trim(),
          });
        } else {
          valuesToSave.push({ name: suggestion, commitment: '' });
        }
      });
      
      // Add custom value if entered
      if (showCustomInput && customStatement.trim()) {
        const colonIndex = customStatement.indexOf(':');
        if (colonIndex > 0) {
          valuesToSave.push({
            name: customStatement.substring(0, colonIndex).trim(),
            commitment: customStatement.substring(colonIndex + 1).trim(),
          });
        } else {
          valuesToSave.push({ name: customStatement.trim(), commitment: '' });
        }
      }
      
      // Save all values
      if (valuesToSave.length > 0) {
        saveMultipleValues(valuesToSave);
      }
    } else {
      // Single statement for mission/vision
      let finalStatement = '';
      
      if (showCustomInput && customStatement.trim()) {
        finalStatement = customStatement.trim();
      } else if (selectedSuggestion !== null) {
        finalStatement = suggestions[selectedSuggestion];
      }
      
      if (finalStatement) {
        saveStatement(finalStatement);
      }
    }
  }

  function startDomainFlow(domain: DomainType) {
    setCurrentDomain(domain);
    resetDomainState();
    setFlowState('choice');
  }

  function getDomainConfig(domain: DomainType) {
    const identity = northStarData.identity || 'Steward';
    
    switch (domain) {
      case 'mission':
        return {
          title: 'Define Your Mission',
          subtitle: `As a ${identity}, my mission is...`,
          placeholder: 'To...',
          hint: 'Your mission describes your core purpose—what you do and why.',
          buttonText: 'My Mission is to...',
        };
      case 'vision':
        return {
          title: 'Define Your Vision',
          subtitle: `As a ${identity}, in 5 years I envision...`,
          placeholder: 'A world/life where...',
          hint: 'Your vision paints a picture of your desired future—where you are headed.',
          buttonText: 'In 5 years, I envision...',
        };
      case 'values':
        return {
          title: 'Define Your Core Values',
          subtitle: `As a ${identity}, I am committed to...`,
          placeholder: 'Value Name: I am committed to...',
          hint: 'Core values are actionable principles that guide your decisions.',
          buttonText: 'I am committed to...',
        };
    }
  }

  // ========== RENDER FUNCTIONS ==========

  // Loading State
  if (flowState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  // HERO QUESTION SCREEN - With compass ceremony and animations
  if (flowState === 'hero-question') {
    const isCustomSelected = selectedIdentity === 'custom';
    const hasValidSelection = selectedIdentity && (selectedIdentity !== 'custom' || customIdentity.trim());

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -400],
                }),
              }],
            },
          ]}
        >
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Compass Ceremony - Only for new users */}
            {!ceremonyComplete && showCompass && (
              <View style={styles.compassCeremonyContainer}>
                <LifeCompass
                  size={200}
                  contextMode="weekly_alignment"
                  onCeremonyComplete={() => {
                    setCeremonyComplete(true);
                    // Call tour guide after ceremony
                    if (guidedModeEnabled) {
                      callTourGuide('enter');
                    }
                  }}
                />
              </View>
            )}

            {/* Header with Tooltip (? icon in top right) */}
            <View style={styles.headerSection}>
              <View style={styles.headerRow}>
                <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                  <MiniCompass size={56} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
                  <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
                </View>
                {/* Tooltip Button - ? icon */}
                <TouchableOpacity 
                  style={styles.tooltipButton}
                  onPress={() => setShowTooltip(!showTooltip)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <HelpCircle size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Tooltip Content */}
              {showTooltip && (
                <View style={[styles.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.tooltipText, { color: colors.text }]}>
                    Your North Star is your personal guidance system—the foundation for intentional living. It consists of your Identity (who you are), Mission (your purpose), Vision (your direction), and Core Values (your guardrails).
                  </Text>
                </View>
              )}
            </View>

            {/* Hero Question Card */}
            <View style={[styles.heroQuestionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* North Star Icon - 75% smaller (was 48, now 36) */}
              <View style={[styles.smallNorthStarCircle, { backgroundColor: '#ed1c2420' }]}>
                <NorthStarIcon size={36} color="#ed1c24" />
              </View>

              {/* Title Question */}
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                Who Are You at Your Core?
              </Text>
              
              {/* Prompt Text (from A/B testing or default) */}
              <Text style={[styles.heroPromptText, { color: '#ed1c24' }]}>
                {heroPrompt?.prompt_text || DEFAULT_PROMPT}
              </Text>

              {/* Spark List - Single line options, compact */}
              <View style={styles.sparkListCompact}>
                {sparkListOptions.map((spark) => {
                  const isSelected = spark.isCustom 
                    ? selectedIdentity === 'custom'
                    : selectedIdentity === spark.label;
                  
                  return (
                    <TouchableOpacity
                      key={spark.id}
                      style={[
                        styles.sparkOptionCompact,
                        {
                          backgroundColor: isSelected ? '#ed1c2415' : colors.background,
                          borderColor: isSelected ? '#ed1c24' : colors.border,
                        },
                      ]}
                      onPress={() => {
                        if (spark.isCustom) {
                          setSelectedIdentity('custom');
                        } else {
                          setSelectedIdentity(spark.label);
                          setCustomIdentity('');
                        }
                      }}
                    >
                      <View style={[
                        styles.radioCircle,
                        { borderColor: isSelected ? '#ed1c24' : colors.border },
                      ]}>
                        {isSelected && (
                          <View style={[styles.radioFill, { backgroundColor: '#ed1c24' }]} />
                        )}
                      </View>
                      
                      {spark.isCustom ? (
                        isSelected ? (
                          <TextInput
                            ref={customInputRef}
                            style={[
                              styles.customInputInline,
                              { color: colors.text, borderColor: '#ed1c24' },
                            ]}
                            placeholder="Enter your identity..."
                            placeholderTextColor={colors.textSecondary}
                            value={customIdentity}
                            onChangeText={setCustomIdentity}
                            autoCapitalize="words"
                          />
                        ) : (
                          <Text style={[styles.sparkLabelCompact, { color: colors.textSecondary }]}>
                            Something else...
                          </Text>
                        )
                      ) : (
                        <Text style={[styles.sparkLabelCompact, { color: colors.text }]}>
                          {spark.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Confirmation Text - Fades in after selection */}
              <Animated.View style={[styles.confirmationContainer, { opacity: confirmationOpacity }]}>
                <Text style={[styles.confirmationText, { color: colors.textSecondary }]}>
                  {CONFIRMATION_TEXT}
                </Text>
              </Animated.View>
            </View>

            {/* Let's Begin Button - Fades from gray to red */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                { backgroundColor: hasValidSelection ? '#ed1c24' : '#cccccc' },
              ]}
              onPress={saveIdentity}
              disabled={!hasValidSelection || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.continueButtonText}>Let's Begin</Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  // IDENTITY HUB - Main screen after identity is set
  if (flowState === 'identity-hub') {
    const hasMission = !!northStarData.mission;
    const hasVision = !!northStarData.vision;
    const hasValues = northStarData.values && northStarData.values.length > 0;
    const completedCount = (hasMission ? 1 : 0) + (hasVision ? 1 : 0) + (hasValues ? 1 : 0);
    const allComplete = completedCount === 3;
    const identity = northStarData.identity || 'Steward';

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
              <MiniCompass size={56} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
            </View>
            {/* Tooltip Button */}
            <TouchableOpacity 
              style={styles.tooltipButton}
              onPress={() => setShowTooltip(!showTooltip)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <HelpCircle size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {showTooltip && (
            <View style={[styles.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tooltipText, { color: colors.text }]}>
                Your North Star guides your decisions and keeps you aligned with what matters most. Complete your Mission, Vision, and Core Values to calibrate your internal compass.
              </Text>
            </View>
          )}
        </View>

        {/* Resume Prompt */}
        {resumePrompt && (
          <View style={[styles.resumeCard, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Text style={[styles.resumeText, { color: '#92400e' }]}>
              👋 Welcome back! You were working on your {resumePrompt.domain}. Ready to continue?
            </Text>
            <View style={styles.resumeButtons}>
              <TouchableOpacity
                style={[styles.resumeButton, { backgroundColor: '#f59e0b' }]}
                onPress={() => {
                  setCurrentDomain(resumePrompt.domain);
                  loadQuestionsForDomain(resumePrompt.domain);
                  setResumePrompt(null);
                  setFlowState('synthesis');
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setResumePrompt(null)}>
                <Text style={{ color: '#92400e' }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Identity Card */}
        <View style={[styles.identityCard, { backgroundColor: '#ed1c2410', borderColor: '#ed1c2440' }]}>
          <View style={styles.identityHeader}>
            <View style={[styles.identityStarIcon, { backgroundColor: '#ed1c24' }]}>
              <NorthStarIcon size={14} color="#ffffff" />
            </View>
            <Text style={[styles.identityLabel, { color: '#ed1c24' }]}>MY CORE IDENTITY</Text>
            <TouchableOpacity onPress={() => setFlowState('hero-question')}>
              <Text style={[styles.editLink, { color: '#ed1c24' }]}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.identityText, { color: colors.text }]}>
            As a {identity}:
          </Text>
        </View>

        {/* Domain Unlock Buttons */}
        <View style={styles.domainUnlockSection}>
          {/* Mission */}
          <TouchableOpacity
            style={[
              styles.domainUnlockButton,
              {
                backgroundColor: hasMission ? '#d1fae5' : colors.surface,
                borderColor: hasMission ? '#10b981' : colors.border,
              },
            ]}
            onPress={() => {
              if (hasMission) {
                setEditingDomain('mission');
                setShowEditOptions(true);
              } else {
                startDomainFlow('mission');
              }
            }}
          >
            <View style={styles.domainUnlockContent}>
              <Text style={[styles.domainUnlockLabel, { color: hasMission ? '#059669' : '#ed1c24' }]}>
                {hasMission ? '✓ MISSION DEFINED' : 'DEFINE YOUR MISSION'}
              </Text>
              <Text style={[styles.domainUnlockText, { color: colors.text }]} numberOfLines={2}>
                {hasMission ? `"${northStarData.mission}"` : '"My Mission is to..."'}
              </Text>
            </View>
            <ChevronRight size={20} color={hasMission ? '#059669' : colors.textSecondary} />
          </TouchableOpacity>

          {/* Vision */}
          <TouchableOpacity
            style={[
              styles.domainUnlockButton,
              {
                backgroundColor: hasVision ? '#d1fae5' : colors.surface,
                borderColor: hasVision ? '#10b981' : colors.border,
              },
            ]}
            onPress={() => {
              if (hasVision) {
                setEditingDomain('vision');
                setShowEditOptions(true);
              } else {
                startDomainFlow('vision');
              }
            }}
          >
            <View style={styles.domainUnlockContent}>
              <Text style={[styles.domainUnlockLabel, { color: hasVision ? '#059669' : '#ed1c24' }]}>
                {hasVision ? '✓ VISION DEFINED' : 'DEFINE YOUR VISION'}
              </Text>
              <Text style={[styles.domainUnlockText, { color: colors.text }]} numberOfLines={2}>
                {hasVision ? `"${northStarData.vision}"` : '"In 5 years, I envision..."'}
              </Text>
            </View>
            <ChevronRight size={20} color={hasVision ? '#059669' : colors.textSecondary} />
          </TouchableOpacity>

          {/* Core Values */}
          <TouchableOpacity
            style={[
              styles.domainUnlockButton,
              {
                backgroundColor: hasValues ? '#d1fae5' : colors.surface,
                borderColor: hasValues ? '#10b981' : colors.border,
              },
            ]}
            onPress={() => {
              if (hasValues) {
                setEditingDomain('values');
                setShowEditOptions(true);
              } else {
                startDomainFlow('values');
              }
            }}
          >
            <View style={styles.domainUnlockContent}>
              <Text style={[styles.domainUnlockLabel, { color: hasValues ? '#059669' : '#ed1c24' }]}>
                {hasValues ? `✓ ${northStarData.values!.length} VALUE${northStarData.values!.length > 1 ? 'S' : ''} DEFINED` : 'DEFINE CORE VALUES'}
              </Text>
              {hasValues ? (
                <View style={styles.valuesPreview}>
                  {northStarData.values!.slice(0, 3).map((v, i) => (
                    <View key={i} style={styles.valueChip}>
                      <Text style={[styles.valueChipText, { color: colors.text }]}>{v.name}</Text>
                    </View>
                  ))}
                  {northStarData.values!.length > 3 && (
                    <Text style={[styles.moreValues, { color: colors.textSecondary }]}>
                      +{northStarData.values!.length - 3} more
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.domainUnlockText, { color: colors.text }]}>
                  "I am committed to..."
                </Text>
              )}
            </View>
            <ChevronRight size={20} color={hasValues ? '#059669' : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Edit Options Modal */}
        {showEditOptions && editingDomain && (
          <View style={[styles.editModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.editModalTitle, { color: colors.text }]}>
              {editingDomain === 'values' 
                ? 'Manage your Core Values'
                : `How would you like to refine your ${editingDomain}?`
              }
            </Text>
            
            {editingDomain === 'values' ? (
              <>
                {northStarData.values?.map((value, index) => (
                  <View key={index} style={[styles.valueEditRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.valueEditName, { color: colors.text }]}>{value.name}</Text>
                      {value.commitment && (
                        <Text style={[styles.valueEditCommitment, { color: colors.textSecondary }]} numberOfLines={2}>
                          {value.commitment}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity 
                      onPress={() => {
                        setEditingValueIndex(index);
                        setCurrentValueName(value.name);
                        setCurrentValueCommitment(value.commitment);
                        setShowEditOptions(false);
                        setFlowState('value-entry');
                      }}
                      style={styles.valueEditButton}
                    >
                      <Edit3 size={16} color="#ed1c24" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity
                  style={[styles.addValueButton, { borderColor: '#ed1c24' }]}
                  onPress={() => {
                    setShowEditOptions(false);
                    startDomainFlow('values');
                  }}
                >
                  <Text style={{ color: '#ed1c24', fontWeight: '600' }}>+ Add Another Value</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.editOption, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowEditOptions(false);
                    setCurrentDomain(editingDomain);
                    const currentStatement = editingDomain === 'vision' ? northStarData.vision : northStarData.mission;
                    setDirectInput(currentStatement || '');
                    setFlowState('direct-input');
                  }}
                >
                  <Edit3 size={20} color="#ed1c24" />
                  <View style={styles.editOptionText}>
                    <Text style={[styles.editOptionTitle, { color: colors.text }]}>Edit directly</Text>
                    <Text style={[styles.editOptionDesc, { color: colors.textSecondary }]}>
                      Make changes to your current {editingDomain}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editOption, { borderColor: colors.border }]}
                  onPress={async () => {
                    setShowEditOptions(false);
                    setCurrentDomain(editingDomain);
                    resetDomainState();
                    await loadQuestionsForDomain(editingDomain);
                    setFlowState('guided-questions');
                  }}
                >
                  <Lightbulb size={20} color="#ed1c24" />
                  <View style={styles.editOptionText}>
                    <Text style={[styles.editOptionTitle, { color: colors.text }]}>Explore with questions</Text>
                    <Text style={[styles.editOptionDesc, { color: colors.textSecondary }]}>
                      Discover deeper clarity through guided reflection
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.editCancelButton}
              onPress={() => {
                setShowEditOptions(false);
                setEditingDomain(null);
              }}
            >
              <Text style={[styles.editCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress indicator */}
        {!showEditOptions && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              North Star Progress
            </Text>
            <View style={styles.progressDots}>
              <View style={[styles.progressDot, { backgroundColor: hasMission ? '#ed1c24' : '#e5e7eb' }]} />
              <View style={[styles.progressDot, { backgroundColor: hasVision ? '#ed1c24' : '#e5e7eb' }]} />
              <View style={[styles.progressDot, { backgroundColor: hasValues ? '#ed1c24' : '#e5e7eb' }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {completedCount} of 3 complete
            </Text>
          </View>
        )}

        {/* Continue Button */}
        {!showEditOptions && (
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: '#ed1c24' }]}
            onPress={() => {
              onDataCapture({
                missionReflection: northStarData.mission,
                visionAcknowledged: hasVision,
                valuesAcknowledged: hasValues,
              });
              // Write step_1_completed before advancing
              updateStepTimestamp(userId, weekStartDate, weekEndDate, 'step_1_completed');
              onNext();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>
              {allComplete ? 'Continue to Wing Checks' : 'Continue for Now'}
            </Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // CHOICE SCREEN
  if (flowState === 'choice') {
    const config = getDomainConfig(currentDomain);

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
              <MiniCompass size={56} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
            </View>
          </View>
        </View>

        <View style={[styles.choiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.smallNorthStarCircle, { backgroundColor: '#ed1c2420' }]}>
            <NorthStarIcon size={36} color="#ed1c24" />
          </View>
          
          <Text style={[styles.choiceTitle, { color: colors.text }]}>
            {config.title}
          </Text>
          
          <Text style={[styles.choiceSubtitle, { color: '#ed1c24' }]}>
            {config.subtitle}
          </Text>
          
          <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
            {config.hint}
          </Text>

          <View style={styles.choiceButtons}>
            <TouchableOpacity
              style={[styles.choiceButton, { borderColor: '#ed1c24' }]}
              onPress={() => {
                setDirectInput('');
                setFlowState('direct-input');
              }}
              activeOpacity={0.8}
            >
              <Edit3 size={20} color="#ed1c24" />
              <Text style={[styles.choiceButtonText, { color: '#ed1c24' }]}>
                I Have One Ready
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choiceButton, styles.choiceButtonFilled, { backgroundColor: '#ed1c24' }]}
              onPress={async () => {
                const loadedQuestions = await loadQuestionsForDomain(currentDomain);
                if (loadedQuestions && loadedQuestions.length > 0) {
                  setFlowState('guided-questions');
                } else {
                  setFlowState('direct-input');
                }
              }}
              activeOpacity={0.8}
            >
              <Lightbulb size={20} color="#FFFFFF" />
              <Text style={[styles.choiceButtonText, { color: '#FFFFFF' }]}>
                Guide Me Through
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            resetDomainState();
            setFlowState('identity-hub');
          }}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            ← Back to North Star
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // DIRECT INPUT SCREEN
  if (flowState === 'direct-input') {
    const config = getDomainConfig(currentDomain);

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
                <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
              </View>
            </View>
          </View>

          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {config.title}
            </Text>
            <Text style={[styles.inputSubtitle, { color: '#ed1c24' }]}>
              {config.subtitle}
            </Text>
            <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
              {config.hint}
            </Text>
            
            {currentDomain === 'values' ? (
              <>
                <TextInput
                  style={[
                    styles.valueNameInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Value Name (e.g., Integrity, Family First)"
                  placeholderTextColor={colors.textSecondary}
                  value={currentValueName}
                  onChangeText={setCurrentValueName}
                />
                <TextInput
                  style={[
                    styles.valueCommitmentInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="I am committed to... (the specific behavior)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={currentValueCommitment}
                  onChangeText={setCurrentValueCommitment}
                  textAlignVertical="top"
                />
              </>
            ) : (
              <TextInput
                style={[
                  styles.missionInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={config.placeholder}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                value={directInput}
                onChangeText={setDirectInput}
                textAlignVertical="top"
              />
            )}

            <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
              💡 Don't worry about perfection—you can refine this anytime.
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={() => setFlowState('choice')}
            >
              <ChevronLeft size={20} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { 
                  backgroundColor: (currentDomain === 'values' 
                    ? currentValueName.trim() 
                    : directInput.trim()) 
                    ? '#ed1c24' 
                    : '#ccc' 
                },
              ]}
              onPress={() => {
                if (currentDomain === 'values') {
                  saveValue(currentValueName.trim(), currentValueCommitment.trim());
                } else {
                  saveStatement(directInput.trim());
                }
              }}
              disabled={
                (currentDomain === 'values' ? !currentValueName.trim() : !directInput.trim()) || saving
              }
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>
                    Save {currentDomain === 'values' ? 'Value' : currentDomain === 'vision' ? 'Vision' : 'Mission'}
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // GUIDED QUESTIONS SCREEN
  if (flowState === 'guided-questions' && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const config = getDomainConfig(currentDomain);

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
                <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#ed1c24' }]} />
            </View>
            <Text style={[styles.progressTextSmall, { color: colors.textSecondary }]}>
              {config.title} • Question {currentQuestionIndex + 1} of {questions.length}
            </Text>
          </View>

          <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.questionText, { color: colors.text }]}>
              {currentQuestion.question_text}
            </Text>

            <TextInput
              style={[
                styles.answerInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Your thoughts..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={5}
              value={currentAnswer}
              onChangeText={setCurrentAnswer}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={handlePreviousQuestion}
            >
              <ChevronLeft size={20} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.questionSkipButton, { borderColor: colors.border }]}
              onPress={handleSkipQuestion}
            >
              <Text style={[styles.questionSkipButtonText, { color: colors.textSecondary }]}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: currentAnswer.trim() ? '#ed1c24' : '#ccc' },
              ]}
              onPress={handleNextQuestion}
              disabled={!currentAnswer.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {currentQuestionIndex < questions.length - 1 ? 'Next' : 'See Results'}
              </Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.comeBackButton}
            onPress={handleSaveAndComeBack}
          >
            <Text style={[styles.comeBackButtonText, { color: colors.textSecondary }]}>
              Save progress & come back later
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // SYNTHESIS SCREEN
  if (flowState === 'synthesis') {
    const suggestions = aiSuggestions.length > 0 ? aiSuggestions : generateFallbackSuggestions();
    const config = getDomainConfig(currentDomain);

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
                <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
              </View>
            </View>
          </View>

          {responses.length > 0 && (
            <View style={[styles.responsesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.responsesTitle, { color: colors.text }]}>
                Your Responses
              </Text>
              {responses.map((r, index) => (
                <View key={r.questionId} style={styles.responseItem}>
                  <Text style={[styles.responseQuestion, { color: colors.textSecondary }]}>
                    Q{index + 1}: {r.questionText.substring(0, 50)}...
                  </Text>
                  <Text style={[styles.responseAnswer, { color: colors.text }]}>
                    "{r.response}"
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.suggestionsCard, { backgroundColor: '#ed1c2408', borderColor: '#ed1c2430' }]}>
            <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
              Based on your answers, here are some {currentDomain} ideas:
            </Text>
            
            {loadingSuggestions ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <ActivityIndicator size="small" color="#ed1c24" />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontStyle: 'italic' }}>
                  Crafting personalized suggestions...
                </Text>
              </View>
            ) : suggestions.map((suggestion, index) => {
              const isSelected = currentDomain === 'values' 
                ? selectedSuggestions.includes(index)
                : selectedSuggestion === index;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.suggestionOption,
                    {
                      backgroundColor: isSelected ? '#ed1c2420' : colors.background,
                      borderColor: isSelected ? '#ed1c24' : colors.border,
                    },
                  ]}
                  onPress={() => handleSelectSuggestion(index)}
                >
                  {currentDomain === 'values' ? (
                    // Checkbox for values (multi-select)
                    <View style={[
                      styles.checkboxSquare,
                      { 
                        borderColor: isSelected ? '#ed1c24' : colors.border,
                        backgroundColor: isSelected ? '#ed1c24' : 'transparent',
                      },
                    ]}>
                      {isSelected && (
                        <Text style={styles.checkboxCheck}>✓</Text>
                      )}
                    </View>
                  ) : (
                    // Radio for mission/vision (single-select)
                    <View style={[
                      styles.radioCircle,
                      { borderColor: isSelected ? '#ed1c24' : colors.border },
                    ]}>
                      {isSelected && (
                        <View style={[styles.radioFill, { backgroundColor: '#ed1c24' }]} />
                      )}
                    </View>
                  )}
                  <Text style={[styles.suggestionText, { color: colors.text }]}>
                    "{suggestion}"
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.suggestionOption,
                {
                  backgroundColor: showCustomInput ? '#ed1c2420' : colors.background,
                  borderColor: showCustomInput ? '#ed1c24' : colors.border,
                },
              ]}
              onPress={() => setShowCustomInput(!showCustomInput)}
            >
              {currentDomain === 'values' ? (
                <View style={[
                  styles.checkboxSquare,
                  { 
                    borderColor: showCustomInput ? '#ed1c24' : colors.border,
                    backgroundColor: showCustomInput ? '#ed1c24' : 'transparent',
                  },
                ]}>
                  {showCustomInput && (
                    <Text style={styles.checkboxCheck}>✓</Text>
                  )}
                </View>
              ) : (
                <View style={[
                  styles.radioCircle,
                  { borderColor: showCustomInput ? '#ed1c24' : colors.border },
                ]}>
                  {showCustomInput && (
                    <View style={[styles.radioFill, { backgroundColor: '#ed1c24' }]} />
                  )}
                </View>
              )}
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                {currentDomain === 'values' ? '+ Add my own value' : 'Write my own'}
              </Text>
            </TouchableOpacity>

            {showCustomInput && (
              <TextInput
                style={[
                  styles.customInputField,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={config.placeholder}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                value={customStatement}
                onChangeText={setCustomStatement}
                textAlignVertical="top"
              />
            )}
          </View>

          <Text style={[styles.reminderText, { color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }]}>
            💡 You can refine this anytime.
          </Text>

          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: hasValidSelection() ? '#ed1c24' : '#ccc',
              },
            ]}
            onPress={handleSaveFinalStatement}
            disabled={!hasValidSelection() || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  {currentDomain === 'values'
                    ? `Save ${selectedSuggestions.length + (showCustomInput && customStatement.trim() ? 1 : 0)} Value${(selectedSuggestions.length + (showCustomInput && customStatement.trim() ? 1 : 0)) !== 1 ? 's' : ''}`
                    : `Save My ${currentDomain === 'vision' ? 'Vision' : 'Mission'}`
                  }
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // VALUE ENTRY SCREEN
  if (flowState === 'value-entry') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
                <Text style={[styles.stepSubtitle, { color: '#666' }]}>Who am I? — Why am I here? — Where do I want to go?</Text>
              </View>
            </View>
          </View>

          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {editingValueIndex !== null ? 'Edit Core Value' : 'Add Core Value'}
            </Text>
            
            <TextInput
              style={[
                styles.valueNameInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Value Name (e.g., Integrity, Family First)"
              placeholderTextColor={colors.textSecondary}
              value={currentValueName}
              onChangeText={setCurrentValueName}
            />
            <TextInput
              style={[
                styles.valueCommitmentInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="I am committed to... (the specific behavior)"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={currentValueCommitment}
              onChangeText={setCurrentValueCommitment}
              textAlignVertical="top"
            />

            <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
              💡 Values should be actionable rules, not just words.
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={() => {
                setEditingValueIndex(null);
                setCurrentValueName('');
                setCurrentValueCommitment('');
                setFlowState('identity-hub');
              }}
            >
              <ChevronLeft size={20} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            {editingValueIndex !== null && (
              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: '#ef4444' }]}
                onPress={() => {
                  deleteValue(editingValueIndex);
                  setEditingValueIndex(null);
                  setCurrentValueName('');
                  setCurrentValueCommitment('');
                  setFlowState('identity-hub');
                }}
              >
                <Text style={{ color: '#ef4444', fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: currentValueName.trim() ? '#ed1c24' : '#ccc' },
              ]}
              onPress={() => saveValue(currentValueName.trim(), currentValueCommitment.trim())}
              disabled={!currentValueName.trim() || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Value</Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  compassCeremonyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },

  // Header
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compassContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  stepSubtitle: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
  },

  // Tooltip
  tooltipButton: {
    padding: 8,
  },
  tooltipContent: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Hero Question Card
  heroQuestionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  smallNorthStarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroPromptText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Spark List - Compact single-line options
  sparkListCompact: {
    width: '100%',
    gap: 8,
  },
  sparkOptionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  sparkLabelCompact: {
    fontSize: 15,
    fontWeight: '500',
  },
  customInputInline: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    borderBottomWidth: 1,
  },

  // Confirmation text container
  confirmationContainer: {
    marginTop: 20,
    paddingHorizontal: 8,
  },
  confirmationText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Radio button
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Identity Card (Identity Hub)
  identityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  identityStarIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  identityText: {
    fontSize: 20,
    fontWeight: '700',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Domain Unlock Section
  domainUnlockSection: {
    gap: 12,
    marginBottom: 16,
  },
  domainUnlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  domainUnlockContent: {
    flex: 1,
  },
  domainUnlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  domainUnlockText: {
    fontSize: 15,
    lineHeight: 20,
  },
  valuesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  valueChip: {
    backgroundColor: '#d1fae5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  valueChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  moreValues: {
    fontSize: 13,
    alignSelf: 'center',
  },

  // Resume Prompt
  resumeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  resumeText: {
    fontSize: 15,
    marginBottom: 12,
  },
  resumeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  resumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },

  // Choice Screen
  choiceCard: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  choiceSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  choiceDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  choiceButtons: {
    width: '100%',
    gap: 12,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
  },
  choiceButtonFilled: {
    borderWidth: 0,
  },
  choiceButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 15,
  },

  // Direct Input
  inputCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  missionInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 16,
  },
  valueNameInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  valueCommitmentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
  },
  reminderText: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Progress
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
  },
  progressTextSmall: {
    fontSize: 13,
  },

  // Question Card
  questionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 12,
  },
  questionContext: {
    fontSize: 14,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  answerInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 140,
  },
  questionSkipButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  questionSkipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  comeBackButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  comeBackButtonText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  // Responses Card
  responsesCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  responsesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  responseItem: {
    marginBottom: 16,
  },
  responseQuestion: {
    fontSize: 12,
    marginBottom: 4,
  },
  responseAnswer: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Suggestions Card
  suggestionsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 22,
  },
  suggestionOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  customInputField: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    marginTop: 4,
  },

  // Continue Button
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Edit Modal
  editModal: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  editOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  editOptionText: {
    flex: 1,
  },
  editOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  editOptionDesc: {
    fontSize: 13,
  },
  editCancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  editCancelText: {
    fontSize: 15,
  },

  // Value Edit
  valueEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  valueEditName: {
    fontSize: 15,
    fontWeight: '600',
  },
  valueEditCommitment: {
    fontSize: 13,
    marginTop: 2,
  },
  valueEditButton: {
    padding: 8,
  },
  addValueButton: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
});

export default TouchYourStarStep;