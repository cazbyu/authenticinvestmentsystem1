import { Redirect } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

export default function Index() {
  const { session, loading } = useOptimizedAuth();

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
