import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Step {
  key: string;
  label: string;
  shortLabel?: string;
  icon?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  colors: {
    primary: string;
    text: string;
    textSecondary: string;
    border: string;
    background: string;
  };
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function StepIndicator({
  steps,
  currentStep,
  colors,
  showLabels = true,
  size = 'medium',
}: StepIndicatorProps) {
  const dotSize = size === 'small' ? 8 : size === 'medium' ? 12 : 16;
  const lineHeight = size === 'small' ? 2 : size === 'medium' ? 3 : 4;

  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <React.Fragment key={step.key}>
              {/* Connecting line (before dot, except first) */}
              {index > 0 && (
                <View
                  style={[
                    styles.line,
                    {
                      height: lineHeight,
                      backgroundColor: isCompleted ? colors.primary : colors.border,
                    },
                  ]}
                />
              )}

              {/* Dot */}
              <View
                style={[
                  styles.dot,
                  {
                    width: isCurrent ? dotSize * 1.5 : dotSize,
                    height: isCurrent ? dotSize * 1.5 : dotSize,
                    borderRadius: isCurrent ? dotSize * 0.75 : dotSize / 2,
                    backgroundColor: isCompleted
                      ? colors.primary
                      : isCurrent
                      ? colors.primary
                      : colors.border,
                    borderWidth: isCurrent ? 3 : 0,
                    borderColor: isCurrent ? `${colors.primary}40` : 'transparent',
                  },
                ]}
              >
                {isCompleted && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
                {isCurrent && step.icon && (
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* Labels */}
      {showLabels && (
        <View style={styles.labelsContainer}>
          {steps.map((step, index) => {
            const isCurrent = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <View key={`label-${step.key}`} style={styles.labelWrapper}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: isCurrent
                        ? colors.primary
                        : isCompleted
                        ? colors.text
                        : colors.textSecondary,
                      fontWeight: isCurrent ? '700' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {step.shortLabel || step.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    maxWidth: 40,
    minWidth: 20,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  stepIcon: {
    fontSize: 10,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 0,
  },
  labelWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
  },
});

export default StepIndicator;