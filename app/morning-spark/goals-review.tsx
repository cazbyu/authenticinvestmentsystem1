import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMorningSpark } from '@/contexts/MorningSparkContext';
import { GoalsReviewContent } from '@/components/morning-spark/GoalsReviewContent';
import Header from '@/components/Header';

export default function GoalsReviewScreen() {
  const { fuelLevel } = useMorningSpark();

  // Safety check: Level 1 should never reach this screen
  if (fuelLevel === 1) {
    router.replace('/morning-spark/commitment');
    return null;
  }

  function handleSkip() {
    router.push('/morning-spark/deposit-ideas');
  }

  function handleContinue() {
    router.push('/morning-spark/deposit-ideas');
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Active Goals Review"
        showBack={true}
      />
      
      <GoalsReviewContent
        showSkipButton={true}
        onSkip={handleSkip}
        onContinue={handleContinue}
        inline={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});