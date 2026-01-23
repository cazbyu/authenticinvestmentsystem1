import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SparkLibraryPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.comingSoonText}>
        Spark Library - Monthly archive of quotes and questions
      </Text>
      <Text style={styles.subText}>Coming soon in the next prompt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
