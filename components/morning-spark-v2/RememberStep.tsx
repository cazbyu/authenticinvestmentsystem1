import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Music, Play } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AspirationContent, NorthStarCore } from '@/lib/morningSparkV2Service';

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

  if (!hasMission && !hasVision && !hasValues) {
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

export function RememberStep({ aspiration, northStar, loading }: RememberStepProps) {
  const { colors, isDarkMode } = useTheme();

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
      {/* Header */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {'\u2728'} Remember Who You Are
      </Text>

      {/* Mission / Vision / Values */}
      <NorthStarSection northStar={northStar} colors={colors} isDarkMode={isDarkMode} />

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
});
