# MindsetCapture Integration Example

## Quick Start: Adding to Commit Screen

### Step 1: Import the Component

```typescript
// app/morning-spark/commit.tsx
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';
```

### Step 2: Add State for Extra Points

```typescript
export default function CommitScreen() {
  const [extraPoints, setExtraPoints] = useState(0);

  // Calculate final score including extra captures
  const baseScore = calculateTargetScore();
  const reflectionBonus = reflection.trim() ? 1 : 0;
  const finalScore = baseScore + reflectionBonus + extraPoints;

  // ... rest of component
}
```

### Step 3: Add Component to JSX

Place between the victory card and the reflection section:

```typescript
<ScrollView style={styles.scrollContent}>
  {/* Fuel level display */}
  {fuelLevel && (
    <View style={styles.fuelSection}>
      <Text style={styles.fuelEmoji}>{getFuelEmoji(fuelLevel)}</Text>
      <Text style={[styles.fuelMode, { color: getFuelColor(fuelLevel) }]}>
        {getModeDescription(fuelLevel)}
      </Text>
    </View>
  )}

  {/* Scoreboard */}
  <View style={[styles.scoreboardCard, { backgroundColor: colors.surface }]}>
    {/* ... */}
  </View>

  {/* Breakdown */}
  <View style={[styles.manifestCard, { backgroundColor: colors.surface }]}>
    {/* ... */}
  </View>

  {/* Tone message */}
  <View style={[styles.toneCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
    <Text style={[styles.toneText, { color: colors.text }]}>{getToneMessage()}</Text>
  </View>

  {/* Victory message */}
  <View style={[styles.victoryCard, { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' }]}>
    <Sparkles size={20} color="#10B981" />
    <Text style={[styles.victoryText, { color: '#10B981' }]}>
      Beat this score by midnight to earn +10 Victory Bonus!
    </Text>
  </View>

  {/* ✨ ADD MINDSET CAPTURE HERE ✨ */}
  <MindsetCapture
    fuelLevel={fuelLevel || 2}
    userId={userId}
    sparkId={sparkId}
    onPointsAdded={(points) => setExtraPoints(prev => prev + points)}
  />

  {/* Final reflection */}
  <View style={styles.reflectionSection}>
    <Text style={[styles.reflectionLabel, { color: colors.textSecondary }]}>
      Any final thoughts or reflections to capture? (+1 point)
    </Text>
    <TextInput
      style={[styles.reflectionInput, { /* ... */ }]}
      placeholder="Optional..."
      value={reflection}
      onChangeText={setReflection}
      multiline
      maxLength={500}
    />
  </View>

  <View style={{ height: 100 }} />
</ScrollView>
```

### Step 4: Update Breakdown to Include Extra Points

```typescript
<View style={[styles.manifestCard, { backgroundColor: colors.surface }]}>
  <Text style={[styles.manifestTitle, { color: colors.text }]}>Breakdown</Text>

  {/* Existing items */}
  {acceptedEvents.length > 0 && (
    <View style={styles.manifestRow}>
      <Text style={[styles.manifestLabel, { color: colors.text }]}>
        {acceptedEvents.length} event{acceptedEvents.length > 1 ? 's' : ''}
      </Text>
      <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
        +{eventsPoints}
      </Text>
    </View>
  )}

  {/* ... other items ... */}

  {/* ✨ ADD THIS - Mindset captures ✨ */}
  {extraPoints > 0 && (
    <View style={styles.manifestRow}>
      <Text style={[styles.manifestLabel, { color: colors.text }]}>
        Mindset Captures
      </Text>
      <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
        +{extraPoints}
      </Text>
    </View>
  )}

  {reflectionBonus > 0 && (
    <View style={styles.manifestRow}>
      <Text style={[styles.manifestLabel, { color: colors.text }]}>Final Reflection</Text>
      <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>+1</Text>
    </View>
  )}

  <View style={[styles.divider, { backgroundColor: colors.border }]} />

  <View style={styles.manifestRow}>
    <Text style={[styles.manifestTotal, { color: colors.text }]}>Total Target</Text>
    <Text
      style={[
        styles.manifestTotalValue,
        { color: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
      ]}
    >
      {finalScore}
    </Text>
  </View>
</View>
```

---

## Complete Modified Commit Screen Code

Here's the full example with all changes:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckCircle, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useMorningSpark } from '@/contexts/MorningSparkContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  checkTodaysSpark,
  commitDailySpark,
  getFuelEmoji,
  getFuelColor,
  getModeDescription,
} from '@/lib/sparkUtils';
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';

export default function CommitScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const {
    fuelLevel,
    acceptedEvents,
    acceptedTasks,
    activatedDepositIdeas,
    calculateTargetScore,
    reset,
  } = useMorningSpark();

  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [sparkId, setSparkId] = useState<string>('');
  const [reflection, setReflection] = useState('');
  const [extraPoints, setExtraPoints] = useState(0); // ⭐ NEW
  const [showCelebration, setShowCelebration] = useState(false);

  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      const spark = await checkTodaysSpark(user.id);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      setSparkId(spark.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load commitment screen. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getToneMessage(): string {
    if (!fuelLevel) return '';

    switch (fuelLevel) {
      case 1:
        return "A solid, manageable target. You've got this.";
      case 2:
        return "A balanced target. Let's make it happen.";
      case 3:
        return 'An ambitious target. Challenge accepted!';
    }
  }

  function getCommitButtonText(): string {
    if (!fuelLevel) return 'Commit';

    switch (fuelLevel) {
      case 1:
        return "I'm Committed";
      case 2:
        return 'Accept Challenge';
      case 3:
        return "Let's Do It";
    }
  }

  async function handleCommit() {
    try {
      setCommitting(true);

      const supabase = getSupabaseClient();
      let finalScore = calculateTargetScore() + extraPoints; // ⭐ UPDATED

      if (reflection.trim()) {
        const { error: reflectionError } = await supabase.from('0008-ap-reflections').insert({
          user_id: userId,
          reflection_type: 'morning_spark',
          parent_id: sparkId,
          parent_type: 'daily_spark',
          content: reflection.trim(),
          points_awarded: 1,
        });

        if (reflectionError) {
          console.error('Error saving reflection:', reflectionError);
        } else {
          finalScore += 1;
        }
      }

      await commitDailySpark(userId, finalScore);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowCelebration(true);

      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        reset();
        router.replace('/(tabs)/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error committing spark:', error);
      Alert.alert('Error', 'Could not commit your Morning Spark. Please try again.');
      setCommitting(false);
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

  const targetScore = calculateTargetScore();
  const reflectionBonus = reflection.trim() ? 1 : 0;
  const finalScore = targetScore + reflectionBonus + extraPoints; // ⭐ UPDATED

  const eventsPoints = acceptedEvents.reduce((sum, e) => sum + e.points, 0);
  const tasksPoints = acceptedTasks.reduce((sum, t) => sum + t.points, 0);
  const ideasPoints = activatedDepositIdeas.length * 5;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Commitment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Fuel level display */}
        {fuelLevel && (
          <View style={styles.fuelSection}>
            <Text style={styles.fuelEmoji}>{getFuelEmoji(fuelLevel)}</Text>
            <Text style={[styles.fuelMode, { color: getFuelColor(fuelLevel) }]}>
              {getModeDescription(fuelLevel)}
            </Text>
          </View>
        )}

        {/* Scoreboard */}
        <View style={[styles.scoreboardCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Your Target</Text>
          <Text
            style={[
              styles.scoreValue,
              { color: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
            ]}
          >
            {finalScore}
          </Text>
          <Text style={[styles.scoreUnit, { color: colors.textSecondary }]}>points</Text>
        </View>

        {/* Breakdown */}
        <View style={[styles.manifestCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.manifestTitle, { color: colors.text }]}>Breakdown</Text>

          {acceptedEvents.length > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                {acceptedEvents.length} event{acceptedEvents.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{eventsPoints}
              </Text>
            </View>
          )}

          {acceptedTasks.length > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                {acceptedTasks.length} task{acceptedTasks.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{tasksPoints}
              </Text>
            </View>
          )}

          {activatedDepositIdeas.length > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                {activatedDepositIdeas.length} deposit idea{activatedDepositIdeas.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{ideasPoints}
              </Text>
            </View>
          )}

          <View style={styles.manifestRow}>
            <Text style={[styles.manifestLabel, { color: colors.text }]}>Morning Spark</Text>
            <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>+10</Text>
          </View>

          {/* ⭐ NEW - Mindset captures */}
          {extraPoints > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                Mindset Captures
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{extraPoints}
              </Text>
            </View>
          )}

          {reflectionBonus > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>Final Reflection</Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>+1</Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.manifestRow}>
            <Text style={[styles.manifestTotal, { color: colors.text }]}>Total Target</Text>
            <Text
              style={[
                styles.manifestTotalValue,
                { color: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
              ]}
            >
              {finalScore}
            </Text>
          </View>
        </View>

        {/* Tone message */}
        <View style={[styles.toneCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
          <Text style={[styles.toneText, { color: colors.text }]}>{getToneMessage()}</Text>
        </View>

        {/* Victory message */}
        <View style={[styles.victoryCard, { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' }]}>
          <Sparkles size={20} color="#10B981" />
          <Text style={[styles.victoryText, { color: '#10B981' }]}>
            Beat this score by midnight to earn +10 Victory Bonus!
          </Text>
        </View>

        {/* ⭐ NEW - Mindset Capture Component */}
        {userId && sparkId && (
          <MindsetCapture
            fuelLevel={fuelLevel || 2}
            userId={userId}
            sparkId={sparkId}
            onPointsAdded={(points) => setExtraPoints(prev => prev + points)}
          />
        )}

        {/* Final reflection */}
        <View style={styles.reflectionSection}>
          <Text style={[styles.reflectionLabel, { color: colors.textSecondary }]}>
            Any final thoughts or reflections to capture? (+1 point)
          </Text>
          <TextInput
            style={[
              styles.reflectionInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Optional..."
            placeholderTextColor={colors.textSecondary}
            value={reflection}
            onChangeText={setReflection}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer with commit button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.commitButton,
            {
              backgroundColor: fuelLevel ? getFuelColor(fuelLevel) : colors.primary,
            },
          ]}
          onPress={handleCommit}
          disabled={committing}
          activeOpacity={0.8}
        >
          {committing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.commitButtonText}>{getCommitButtonText()}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Celebration overlay */}
      {showCelebration && (
        <Animated.View
          style={[
            styles.celebration,
            {
              opacity: celebrationOpacity,
              transform: [{ scale: celebrationScale }],
            },
          ]}
        >
          <View
            style={[
              styles.celebrationContent,
              { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
            ]}
          >
            <CheckCircle size={80} color="#10B981" />
            <Text style={[styles.celebrationText, { color: colors.text }]}>
              Commitment Locked In!
            </Text>
            <Text style={[styles.celebrationSubtext, { color: colors.textSecondary }]}>
              Let's make it a great day
            </Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ... styles remain the same
```

---

## Summary of Changes

### 1. Import Statement
```typescript
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';
```

### 2. State Variable
```typescript
const [extraPoints, setExtraPoints] = useState(0);
```

### 3. Score Calculation
```typescript
const finalScore = targetScore + reflectionBonus + extraPoints;
```

### 4. Breakdown Item (conditional)
```typescript
{extraPoints > 0 && (
  <View style={styles.manifestRow}>
    <Text style={[styles.manifestLabel, { color: colors.text }]}>
      Mindset Captures
    </Text>
    <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
      +{extraPoints}
    </Text>
  </View>
)}
```

### 5. Component Usage
```typescript
<MindsetCapture
  fuelLevel={fuelLevel || 2}
  userId={userId}
  sparkId={sparkId}
  onPointsAdded={(points) => setExtraPoints(prev => prev + points)}
/>
```

### 6. Commit Handler Update
```typescript
let finalScore = calculateTargetScore() + extraPoints;
```

---

## Behavior Flow

1. User arrives at commit screen
2. Sees fuel-adaptive mindset capture prompt
3. Types thought/permission/idea
4. Clicks "Log" or "Create Deposit Idea"
5. Component saves to database
6. Component shows "+1 point" badge
7. Component calls `onPointsAdded(1)`
8. Parent updates `extraPoints` state
9. `finalScore` recalculates (scoreboard updates)
10. Breakdown shows "Mindset Captures: +X"
11. User can add more captures (repeat)
12. User commits final score including all captures

---

*Integration guide created: January 2026*
