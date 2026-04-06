import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function BalancePieChart(_props: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Chart view available on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  text: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
