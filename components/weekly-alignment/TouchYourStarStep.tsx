import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { MiniCompass } from '@/components/compass/MiniCompass';
import { getSupabaseClient } from '@/lib/supabase';

interface TouchYourStarStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onDataCapture: (data: {
    missionReflection?: string;
    visionAcknowledged?: boolean;
    valuesAcknowledged?: boolean;
  }) => void;
}

interface NorthStarData {
  mission?: string;
  vision?: string;
  values?: Array<{ id: string; value: string; description?: string }>;
}

export function TouchYourStarStep({
  userId,
  colors,
  onNext,
  onDataCapture,
}: TouchYourStarStepProps) {
  const [loading, setLoading] = useState(true);
  const [northStarData, setNorthStarData] = useState<NorthStarData>({});
  const [reflection, setReflection] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    loadNorthStarData();
  }, []);

  async function loadNorthStarData() {
    try {
      const supabase = getSupabaseClient();

      // Load all North Star data from single table
      const { data: northStar } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, core_values, life_motto')
        .eq('user_id', userId)
        .maybeSingle();

      // Transform core_values from JSONB array to expected format
      // core_values is stored as: ["Value 1", "Value 2"] or [{value: "Value 1"}, ...]
      let formattedValues: Array<{ id: string; value: string; description?: string }> = [];
      
      if (northStar?.core_values && Array.isArray(northStar.core_values)) {
        formattedValues = northStar.core_values.map((v: any, index: number) => {
          if (typeof v === 'string') {
            return { id: `value-${index}`, value: v };
          } else if (typeof v === 'object' && v.value) {
            return { id: v.id || `value-${index}`, value: v.value, description: v.description };
          }
          return { id: `value-${index}`, value: String(v) };
        });
      }

      setNorthStarData({
        mission: northStar?.mission_statement,
        vision: northStar?.['5yr_vision'],
        values: formattedValues,
      });
    } catch (error) {
      console.error('Error loading North Star data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAcknowledge() {
    setAcknowledged(true);
    onDataCapture({
      missionReflection: reflection || undefined,
      visionAcknowledged: true,
      valuesAcknowledged: true,
    });
  }

  function handleNext() {
    if (!acknowledged) {
      handleAcknowledge();
    }
    onNext();
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your North Star...
        </Text>
      </View>
    );
  }

  const hasNorthStar = northStarData.mission || northStarData.vision || (northStarData.values && northStarData.values.length > 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={[styles.iconCircle, { backgroundColor: '#ed1c2420' }]}>
          <Star size={40} color="#ed1c24" fill="#ed1c24" />
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Touch Your Star
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Reconnect with your guiding purpose
        </Text>
      </View>

      {!hasNorthStar ? (
        /* Empty State */
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Sparkles size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            Your North Star Awaits
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            You haven't defined your Mission, Vision, or Values yet. That's okay! You can set these up in the North Star section.
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { borderColor: '#ed1c24' }]}
            onPress={() => {
              // Could navigate to North Star setup
            }}
          >
            <Text style={[styles.setupButtonText, { color: '#ed1c24' }]}>
              Set Up Later
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Mission Statement */}
          {northStarData.mission && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: '#ed1c24' }]}>MISSION</Text>
              </View>
              <Text style={[styles.statementText, { color: colors.text }]}>
                "{northStarData.mission}"
              </Text>
            </View>
          )}

          {/* Vision Statement */}
          {northStarData.vision && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: '#ed1c24' }]}>VISION</Text>
              </View>
              <Text style={[styles.statementText, { color: colors.text }]}>
                "{northStarData.vision}"
              </Text>
            </View>
          )}

          {/* Core Values */}
          {northStarData.values && northStarData.values.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: '#ed1c24' }]}>CORE VALUES</Text>
              </View>
              <View style={styles.valuesContainer}>
                {northStarData.values.map((value, index) => (
                  <View key={value.id} style={styles.valueTag}>
                    <Text style={[styles.valueText, { color: colors.text }]}>
                      {value.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Reflection Prompt */}
          <View style={[styles.reflectionCard, { backgroundColor: '#ed1c2410', borderColor: '#ed1c2440' }]}>
            <Text style={[styles.reflectionPrompt, { color: colors.text }]}>
              💭 Quick Check-In
            </Text>
            <Text style={[styles.reflectionQuestion, { color: colors.textSecondary }]}>
              Is there anything weighing on you that's pulling you away from your purpose this week?
            </Text>
            <TextInput
              style={[
                styles.reflectionInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Optional: jot down any thoughts..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={reflection}
              onChangeText={setReflection}
              textAlignVertical="top"
            />
          </View>
        </>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: '#ed1c24' }]}
        onPress={handleNext}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>
          {acknowledged ? 'Continue' : 'Acknowledge & Continue'}
        </Text>
        <ChevronRight size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  setupButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statementText: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  valuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueTag: {
    backgroundColor: '#ed1c2415',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reflectionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  reflectionPrompt: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  reflectionQuestion: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  reflectionInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default TouchYourStarStep;