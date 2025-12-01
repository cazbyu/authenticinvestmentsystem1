import React, { Suspense } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function DefaultFallback() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0078d4" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

export function LoadingBoundary({ children, fallback }: LoadingBoundaryProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback />}>
      {children}
    </Suspense>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
});
