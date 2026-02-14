import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  ScrollView,
  TextInput,
  Alert,
  Keyboard,
} from 'react-native';
import { Music, Play, Send, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AspirationContent, NorthStarCore, SparkQuestion } from '@/lib/morningSparkV2Service';
import { CoachInsight } from './CoachInsight';
import type { CoachTone } from '@/types/alignmentCoach';

// ============ PALETTE ============

const P = {
  gold: '#C9A04E',
  goldLight: 'rgba(201, 160, 78, 0.08)',
  goldBorder: 'rgba(201, 160, 78, 0.25)',
  goldMark: 'rgba(201, 160, 78, 0.35)',
  warmBg: '#FFFBF0',
  charcoal: '#2D3748',
  charcoalSoft: '#4A5568',
  missionBlue: '#5B9BD5',
  visionPurple: '#8B7EB8',
  valuesAmber: '#D4924A',
  emerald: '#3DA87A',
};

// ============ TYPES ============

interface RememberStepProps {
  aspiration: AspirationContent | null;
  northStar: NorthStarCore | null;
  loading: boolean;
  coachMessage?: string | null;
  coachTone?: CoachTone;
  /** Optional quick question for users missing North Star data */
  sparkQuestion?: SparkQuestion | null;
  /** Called when user submits a question response */
  onQuestionAnswered?: (questionId: string, responseText: string, domain: string) => void;
}

// ============ SUB-COMPONENTS ============

/** Mission / Vision / Values display */
function NorthStarSection({ northStar, colors, isDarkMode }: {
  northStar: NorthStarCore | null;
  colors: any;
  isDarkMode: boolean;
}) {
  const hasMission = northStar?.mission_statement;
  const hasVision = northStar?.vision;
  const hasValues = northStar?.core_values && northStar.core_values.length > 0;

  if (!hasMission && !hasVision && !hasValues && !northStar?.core_identity) {
    return (
      <View style={[styles.northStarEmpty, { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB', borderColor: colors.border }]}>
        <Text style={[styles.northStarEmptyText, { color: colors.textSecondary }]}>
          {'\u2B50'} Set your Mission, Vision & Values in your North Star to see them here each morning.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.northStarContainer}>
      {/* Identity */}
      {northStar?.core_identity && (
        <View style={[styles.mvvCard, { borderLeftColor: P.emerald, backgroundColor: isDarkMode ? colors.surface : '#F0FFF4' }]}>
          <Text style={[styles.mvvLabel, { color: P.emerald }]}>IDENTITY</Text>
          <Text style={[styles.mvvText, { color: colors.text }]}>
            {northStar.core_identity}
          </Text>
        </View>
      )}

      {/* Mission Statement */}
      {hasMission && (
        <View style={[styles.mvvCard, { borderLeftColor: P.missionBlue, backgroundColor: isDarkMode ? colors.surface : '#FAFCFF' }]}>
          <Text style={[styles.mvvLabel, { color: P.missionBlue }]}>MISSION</Text>
          <Text style={[styles.mvvText, { color: colors.text }]}>
            {northStar!.mission_statement}
          </Text>
        </View>
      )}

      {/* Vision */}
      {hasVision && (
        <View style={[styles.mvvCard, { borderLeftColor: P.visionPurple, backgroundColor: isDarkMode ? colors.surface : '#FAF8FF' }]}>
          <Text style={[styles.mvvLabel, { color: P.visionPurple }]}>VISION</Text>
          <Text style={[styles.mvvText, { color: colors.text }]}>
            {northStar!.vision}
          </Text>
        </View>
      )}

      {/* Values */}
      {hasValues && (
        <View style={styles.valuesRow}>
          <Text style={[styles.mvvLabel, { color: P.valuesAmber, marginBottom: 6 }]}>VALUES</Text>
          <View style={styles.valuesPillRow}>
            {northStar!.core_values.map((value, idx) => (
              <View key={idx} style={[styles.valuePill, { backgroundColor: isDarkMode ? colors.surface : P.warmBg, borderColor: P.goldBorder }]}>
                <Text style={[styles.valuePillText, { color: P.charcoal }]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** Quick question card — shown when North Star is incomplete */
function QuickQuestionCard({
  question,
  onSubmit,
  colors,
  isDarkMode,
}: {
  question: SparkQuestion;
  onSubmit: (questionId: string, responseText: string, domain: string) => void;
  colors: any;
  isDarkMode: boolean;
}) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    Keyboard.dismiss();
    onSubmit(question.id, answer.trim(), question.strategy_type);
    setSubmitted(true);
    setSubmitting(false);
  }, [answer, question, onSubmit, submitting]);

  const domainLabel =
    question.strategy_type === 'mission' ? 'MISSION'
    : question.strategy_type === 'vision' ? 'VISION'
    : 'VALUES';
  const domainColor =
    question.strategy_type === 'mission' ? P.missionBlue
    : question.strategy_type === 'vision' ? P.visionPurple
    : P.valuesAmber;

  if (submitted) {
    return (
      <View style={[styles.questionCard, { backgroundColor: isDarkMode ? colors.surface : '#F0FFF4', borderColor: P.emerald }]}>
        <View style={styles.questionSubmittedRow}>
          <CheckCircle size={20} color={P.emerald} />
          <Text style={[styles.questionSubmittedText, { color: P.emerald }]}>
            Great reflection! +1 point earned.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.questionCard, { backgroundColor: isDarkMode ? colors.surface : '#FAFCFF', borderColor: domainColor }]}>
      <View style={styles.questionDomainBadge}>
        <Text style={[styles.questionDomainText, { color: domainColor }]}>
          {domainLabel} QUESTION
        </Text>
      </View>
      <Text style={[styles.questionText, { color: colors.text }]}>
        {question.question_text}
      </Text>
      {question.question_context && (
        <Text style={[styles.questionContext, { color: colors.textSecondary }]}>
          {question.question_context}
        </Text>
      )}
      <View style={styles.questionInputRow}>
        <TextInput
          style={[
            styles.questionInput,
            {
              color: colors.text,
              backgroundColor: isDarkMode ? colors.background : '#FFF',
              borderColor: colors.border,
            },
          ]}
          placeholder="Share your thoughts..."
          placeholderTextColor={colors.textSecondary}
          value={answer}
          onChangeText={setAnswer}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[
            styles.questionSubmitBtn,
            { backgroundColor: answer.trim() ? domainColor : colors.border },
          ]}
          onPress={handleSubmit}
          disabled={!answer.trim() || submitting}
          activeOpacity={0.7}
        >
          <Send size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.questionHint, { color: colors.textSecondary }]}>
        A sentence or two is perfect — this feeds your North Star over time.
      </Text>
    </View>
  );
}

/** Source badge */
function SourceBadge({ source, colors }: { source: string; colors: any }) {
  const label =
    source === 'coach' ? 'From your coach'
    : source === 'system' ? 'Daily inspiration'
    : 'Your pick';

  return (
    <View style={[styles.sourceBadge, { backgroundColor: colors.border }]}>
      <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

/** Quote display */
function QuoteContent({ aspiration, colors, isDarkMode }: {
  aspiration: AspirationContent;
  colors: any;
  isDarkMode: boolean;
}) {
  return (
    <View style={[styles.contentCard, { backgroundColor: isDarkMode ? 'rgba(201,160,78,0.06)' : P.goldLight }]}>
      <Text style={[styles.decorativeQuoteOpen, { color: P.goldMark }]}>
        {'\u275D'}
      </Text>
      <Text style={[styles.quoteText, { color: colors.text }]}>
        {aspiration.content_text}
      </Text>
      <Text style={[styles.decorativeQuoteClose, { color: P.goldMark }]}>
        {'\u275E'}
      </Text>
      {aspiration.title && (
        <Text style={[styles.quoteAttribution, { color: colors.textSecondary }]}>
          {'\u2014 '}{aspiration.title}
        </Text>
      )}
      <SourceBadge source={aspiration.source} colors={colors} />
    </View>
  );
}

/** Image display */
function ImageContent({ aspiration, colors, isDarkMode }: {
  aspiration: AspirationContent;
  colors: any;
  isDarkMode: boolean;
}) {
  return (
    <View style={[styles.contentCard, { backgroundColor: isDarkMode ? 'rgba(201,160,78,0.06)' : P.goldLight }]}>
      {aspiration.content_url && (
        <Image
          source={{ uri: aspiration.content_url }}
          style={styles.aspirationImage}
          resizeMode="cover"
        />
      )}
      {aspiration.content_text && (
        <Text style={[styles.imageCaption, { color: colors.textSecondary }]}>
          {aspiration.content_text}
        </Text>
      )}
      {aspiration.title && (
        <Text style={[styles.imageCaption, { color: colors.textSecondary, fontStyle: 'italic' }]}>
          {'\u2014 '}{aspiration.title}
        </Text>
      )}
      <SourceBadge source={aspiration.source} colors={colors} />
    </View>
  );
}

/** Song / Video display */
function MediaContent({ aspiration, colors, isDarkMode }: {
  aspiration: AspirationContent;
  colors: any;
  isDarkMode: boolean;
}) {
  const isSong = aspiration.content_type === 'song';
  const IconComp = isSong ? Music : Play;
  const actionLabel = isSong ? 'Tap to listen' : 'Tap to watch';

  return (
    <View style={[styles.contentCard, { backgroundColor: isDarkMode ? 'rgba(201,160,78,0.06)' : P.goldLight, alignItems: 'center' }]}>
      <View style={[styles.mediaIconCircle, { backgroundColor: P.gold + '20' }]}>
        <IconComp size={28} color={P.gold} />
      </View>
      {aspiration.content_text && (
        <Text style={[styles.mediaTitle, { color: colors.text }]}>
          {aspiration.content_text}
        </Text>
      )}
      {aspiration.title && (
        <Text style={[styles.mediaArtist, { color: colors.textSecondary }]}>
          {aspiration.title}
        </Text>
      )}
      {aspiration.content_url && (
        <TouchableOpacity
          style={[styles.mediaButton, { borderColor: P.gold }]}
          onPress={() => Linking.openURL(aspiration.content_url!)}
          activeOpacity={0.7}
        >
          <Text style={[styles.mediaButtonText, { color: P.gold }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
      <SourceBadge source={aspiration.source} colors={colors} />
    </View>
  );
}

// ============ MAIN COMPONENT ============

export function RememberStep({
  aspiration,
  northStar,
  loading,
  coachMessage,
  coachTone,
  sparkQuestion,
  onQuestionAnswered,
}: RememberStepProps) {
  const { colors, isDarkMode } = useTheme();

  // Determine if North Star is mostly empty (show question when data is sparse)
  const hasMission = !!northStar?.mission_statement;
  const hasVision = !!northStar?.vision;
  const hasValues = northStar?.core_values && northStar.core_values.length > 0;
  const hasIdentity = !!northStar?.core_identity;
  const northStarPieceCount = [hasMission, hasVision, hasValues, hasIdentity].filter(Boolean).length;
  const showQuestion = sparkQuestion && onQuestionAnswered && northStarPieceCount < 3;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={P.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Coach Insight */}
      {coachMessage && (
        <CoachInsight
          message={coachMessage}
          tone={coachTone || 'reflect'}
          loading={false}
          isFallback={false}
          startCollapsed={false}
        />
      )}

      {/* Header */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {'\u2728'} Remember Who You Are
      </Text>

      {/* Mission / Vision / Values */}
      <NorthStarSection northStar={northStar} colors={colors} isDarkMode={isDarkMode} />

      {/* Quick Question — shown when North Star is incomplete */}
      {showQuestion && sparkQuestion && onQuestionAnswered && (
        <View style={{ marginTop: 14 }}>
          <QuickQuestionCard
            question={sparkQuestion}
            onSubmit={onQuestionAnswered}
            colors={colors}
            isDarkMode={isDarkMode}
          />
        </View>
      )}

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: P.goldBorder }]} />

      {/* Aspirational content */}
      {aspiration ? (
        <>
          {aspiration.content_type === 'quote' && (
            <QuoteContent aspiration={aspiration} colors={colors} isDarkMode={isDarkMode} />
          )}
          {aspiration.content_type === 'image' && (
            <ImageContent aspiration={aspiration} colors={colors} isDarkMode={isDarkMode} />
          )}
          {(aspiration.content_type === 'song' || aspiration.content_type === 'video') && (
            <MediaContent aspiration={aspiration} colors={colors} isDarkMode={isDarkMode} />
          )}
        </>
      ) : (
        <View style={[styles.contentCard, { backgroundColor: isDarkMode ? 'rgba(201,160,78,0.06)' : P.goldLight }]}>
          <Text style={[styles.decorativeQuoteOpen, { color: P.goldMark }]}>
            {'\u300C'}
          </Text>
          <Text style={[styles.defaultText, { color: colors.text }]}>
            You are exactly where you need to be. Trust the process.
          </Text>
          <Text style={[styles.decorativeQuoteClose, { color: P.goldMark }]}>
            {'\u300D'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // ---- Header ----
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },

  // ---- North Star: Mission / Vision / Values ----
  northStarContainer: {
    gap: 10,
  },
  northStarEmpty: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  northStarEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  mvvCard: {
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mvvLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  mvvText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },

  // ---- Values pills ----
  valuesRow: {
    marginTop: 2,
    paddingHorizontal: 4,
  },
  valuesPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valuePill: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  valuePillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ---- Divider ----
  divider: {
    height: 1,
    marginVertical: 18,
  },

  // ---- Aspirational content card ----
  contentCard: {
    borderRadius: 14,
    padding: 24,
    overflow: 'hidden',
  },
  decorativeQuoteOpen: {
    fontSize: 40,
    lineHeight: 48,
    alignSelf: 'flex-start',
    marginBottom: -4,
  },
  decorativeQuoteClose: {
    fontSize: 40,
    lineHeight: 48,
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  defaultText: {
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  quoteText: {
    fontSize: 19,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 4,
    letterSpacing: 0.2,
  },
  quoteAttribution: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },

  // ---- Source badge ----
  sourceBadge: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ---- Image ----
  aspirationImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  imageCaption: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },

  // ---- Media (song / video) ----
  mediaIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mediaTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 4,
  },
  mediaArtist: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  mediaButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ---- Quick Question Card ----
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  questionDomainBadge: {
    alignSelf: 'flex-start',
  },
  questionDomainText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  questionContext: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  questionInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  questionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
    maxHeight: 100,
  },
  questionSubmitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  questionSubmittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  questionSubmittedText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
