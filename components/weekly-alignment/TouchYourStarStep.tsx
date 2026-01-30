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
import { ChevronRight, ChevronLeft, Edit3, Lightbulb } from 'lucide-react-native';
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
  mission?: string;
  vision?: string;
  values?: Array<{ id: string; value: string; description?: string }>;
}

interface PowerQuestion {
  id: string;
  question_text: string;
  question_context?: string;
}

interface QuestionResponse {
  questionId: string;
  questionText: string;
  response: string;
}

type FlowState = 'loading' | 'choice' | 'direct-input' | 'guided-questions' | 'synthesis' | 'has-mission';

export function TouchYourStarStep({
  userId,
  colors,
  onNext,
  onDataCapture,
}: TouchYourStarStepProps) {
  // Core state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [northStarData, setNorthStarData] = useState<NorthStarData>({});
  
  // Questions state
  const [questions, setQuestions] = useState<PowerQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  
  // Direct input state
  const [directMission, setDirectMission] = useState('');

  // Edit WA questions
  const [showEditOptions, setShowEditOptions] = useState(false);
const questionStartTime = React.useRef<number>(Date.now());
  
  // Synthesis state
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [customMission, setCustomMission] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // UI state
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Track question shown
  useEffect(() => {
    if (flowState === 'guided-questions' && questions.length > 0 && questions[currentQuestionIndex]) {
      const q = questions[currentQuestionIndex];
      trackQuestionShown(
        userId,
        q.id,
        q.question_text,
        'onboarding',
        currentQuestionIndex + 1,
        questions.length,
        'mission'
      );
      questionStartTime.current = Date.now();
    }
  }, [flowState, currentQuestionIndex, questions, userId]);

  async function loadInitialData() {
    try {
      const supabase = getSupabaseClient();

      // Load existing North Star data
      const { data: northStar } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, core_values')
        .eq('user_id', userId)
        .maybeSingle();

      // Transform values
      let formattedValues: Array<{ id: string; value: string; description?: string }> = [];
      if (northStar?.core_values && Array.isArray(northStar.core_values)) {
        formattedValues = northStar.core_values.map((v: any, index: number) => {
          if (typeof v === 'string') {
            return { id: `value-${index}`, value: v };
          } else if (typeof v === 'object' && v.value) {
            return { id: v.id || `value-${index}`, value: v.value, description: v.description };
          }
          return { id: `value-${index}`, value: String(v) };
        });
      }

      const data: NorthStarData = {
        mission: northStar?.mission_statement,
        vision: northStar?.['5yr_vision'],
        values: formattedValues,
      };
      setNorthStarData(data);

      // Get questions user has already answered
      const { data: answeredQuestions } = await supabase
        .from('0008-ap-question-responses')
        .select('question_id')
        .eq('user_id', userId)
        .eq('domain', 'mission');
      
      const answeredIds = (answeredQuestions || []).map(q => q.question_id);

      // Load mission questions NOT already answered
      let questionsQuery = supabase
        .from('0008-ap-user-power-questions')
        .select('id, question_text, question_context')
        .eq('domain', 'mission')
        .eq('show_in_onboarding', true)
        .eq('is_active', true);
      
      // Exclude already answered questions
      if (answeredIds.length > 0) {
        questionsQuery = questionsQuery.not('id', 'in', `(${answeredIds.join(',')})`);
      }
      
      const { data: missionQuestions } = await questionsQuery.limit(4);

      if (missionQuestions && missionQuestions.length > 0) {
        setQuestions(missionQuestions);
      }

      // Load ALL existing responses for synthesis display
      const { data: existingResponses } = await supabase
        .from('0008-ap-question-responses')
        .select('question_id, response_text, created_at')
        .eq('user_id', userId)
        .eq('domain', 'mission')
        .eq('context_type', 'onboarding')
        .order('created_at', { ascending: true });

      if (existingResponses && existingResponses.length > 0) {
        // Get question texts for the responses
        const questionIds = existingResponses.map(r => r.question_id);
        const { data: questionTexts } = await supabase
          .from('0008-ap-user-power-questions')
          .select('id, question_text')
          .in('id', questionIds);
        
        const questionMap = new Map(
          (questionTexts || []).map(q => [q.id, q.question_text])
        );

        // Deduplicate - keep only most recent response per question
        const latestResponses = new Map<string, QuestionResponse>();
        existingResponses.forEach(r => {
          latestResponses.set(r.question_id, {
            questionId: r.question_id,
            questionText: questionMap.get(r.question_id) || '',
            response: r.response_text,
          });
        });
        
        setResponses(Array.from(latestResponses.values()));
      }

      // Determine initial state
      if (data.mission) {
        setFlowState('has-mission');
      } else {
        setFlowState('choice');
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      setFlowState('choice');
    }
  }

  async function saveResponse(questionId: string, responseText: string) {
    try {
      const supabase = getSupabaseClient();
      
      // Upsert response
      await supabase
        .from('0008-ap-question-responses')
        .upsert({
          user_id: userId,
          question_id: questionId,
          response_text: responseText,
          context_type: 'onboarding',
          domain: 'mission',
        }, {
          onConflict: 'user_id,question_id',
          ignoreDuplicates: false,
        });
    } catch (error) {
      console.error('Error saving response:', error);
    }
  }

  async function saveMission(missionText: string) {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      
      // Check if north star record exists
      const { data: existing } = await supabase
        .from('0008-ap-north-star')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('0008-ap-north-star')
          .update({ mission_statement: missionText })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('0008-ap-north-star')
          .insert({ user_id: userId, mission_statement: missionText });
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

      // Update local state and capture data
      setNorthStarData(prev => ({ ...prev, mission: missionText }));
      onDataCapture({
        missionReflection: missionText,
        visionAcknowledged: true,
        valuesAcknowledged: true,
      });

      // Move to next step
      onNext();

    } catch (error) {
      console.error('Error saving mission:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleNextQuestion() {
  if (!currentAnswer.trim()) return;

  const currentQuestion = questions[currentQuestionIndex];
  const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
  
  // Track the answer
  trackQuestionAnswered(
    userId,
    currentQuestion.id,
    currentQuestion.question_text,
    'onboarding',
    currentAnswer.trim().length,
    timeSpent,
    'mission'
  );
  
  // Save response locally
  const newResponse: QuestionResponse = {
    questionId: currentQuestion.id,
    questionText: currentQuestion.question_text,
    response: currentAnswer.trim(),
  };
  
  setResponses(prev => [...prev, newResponse]);
  
  // Save to database
  saveResponse(currentQuestion.id, currentAnswer.trim());
  
  // Move to next question or synthesis
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
      // Restore previous answer
      const prevResponse = responses[currentQuestionIndex - 1];
      if (prevResponse) {
        setCurrentAnswer(prevResponse.response);
        // Remove last response so it can be re-added
        setResponses(prev => prev.slice(0, -1));
      }
    } else {
      setFlowState('choice');
    }
  }

  function handleSaveAndComeBack() {
  const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
  
  // Track as skipped if they had a current question
  if (questions[currentQuestionIndex]) {
    const q = questions[currentQuestionIndex];
    trackQuestionSkipped(
      userId,
      q.id,
      q.question_text,
      'onboarding',
      timeSpent,
      'mission'
    );
  }
  
  // Save current answer if there is one
  if (currentAnswer.trim() && questions[currentQuestionIndex]) {
    saveResponse(questions[currentQuestionIndex].id, currentAnswer.trim());
  }
  
  // Capture partial progress and continue
  onDataCapture({
    missionReflection: undefined,
    visionAcknowledged: false,
    valuesAcknowledged: false,
  });
  onNext();
}

  function generateMissionSuggestions(): string[] {
    // Generate simple suggestions based on responses
    // In a real app, this could call an AI API
    const suggestions: string[] = [];
    
    if (responses.length >= 2) {
      // Extract key themes from responses
      const allText = responses.map(r => r.response).join(' ').toLowerCase();
      
      if (allText.includes('help') || allText.includes('support') || allText.includes('empower')) {
        suggestions.push('To empower others to discover their potential and create meaningful change in their lives.');
      }
      if (allText.includes('teach') || allText.includes('learn') || allText.includes('education')) {
        suggestions.push('To share knowledge and inspire lifelong learning in everyone I encounter.');
      }
      if (allText.includes('build') || allText.includes('create') || allText.includes('opportunity')) {
        suggestions.push('To build opportunities that transform lives and strengthen communities.');
      }
      if (allText.includes('lead') || allText.includes('guide') || allText.includes('inspire')) {
        suggestions.push('To lead with purpose and inspire others to pursue their highest aspirations.');
      }
      
      // Add a generic option if we don't have enough
      if (suggestions.length < 2) {
        suggestions.push('To live with intention and make a positive impact on those around me.');
        suggestions.push('To use my unique gifts to serve others and leave the world better than I found it.');
      }
    }
    
    return suggestions.slice(0, 3);
  }

  function handleSelectSuggestion(index: number) {
    setSelectedSuggestion(index);
    setShowCustomInput(false);
  }

  function handleChooseCustom() {
    setSelectedSuggestion(null);
    setShowCustomInput(true);
  }

  function handleSaveFinalMission() {
    let finalMission = '';
    
    if (showCustomInput && customMission.trim()) {
      finalMission = customMission.trim();
    } else if (selectedSuggestion !== null) {
      const suggestions = generateMissionSuggestions();
      finalMission = suggestions[selectedSuggestion];
    }
    
    if (finalMission) {
      saveMission(finalMission);
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

  // Has Mission - Show existing and allow to continue
  if (flowState === 'has-mission') {
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

        {/* Mission Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: '#ed1c24' }]}>YOUR MISSION</Text>
            <TouchableOpacity onPress={() => setShowEditOptions(true)}>
              <Text style={[styles.editLink, { color: '#ed1c24' }]}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.statementText, { color: colors.text }]}>
            "{northStarData.mission}"
          </Text>
        </View>

        {/* Edit Options Modal */}
        {showEditOptions && (
          <View style={[styles.editModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.editModalTitle, { color: colors.text }]}>
              How would you like to refine your mission?
            </Text>
            
            <TouchableOpacity
              style={[styles.editOption, { borderColor: colors.border }]}
              onPress={() => {
                setShowEditOptions(false);
                setDirectMission(northStarData.mission || '');
                setFlowState('direct-input');
              }}
            >
              <Edit3 size={20} color="#ed1c24" />
              <View style={styles.editOptionText}>
                <Text style={[styles.editOptionTitle, { color: colors.text }]}>Edit directly</Text>
                <Text style={[styles.editOptionDesc, { color: colors.textSecondary }]}>Make changes to your current mission</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.editOption, { borderColor: colors.border }]}
              onPress={async () => {
                setShowEditOptions(false);
                setCurrentQuestionIndex(0);
                setCurrentAnswer('');
                
                // Reload to get NEW questions (excluding answered ones)
                await loadInitialData();
                setFlowState('guided-questions');
              }}
            >
              <Lightbulb size={20} color="#ed1c24" />
              <View style={styles.editOptionText}>
                <Text style={[styles.editOptionTitle, { color: colors.text }]}>Explore with questions</Text>
                <Text style={[styles.editOptionDesc, { color: colors.textSecondary }]}>Discover deeper clarity through guided reflection</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editCancelButton}
              onPress={() => setShowEditOptions(false)}
            >
              <Text style={[styles.editCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Vision if exists */}
        {northStarData.vision && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabel, { color: '#ed1c24' }]}>YOUR VISION</Text>
            </View>
            <Text style={[styles.statementText, { color: colors.text }]}>
              "{northStarData.vision}"
            </Text>
          </View>
        )}

        {/* Values if exist */}
        {northStarData.values && northStarData.values.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabel, { color: '#ed1c24' }]}>CORE VALUES</Text>
            </View>
            <View style={styles.valuesContainer}>
              {northStarData.values.map((value) => (
                <View key={value.id} style={styles.valueTag}>
                  <Text style={[styles.valueText, { color: colors.text }]}>{value.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: '#ed1c24' }]}
          onPress={() => {
            onDataCapture({
              missionReflection: northStarData.mission,
              visionAcknowledged: true,
              valuesAcknowledged: true,
            });
            onNext();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Choice Screen - No mission yet
  if (flowState === 'choice') {
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

        {/* North Star Awaits Card */}
        <View style={[styles.choiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.northStarIconCircle, { backgroundColor: '#ed1c2420' }]}>
            <NorthStarIcon size={40} color="#ed1c24" />
          </View>
          
          <Text style={[styles.choiceTitle, { color: colors.text }]}>
            Your North Star Awaits
          </Text>
          
          <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
            Do you already have a clear Mission, or would you like to explore one together—step by step, using a few guided questions?
          </Text>

          <View style={styles.choiceButtons}>
            <TouchableOpacity
              style={[styles.choiceButton, { borderColor: '#ed1c24' }]}
              onPress={() => setFlowState('direct-input')}
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
                // Reload to ensure we have fresh unanswered questions
                await loadInitialData();
                setFlowState('guided-questions');
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

        {/* Skip for now */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            onDataCapture({
              missionReflection: undefined,
              visionAcknowledged: false,
              valuesAcknowledged: false,
            });
            onNext();
          }}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Direct Input Screen
  if (flowState === 'direct-input') {
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
              What is your mission?
            </Text>
            <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
              Your mission is the core purpose that drives you. It answers "Why do I exist?" or "What impact do I want to make?"
            </Text>
            
            <TextInput
              style={[
                styles.missionInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="To..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              value={directMission}
              onChangeText={setDirectMission}
              textAlignVertical="top"
            />

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
                { backgroundColor: directMission.trim() ? '#ed1c24' : '#ccc' },
              ]}
              onPress={() => directMission.trim() && saveMission(directMission.trim())}
              disabled={!directMission.trim() || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Mission</Text>
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

  // Guided Questions Screen
  if (flowState === 'guided-questions' && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

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
              Question {currentQuestionIndex + 1} of {questions.length}
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

  // Synthesis Screen
  if (flowState === 'synthesis') {
    const suggestions = generateMissionSuggestions();

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

          {/* Mission Suggestions */}
          <View style={[styles.suggestionsCard, { backgroundColor: '#ed1c2408', borderColor: '#ed1c2430' }]}>
            <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
              Based on your answers, here are some mission ideas:
            </Text>
            
            {suggestions.map((suggestion, index) => (
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
                placeholder="To..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                value={customMission}
                onChangeText={setCustomMission}
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
                backgroundColor: (selectedSuggestion !== null || (showCustomInput && customMission.trim()))
                  ? '#ed1c24'
                  : '#ccc',
              },
            ]}
            onPress={handleSaveFinalMission}
            disabled={selectedSuggestion === null && !(showCustomInput && customMission.trim()) || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>Save My Mission</Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Fallback
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

  // Cards
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statementText: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  valuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueTag: {
    backgroundColor: '#ed1c2415',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  valueText: {
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
    marginBottom: 12,
    textAlign: 'center',
  },
  choiceDescription: {
    fontSize: 16,
    lineHeight: 24,
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
  progressText: {
    fontSize: 13,
    textAlign: 'center',
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

// Card header row with edit
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
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
  
});

export default TouchYourStarStep;