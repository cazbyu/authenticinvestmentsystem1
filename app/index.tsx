import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Entry-point route guard.
 *
 * Rules:
 *  - Active session  → dashboard (regardless of email verification status)
 *  - No session      → landing
 *
 * Email verification is handled by the non-blocking VerificationBanner,
 * NOT by this guard. Unverified users are never kicked to /login here.
 */
export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (session && session.user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/landing" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
