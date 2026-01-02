import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { checkTodaysSpark } from '@/lib/sparkUtils';

export default function ScheduledActionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);

  useEffect(() => {
    loadSparkData();
  }, []);

  async function loadSparkData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.back();
        return;
      }

      const spark = await checkTodaysSpark(user.id);

      if (spark) {
        setFuelLevel(spark.fuel_level);
      } else {
        router.replace('/morning-spark');
      }
    } catch (error) {
      console.error('Error loading spark data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Scheduled Actions</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderEmoji]}>📅</Text>
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>
            Scheduled Actions
          </Text>
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            This page will show your scheduled actions for today.
          </Text>
          {fuelLevel && (
            <View style={styles.fuelInfo}>
              <Text style={[styles.fuelText, { color: colors.textSecondary }]}>
                Your fuel level: {fuelLevel === 1 ? 'Low 🔋' : fuelLevel === 2 ? 'Medium ⚡' : 'High 🚀'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  placeholder: {
    alignItems: 'center',
    maxWidth: 400,
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  fuelInfo: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  fuelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
