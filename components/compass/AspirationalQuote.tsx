import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompassQuote } from '@/hooks/useCompassQuote';
import { useTheme } from '@/contexts/ThemeContext';

export function AspirationalQuote() {
  const { quote, loading, error } = useCompassQuote();
  const { colors } = useTheme();
  const router = useRouter();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && quote) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, quote, fadeAnim]);

  const handlePress = () => {
    router.push('/settings?section=northstar');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.skeleton, { backgroundColor: colors.border }]} />
      </View>
    );
  }

  if (error || !quote) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel="Aspirational quote, tap to edit"
      accessibilityRole="button"
    >
      <Animated.Text
        style={[
          styles.quoteText,
          { color: colors.textSecondary, opacity: fadeAnim },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {quote}
      </Animated.Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteText: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: '85%',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  skeleton: {
    height: 20,
    width: 200,
    borderRadius: 4,
  },
});
