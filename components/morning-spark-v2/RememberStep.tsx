import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Music, Play } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AspirationContent } from '@/lib/morningSparkV2Service';

interface RememberStepProps {
  aspiration: AspirationContent | null;
  loading: boolean;
}

export function RememberStep({ aspiration, loading }: RememberStepProps) {
  const { colors, isDarkMode } = useTheme();

  const warmBg = isDarkMode ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.06)';
  const quoteMarkColor = isDarkMode ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.4)';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!aspiration) {
    return (
      <View style={[styles.container, { backgroundColor: warmBg }]}>
        <View style={styles.cardContent}>
          <Text style={[styles.decorativeQuoteOpen, { color: quoteMarkColor }]}>
            {'\u300C'}
          </Text>
          <Text style={[styles.defaultText, { color: colors.text }]}>
            You are exactly where you need to be. Trust the process.
          </Text>
          <Text style={[styles.decorativeQuoteClose, { color: quoteMarkColor }]}>
            {'\u300D'}
          </Text>
        </View>
      </View>
    );
  }

  if (aspiration.content_type === 'quote') {
    return (
      <View style={[styles.container, { backgroundColor: warmBg }]}>
        <View style={styles.cardContent}>
          <Text style={[styles.decorativeQuoteOpen, { color: quoteMarkColor }]}>
            {'\u275D'}
          </Text>
          <Text style={[styles.quoteText, { color: colors.text }]}>
            {aspiration.content_text}
          </Text>
          <Text style={[styles.decorativeQuoteClose, { color: quoteMarkColor }]}>
            {'\u275E'}
          </Text>
          {aspiration.title && (
            <Text style={[styles.quoteTitle, { color: colors.textSecondary }]}>
              {'\u2014 '}{aspiration.title}
            </Text>
          )}
          <View style={[styles.sourceBadge, { backgroundColor: colors.border }]}>
            <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
              {aspiration.source === 'coach' ? 'From your coach' : 'Your pick'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (aspiration.content_type === 'image') {
    return (
      <View style={[styles.container, { backgroundColor: warmBg }]}>
        <View style={styles.cardContent}>
          {aspiration.content_url && (
            <Image
              source={{ uri: aspiration.content_url }}
              style={styles.aspirationImage}
              resizeMode="cover"
            />
          )}
          {aspiration.title && (
            <Text style={[styles.imageCaption, { color: colors.textSecondary }]}>
              {aspiration.title}
            </Text>
          )}
          <View style={[styles.sourceBadge, { backgroundColor: colors.border }]}>
            <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
              {aspiration.source === 'coach' ? 'From your coach' : 'Your pick'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (aspiration.content_type === 'song') {
    return (
      <View style={[styles.container, { backgroundColor: warmBg }]}>
        <View style={styles.cardContent}>
          <View style={[styles.mediaIconCircle, { backgroundColor: colors.primary + '20' }]}>
            <Music size={32} color={colors.primary} />
          </View>
          {aspiration.title && (
            <Text style={[styles.mediaTitle, { color: colors.text }]}>
              {aspiration.title}
            </Text>
          )}
          {aspiration.content_url && (
            <TouchableOpacity
              style={[styles.mediaButton, { borderColor: colors.primary }]}
              onPress={() => Linking.openURL(aspiration.content_url!)}
              activeOpacity={0.7}
            >
              <Text style={[styles.mediaButtonText, { color: colors.primary }]}>
                Tap to listen
              </Text>
            </TouchableOpacity>
          )}
          <View style={[styles.sourceBadge, { backgroundColor: colors.border }]}>
            <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
              {aspiration.source === 'coach' ? 'From your coach' : 'Your pick'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (aspiration.content_type === 'video') {
    return (
      <View style={[styles.container, { backgroundColor: warmBg }]}>
        <View style={styles.cardContent}>
          <View style={[styles.mediaIconCircle, { backgroundColor: colors.primary + '20' }]}>
            <Play size={32} color={colors.primary} />
          </View>
          {aspiration.title && (
            <Text style={[styles.mediaTitle, { color: colors.text }]}>
              {aspiration.title}
            </Text>
          )}
          {aspiration.content_url && (
            <TouchableOpacity
              style={[styles.mediaButton, { borderColor: colors.primary }]}
              onPress={() => Linking.openURL(aspiration.content_url!)}
              activeOpacity={0.7}
            >
              <Text style={[styles.mediaButtonText, { color: colors.primary }]}>
                Tap to watch
              </Text>
            </TouchableOpacity>
          )}
          <View style={[styles.sourceBadge, { backgroundColor: colors.border }]}>
            <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
              {aspiration.source === 'coach' ? 'From your coach' : 'Your pick'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 32,
    alignItems: 'center',
  },
  decorativeQuoteOpen: {
    fontSize: 48,
    lineHeight: 56,
    alignSelf: 'flex-start',
    marginBottom: -8,
  },
  decorativeQuoteClose: {
    fontSize: 48,
    lineHeight: 56,
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  defaultText: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 8,
  },
  quoteText: {
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 34,
    paddingHorizontal: 8,
    letterSpacing: 0.3,
  },
  quoteTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  sourceBadge: {
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aspirationImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  imageCaption: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  mediaIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mediaTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 12,
  },
  mediaButton: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  mediaButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
