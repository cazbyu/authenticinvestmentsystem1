import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { ChevronRight, ChevronLeft, Edit3, Lightbulb, Check, Star } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { NorthStarIcon } from '@/components/icons/CustomIcons';
import { MiniCompass } from '@/components/compass/MiniCompass';
import { 
  trackQuestionShown, 
  trackQuestionAnswered, 
  trackQuestionSkipped 
} from '@/lib/analytics';

interface TouchYourStarStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onDataCapture: (data: {
    missionReflection?: string;
    visionAcknowledged?: boolean;
    valuesAcknowledged?: boolean;
  }) => void;
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

// Spark List - The identity options
const SPARK_LIST = [
  { id: 'child-of-god', label: 'Child of God', description: 'Created with divine purpose and infinite worth' },
  { id: 'creator', label: 'Creator', description: 'Bringing new ideas and possibilities into existence' },
  { id: 'servant', label: 'Servant', description: 'Finding fulfillment through serving others' },
  { id: 'steward', label: 'Steward', description: 'Caring for and developing what has been entrusted to you' },
  { id: 'healer', label: 'Healer', description: 'Restoring wholeness to people and situations' },
  { id: 'teacher', label: 'Teacher', description: 'Guiding others toward knowledge and wisdom' },
  { id: 'builder', label: 'Builder', description: 'Constructing foundations that last' },
  { id: 'custom', label: 'Something else...', description: 'Define your own identity' },
];

type FlowState = 
  | 'loading'
  | 'explainer'           // First-time: explain the purpose
  | 'hero-question'       // Select identity from Spark List
  | 'identity-questions'  // Optional guided questions for identity
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
  onDataCapture,
}: TouchYourStarStepProps) {
  // Core state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [northStarData, setNorthStarData] = useState<NorthStarData>({});
  const [currentDomain, setCurrentDomain] = useState<DomainType>('mission');
  
  // Identity state
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [customIdentity, setCustomIdentity] = useState('');
  const [identityInsights, setIdentityInsights] = useState('');
  
  // Questions state
  const [questions, setQuestions] = useState<PowerQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  
  // Direct input state
  const [directInput, setDirectInput] = useState('');

  // Values-specific state (for entering individual values)
  const [currentValueName, setCurrentValueName] = useState('');
  const [currentValueCommitment, setCurrentValueCommitment] = useState('');
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null);

  // Edit state
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainType | null>(null);

  // Question timing
  const questionStartTime = React.useRef<number>(Date.now());

  // AI support
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Synthesis state
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [customStatement, setCustomStatement] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ domain: DomainType; hasResponses: boolean } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Track question shown
  useEffect(() => {
    if ((flowState === 'guided-questions' || flowState === 'identity-questions') && 
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

      // Check for partial progress (responses saved but statement not complete)
      const { data: existingResponses } = await supabase
        .from('0008-ap-question-responses')
        .select('domain')
        .eq('user_id', userId)
        .eq('context_type', 'onboarding')
        .eq('used_in_synthesis', false);

      // Determine initial state
      if (!data.identity) {
        // No identity yet - start from beginning
        setFlowState('explainer');
      } else {
        // Has identity - go to hub
        setSelectedIdentity(data.identity);
        
        // Check if there's partial progress to resume
        if (existingResponses && existingResponses.length > 0) {
          const domains = [...new Set(existingResponses.map(r => r.domain))];
          if (domains.length > 0) {
            const resumeDomain = domains[0] as DomainType;
            // Check if this domain is already complete
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
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      setFlowState('explainer');
    }
  }

  async function loadQuestionsForDomain(domain: DomainType | 'identity') {
    const supabase = getSupabaseClient();
    
    // Get questions user has already answered for this domain
    const { data: answeredQuestions } = await supabase
      .from('0008-ap-question-responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('domain', domain);
    
    const answeredIds = (answeredQuestions || []).map(q => q.question_id);

    // Load questions for domain NOT already answered, ordered by display_order
    let questionsQuery = supabase
      .from('0008-ap-user-power-questions')
      .select('id, question_text, question_context, question_type, display_order')
      .eq('domain', domain)
      .eq('show_in_onboarding', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (answeredIds.length > 0) {
      questionsQuery = questionsQuery.not('id', 'in', `(${answeredIds.join(',')})`);
    }
    
    // Load up to 4 questions (user answers fewer, can shuffle for variety)
    const { data: domainQuestions } = await questionsQuery.limit(4);

    if (domainQuestions && domainQuestions.length > 0) {
      setQuestions(domainQuestions);
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
      const { data: questionTexts } = await supabase
        .from('0008-ap-user-power-questions')
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
      
      const identityValue = selectedIdentity === 'custom' ? customIdentity : selectedIdentity;
      
      // Check if north star record exists
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
            identity_insights: identityInsights || null,
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({ 
            user_id: userId, 
            core_identity: identityValue,
            identity_insights: identityInsights || null,
          });
      }

      // Update local state
      setNorthStarData(prev => ({ 
        ...prev, 
        identity: identityValue,
        identityInsights: identityInsights,
      }));
      
      setFlowState('identity-hub');

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
      
      // Determine which field to update
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

      // Mark responses as used in synthesis
      if (responses.length > 0) {
        const questionIds = responses.map(r => r.questionId);
        await supabase
          .from('0008-ap-question-responses')
          .update({ used_in_synthesis: true })
          .eq('user_id', userId)
          .in('question_id', questionIds);
      }

      // Update local state
      if (currentDomain === 'vision') {
        setNorthStarData(prev => ({ ...prev, vision: statementText }));
      } else {
        setNorthStarData(prev => ({ ...prev, mission: statementText }));
      }
      
      // Reset state for next domain
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

      // Mark responses as used
      if (responses.length > 0) {
        const questionIds = responses.map(r => r.questionId);
        await supabase
          .from('0008-ap-question-responses')
          .update({ used_in_synthesis: true })
          .eq('user_id', userId)
          .in('question_id', questionIds);
      }

      setNorthStarData(prev => ({ ...prev, values: updatedValues }));
      
      // Reset for next value or return to hub
      resetDomainState();
      setEditingValueIndex(null);
      setFlowState('identity-hub');

    } catch (error) {
      console.error('Error saving value:', error);
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
      // Go to synthesis if we have responses, otherwise back to hub
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
    const identity = northStarData.identity || 'human being';
    
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

    // Mission fallbacks
    const allText = responses.map(r => r.response).join(' ').toLowerCase();
    const suggestions: string[] = [];

    if (allText.includes('africa') || allText.includes('business') || allText.includes('entrepreneur')) {
      suggestions.push(`To create sustainable opportunities that empower communities and transform lives.`);
    }
    if (allText.includes('family') || allText.includes('children')) {
      suggestions.push(`To nurture and guide my family toward lives of purpose and fulfillment.`);
    }
    if (allText.includes('teach') || allText.includes('learn') || allText.includes('education')) {
      suggestions.push(`To educate and equip others with knowledge that opens doors.`);
    }

    // Always include generic options
    suggestions.push(`To serve others with wisdom and compassion, making a positive difference wherever I go.`);
    suggestions.push(`To use my unique gifts to contribute meaningfully to the world around me.`);

    return [...new Set(suggestions)].slice(0, 3);
  }

  function handleSelectSuggestion(index: number) {
    setSelectedSuggestion(index);
    setShowCustomInput(false);
  }

  function handleChooseCustom() {
    setSelectedSuggestion(null);
    setShowCustomInput(true);
  }

  function handleSaveFinalStatement() {
    let finalStatement = '';
    
    if (showCustomInput && customStatement.trim()) {
      finalStatement = customStatement.trim();
    } else if (selectedSuggestion !== null) {
      const suggestions = aiSuggestions.length > 0 ? aiSuggestions : generateFallbackSuggestions();
      finalStatement = suggestions[selectedSuggestion];
    }
    
    if (finalStatement) {
      if (currentDomain === 'values') {
        // Parse value suggestion into name and commitment
        const colonIndex = finalStatement.indexOf(':');
        if (colonIndex > 0) {
          const name = finalStatement.substring(0, colonIndex).trim();
          const commitment = finalStatement.substring(colonIndex + 1).trim();
          saveValue(name, commitment);
        } else {
          saveValue(finalStatement, '');
        }
      } else {
        saveStatement(finalStatement);
      }
    }
  }

  function startDomainFlow(domain: DomainType) {
    setCurrentDomain(domain);
    resetDomainState();
    setFlowState('choice');
  }

  // Get domain-specific labels and placeholders
  function getDomainConfig(domain: DomainType) {
    const identity = northStarData.identity || 'Steward';
    
    switch (domain) {
      case 'mission':
        return {
          title: 'Define Your Mission',
          subtitle: `As a ${identity}, my mission is...`,
          placeholder: 'To...',
          hint: 'Your mission describes your core purpose - what you do and why. It answers "What contribution do I make?"',
          buttonText: 'My Mission is to...',
        };
      case 'vision':
        return {
          title: 'Define Your Vision',
          subtitle: `As a ${identity}, in 5 years I envision...`,
          placeholder: 'A world/life where...',
          hint: 'Your vision paints a picture of your desired future - where you are headed. It answers "What does success look like?"',
          buttonText: 'In 5 years, I envision...',
        };
      case 'values':
        return {
          title: 'Define Your Core Values',
          subtitle: `As a ${identity}, I am committed to...`,
          placeholder: 'Value Name: I am committed to...',
          hint: 'Core values are actionable principles that guide your decisions. They answer "What do I stand for?"',
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

  // EXPLAINER SCREEN - First time introduction
  if (flowState === 'explainer') {
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
            </View>
          </View>
        </View>

        {/* Explainer Card */}
        <View style={[styles.explainerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.northStarIconCircle, { backgroundColor: '#ed1c2420' }]}>
            <NorthStarIcon size={48} color="#ed1c24" />
          </View>
          
          <Text style={[styles.explainerTitle, { color: colors.text }]}>
            Who Are You at Your Core?
          </Text>
          
          <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
            Before we define what you do or where you're going, let's step back from all the titles you hold—job, parent, spouse, friend—and answer a deeper question:
          </Text>
          
          <Text style={[styles.explainerQuote, { color: '#ed1c24' }]}>
            "Who am I when everything else is stripped away?"
          </Text>
          
          <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
            This foundational identity will anchor everything else—your Mission (purpose), Vision (direction), and Core Values (guidance).
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: '#ed1c24' }]}
          onPress={() => setFlowState('hero-question')}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Let's Begin</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // HERO QUESTION - Select identity from Spark List
  if (flowState === 'hero-question') {
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
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              </View>
            </View>
          </View>

          {/* Hero Question */}
          <View style={[styles.heroQuestionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.heroQuestion, { color: colors.text }]}>
              When you strip away every title you hold—job, parent, spouse, friend—what is the one title that remains?
            </Text>
            
            <Text style={[styles.heroSubtext, { color: colors.textSecondary }]}>
              At my core, I am a...
            </Text>

            {/* Spark List Options */}
            <View style={styles.sparkList}>
              {SPARK_LIST.map((spark) => (
                <TouchableOpacity
                  key={spark.id}
                  style={[
                    styles.sparkOption,
                    {
                      backgroundColor: selectedIdentity === spark.id ? '#ed1c2415' : colors.background,
                      borderColor: selectedIdentity === spark.id ? '#ed1c24' : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedIdentity(spark.id)}
                >
                  <View style={[
                    styles.radioCircle,
                    { borderColor: selectedIdentity === spark.id ? '#ed1c24' : colors.border },
                  ]}>
                    {selectedIdentity === spark.id && (
                      <View style={[styles.radioFill, { backgroundColor: '#ed1c24' }]} />
                    )}
                  </View>
                  <View style={styles.sparkOptionText}>
                    <Text style={[styles.sparkLabel, { color: colors.text }]}>{spark.label}</Text>
                    <Text style={[styles.sparkDescription, { color: colors.textSecondary }]}>
                      {spark.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Identity Input */}
            {selectedIdentity === 'custom' && (
              <TextInput
                style={[
                  styles.customIdentityInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Enter your identity..."
                placeholderTextColor={colors.textSecondary}
                value={customIdentity}
                onChangeText={setCustomIdentity}
              />
            )}

            {/* Optional Insights */}
            {selectedIdentity && (
              <View style={styles.insightsSection}>
                <Text style={[styles.insightsLabel, { color: colors.textSecondary }]}>
                  💭 Optional: Add any reflections, stories, or quotes that color this identity for you
                </Text>
                <TextInput
                  style={[
                    styles.insightsInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Why does this identity resonate with you?"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={identityInsights}
                  onChangeText={setIdentityInsights}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={() => setFlowState('explainer')}
            >
              <ChevronLeft size={20} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { 
                  backgroundColor: (selectedIdentity && (selectedIdentity !== 'custom' || customIdentity.trim())) 
                    ? '#ed1c24' 
                    : '#ccc' 
                },
              ]}
              onPress={saveIdentity}
              disabled={!selectedIdentity || (selectedIdentity === 'custom' && !customIdentity.trim()) || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Identity</Text>
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
            </View>
          </View>
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
              <TouchableOpacity
                onPress={() => setResumePrompt(null)}
              >
                <Text style={{ color: '#92400e' }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Identity Card */}
        <View style={[styles.identityCard, { backgroundColor: '#ed1c2410', borderColor: '#ed1c2440' }]}>
          <View style={styles.identityHeader}>
            <Star size={20} color="#ed1c24" fill="#ed1c24" />
            <Text style={[styles.identityLabel, { color: '#ed1c24' }]}>MY CORE IDENTITY</Text>
            <TouchableOpacity onPress={() => setFlowState('hero-question')}>
              <Text style={[styles.editLink, { color: '#ed1c24' }]}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.identityText, { color: colors.text }]}>
            As a {identity}:
          </Text>
          {northStarData.identityInsights && (
            <Text style={[styles.identityInsightsText, { color: colors.textSecondary }]}>
              "{northStarData.identityInsights}"
            </Text>
          )}
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
              <Text style={[styles.domainUnlockText, { color: colors.text }]}>
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
              <Text style={[styles.domainUnlockText, { color: colors.text }]}>
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
                {/* Show existing values with edit/delete */}
                {northStarData.values?.map((value, index) => (
                  <View key={index} style={[styles.valueEditRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.valueEditName, { color: colors.text }]}>{value.name}</Text>
                      {value.commitment && (
                        <Text style={[styles.valueEditCommitment, { color: colors.textSecondary }]}>
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
                
                {/* Add new value button */}
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

  // CHOICE SCREEN - "I Have One Ready" vs "Guide Me Through"
  if (flowState === 'choice') {
    const config = getDomainConfig(currentDomain);

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
            </View>
          </View>
        </View>

        {/* Choice Card */}
        <View style={[styles.choiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.northStarIconCircle, { backgroundColor: '#ed1c2420' }]}>
            <NorthStarIcon size={40} color="#ed1c24" />
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
                await loadQuestionsForDomain(currentDomain);
                if (questions.length > 0) {
                  setFlowState('guided-questions');
                } else {
                  // No questions available, go straight to direct input
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

        {/* Back to Hub */}
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
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              </View>
            </View>
          </View>

          {/* Input Card */}
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

          {/* Action Buttons */}
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
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#ed1c24' }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {config.title} - Question {currentQuestionIndex + 1} of {questions.length}
            </Text>
          </View>

          {/* Question Card */}
          <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.questionText, { color: colors.text }]}>
              {currentQuestion.question_text}
            </Text>
            
            {currentQuestion.question_context && (
              <Text style={[styles.questionContext, { color: colors.textSecondary }]}>
                💭 {currentQuestion.question_context}
              </Text>
            )}
            
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

          {/* Action Buttons */}
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

          {/* Save & Come Back */}
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
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              </View>
            </View>
          </View>

          {/* Your Responses */}
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

          {/* Suggestions */}
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
            ) : suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionOption,
                  {
                    backgroundColor: selectedSuggestion === index ? '#ed1c2420' : colors.background,
                    borderColor: selectedSuggestion === index ? '#ed1c24' : colors.border,
                  },
                ]}
                onPress={() => handleSelectSuggestion(index)}
              >
                <View style={[
                  styles.radioCircle,
                  { borderColor: selectedSuggestion === index ? '#ed1c24' : colors.border },
                ]}>
                  {selectedSuggestion === index && (
                    <View style={[styles.radioFill, { backgroundColor: '#ed1c24' }]} />
                  )}
                </View>
                <Text style={[styles.suggestionText, { color: colors.text }]}>
                  "{suggestion}"
                </Text>
              </TouchableOpacity>
            ))}

            {/* Write My Own Option */}
            <TouchableOpacity
              style={[
                styles.suggestionOption,
                {
                  backgroundColor: showCustomInput ? '#ed1c2420' : colors.background,
                  borderColor: showCustomInput ? '#ed1c24' : colors.border,
                },
              ]}
              onPress={handleChooseCustom}
            >
              <View style={[
                styles.radioCircle,
                { borderColor: showCustomInput ? '#ed1c24' : colors.border },
              ]}>
                {showCustomInput && (
                  <View style={[styles.radioFill, { backgroundColor: '#ed1c24' }]} />
                )}
              </View>
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                Write my own
              </Text>
            </TouchableOpacity>

            {showCustomInput && (
              <TextInput
                style={[
                  styles.customInput,
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

          {/* Reminder */}
          <Text style={[styles.reminderText, { color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }]}>
            💡 You can refine this anytime. Continued reflection will help you find what resonates.
          </Text>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: (selectedSuggestion !== null || (showCustomInput && customStatement.trim()))
                  ? '#ed1c24'
                  : '#ccc',
              },
            ]}
            onPress={handleSaveFinalStatement}
            disabled={selectedSuggestion === null && !(showCustomInput && customStatement.trim()) || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  Save My {currentDomain === 'values' ? 'Value' : currentDomain === 'vision' ? 'Vision' : 'Mission'}
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

  // VALUE ENTRY SCREEN (for editing individual values)
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
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: '#ed1c2415' }]}>
                <MiniCompass size={56} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: '#ed1c24' }]}>Step 1</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Touch Your Star</Text>
              </View>
            </View>
          </View>

          {/* Input Card */}
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

          {/* Action Buttons */}
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

  // Fallback - go to identity hub
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
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
    marginBottom: 24,
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

  // Explainer
  explainerCard: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  explainerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  explainerText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  explainerQuote: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },

  // Hero Question
  heroQuestionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  heroQuestion: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 20,
    textAlign: 'center',
  },
  heroSubtext: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  sparkList: {
    gap: 10,
  },
  sparkOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  sparkOptionText: {
    flex: 1,
  },
  sparkLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  sparkDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  customIdentityInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginTop: 12,
  },
  insightsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  insightsLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  insightsInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
  },

  // Identity Hub
  identityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
  identityInsightsText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Domain Unlock Buttons
  domainUnlockSection: {
    gap: 12,
    marginBottom: 20,
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
    lineHeight: 22,
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

  // Cards
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Choice Screen
  choiceCard: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  northStarIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  choiceTitle: {
    fontSize: 22,
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
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
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
    marginBottom: 24,
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
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  customInput: {
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