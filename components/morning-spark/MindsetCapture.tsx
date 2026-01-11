import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { getFuelColor } from '@/lib/sparkUtils';

interface MindsetCaptureProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  sparkId: string;
  onPointsAdded: (points: number) => void;
}

export function MindsetCapture({
  fuelLevel,
  userId,
  sparkId,
  onPointsAdded,
}: MindsetCaptureProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  function getPromptText(): string {
    switch (fuelLevel) {
      case 1:
        return 'What is one thing you give yourself permission NOT to do today?';
      case 2:
        return 'Where is your head at right now? Log a quick thought to clear your cache.';
      case 3:
        return "Capture the Spark. Don't lose these creative ideas—bank them now.";
    }
  }

  function getButtonText(): string {
    return fuelLevel === 3 ? 'Create Deposit Idea' : 'Log';
  }

  function getPlaceholder(): string {
    switch (fuelLevel) {
      case 1:
        return 'I give myself permission to...';
      case 2:
        return "Right now I'm thinking...";
      case 3:
        return 'This idea could...';
    }
  }

  async function handleSubmit() {
    if (!text.trim()) return;

    try {
      setSaving(true);
      const supabase = getSupabaseClient();

      const { error: reflectionError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: userId,
          reflection_type: 'morning_spark',
          parent_id: sparkId,
          parent_type: 'daily_spark',
          content: text.trim(),
          points_awarded: 1,
        });

      if (reflectionError) {
        throw reflectionError;
      }

      if (fuelLevel === 3) {
        const { error: ideaError } = await supabase
          .from('0008-ap-deposit-ideas')
          .insert({
            user_id: userId,
            title: text.trim(),
            creation_points_awarded: true,
          });

        if (ideaError) {
          console.error('Error creating deposit idea:', ideaError);
        }
      }

      onPointsAdded(1);

      setShowSuccess(true);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowSuccess(false);
          scaleAnim.setValue(0);
          opacityAnim.setValue(0);
        });
      }, 2000);

      setText('');
    } catch (error) {
      console.error('Error saving mindset capture:', error);
    } finally {
      setSaving(false);
    }
  }

  const charCount = text.length;
  const isOverLimit = charCount > 500;
  const canSubmit = text.trim().length > 0 && !isOverLimit;

  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: colors.text }]}>
        {getPromptText()}
      </Text>

      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: isOverLimit ? '#ef4444' : colors.border,
          },
        ]}
        placeholder={getPlaceholder()}
        placeholderTextColor={colors.textSecondary}
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        maxLength={520}
      />

      <View style={styles.footer}>
        <Text
          style={[
            styles.charCounter,
            {
              color: isOverLimit ? '#ef4444' : colors.textSecondary,
            },
          ]}
        >
          {charCount}/500
        </Text>

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: canSubmit
                ? getFuelColor(fuelLevel)
                : colors.border,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>{getButtonText()}</Text>
          )}
        </TouchableOpacity>
      </View>

      {showSuccess && (
        <Animated.View
          style={[
            styles.successBadge,
            {
              backgroundColor: '#10B981',
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <CheckCircle size={20} color="#FFFFFF" />
          <Text style={styles.successText}>+1 point</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    position: 'relative',
  },
  prompt: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 24,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCounter: {
    fontSize: 13,
    fontWeight: '500',
  },
  submitButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  successBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
