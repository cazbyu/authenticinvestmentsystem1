// ============================================================================
// BigRocksStep.tsx - Big Rocks + ONE Thing selection for Weekly Alignment
// ============================================================================
// Users define 2-4 key priorities ("big rocks") for the week and select
// the single most important one as their ONE Thing.
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { ChevronRight, ChevronLeft, Plus, Trash2, Calendar, Check } from 'lucide-react-native';
import { CompassDirectionHeader } from '@/components/compass/CompassDirectionHeader';
import {
  createBigRockTask,
  BigRock,
} from '@/lib/weeklyAlignmentCompassService';

interface BigRocksStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onDataCapture: (data: Record<string, any>) => void;
  weeklyAlignmentId: string | null;
  weekStartDate: string;
  weekEndDate: string;
}

interface BigRockEntry {
  id: string;
  title: string;
  hasCalendarBlock: boolean;
  calendarDate: string;
}

const MAX_BIG_ROCKS = 4;

export function BigRocksStep({
  userId,
  colors,
  onNext,
  onBack,
  onDataCapture,
  weeklyAlignmentId,
  weekStartDate,
  weekEndDate,
}: BigRocksStepProps) {
  const [bigRocks, setBigRocks] = useState<BigRockEntry[]>([
    { id: '1', title: '', hasCalendarBlock: false, calendarDate: '' },
  ]);
  const [oneThing, setOneThing] = useState<string>('');
  const [oneThingSource, setOneThingSource] = useState<'custom' | 'rock'>('custom');
  const [saving, setSaving] = useState(false);

  const addBigRock = useCallback(() => {
    if (bigRocks.length >= MAX_BIG_ROCKS) return;
    setBigRocks(prev => [
      ...prev,
      {
        id: String(Date.now()),
        title: '',
        hasCalendarBlock: false,
        calendarDate: '',
      },
    ]);
  }, [bigRocks.length]);

  const removeBigRock = useCallback((id: string) => {
    setBigRocks(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(r => r.id !== id);
    });
  }, []);

  const updateBigRock = useCallback((id: string, field: keyof BigRockEntry, value: any) => {
    setBigRocks(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }, []);

  const selectRockAsOneThing = useCallback((title: string) => {
    setOneThing(title);
    setOneThingSource('rock');
  }, []);

  const handleContinue = useCallback(async () => {
    const filledRocks = bigRocks.filter(r => r.title.trim().length > 0);
    if (filledRocks.length === 0) {
      Alert.alert('Add at least one Big Rock', 'What is the most important thing to accomplish this week?');
      return;
    }

    if (!oneThing.trim()) {
      Alert.alert('Select your ONE Thing', 'Which single item would make this week a success no matter what?');
      return;
    }

    setSaving(true);
    try {
      const savedRocks: BigRock[] = [];

      for (const rock of filledRocks) {
        const dueDate = rock.hasCalendarBlock && rock.calendarDate ? rock.calendarDate : undefined;
        const taskId = await createBigRockTask(userId, rock.title.trim(), weeklyAlignmentId, dueDate);
        savedRocks.push({
          title: rock.title.trim(),
          task_id: taskId,
          has_calendar_block: rock.hasCalendarBlock,
        });
      }

      onDataCapture({
        big_rocks: savedRocks,
        one_thing: oneThing.trim(),
      });
      onNext();
    } catch (err: any) {
      console.error('Error saving big rocks:', err);
      Alert.alert('Error', 'Could not save your big rocks. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [bigRocks, oneThing, userId, weeklyAlignmentId, onDataCapture, onNext]);

  const filledRocks = bigRocks.filter(r => r.title.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CompassDirectionHeader
          direction="south"
          label="This Week"
          powerQuestion={'"What am I doing to get there?"'}
        />

        {/* Big Rocks Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors?.text || '#1a1a1a' }]}>
            Big Rocks
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors?.textSecondary || '#666' }]}>
            What are the 2-4 things that, if done this week, would make it a success?
          </Text>

          {bigRocks.map((rock, index) => (
            <View
              key={rock.id}
              style={[styles.rockCard, { borderColor: colors?.border || '#e5e7eb' }]}
            >
              <View style={styles.rockHeader}>
                <Text style={[styles.rockNumber, { color: colors?.primary || '#4169E1' }]}>
                  #{index + 1}
                </Text>
                {bigRocks.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeBigRock(rock.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[
                  styles.rockInput,
                  {
                    color: colors?.text || '#1a1a1a',
                    borderColor: colors?.border || '#e5e7eb',
                  },
                ]}
                placeholder="e.g., Finish quarterly report..."
                placeholderTextColor={colors?.textSecondary || '#9ca3af'}
                value={rock.title}
                onChangeText={text => updateBigRock(rock.id, 'title', text)}
                multiline={false}
                returnKeyType="done"
              />

              {/* Calendar Block Toggle */}
              <View style={styles.calendarToggleRow}>
                <Calendar size={16} color={colors?.textSecondary || '#9ca3af'} />
                <Text style={[styles.calendarLabel, { color: colors?.textSecondary || '#666' }]}>
                  Calendar block?
                </Text>
                <Switch
                  value={rock.hasCalendarBlock}
                  onValueChange={val => updateBigRock(rock.id, 'hasCalendarBlock', val)}
                  trackColor={{ false: '#d1d5db', true: '#4169E180' }}
                  thumbColor={rock.hasCalendarBlock ? '#4169E1' : '#f4f4f5'}
                />
              </View>

              {rock.hasCalendarBlock && (
                <TextInput
                  style={[
                    styles.dateInput,
                    {
                      color: colors?.text || '#1a1a1a',
                      borderColor: colors?.border || '#e5e7eb',
                    },
                  ]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors?.textSecondary || '#9ca3af'}
                  value={rock.calendarDate}
                  onChangeText={text => updateBigRock(rock.id, 'calendarDate', text)}
                  keyboardType="default"
                  maxLength={10}
                />
              )}
            </View>
          ))}

          {bigRocks.length < MAX_BIG_ROCKS && (
            <TouchableOpacity
              style={[styles.addButton, { borderColor: colors?.border || '#e5e7eb' }]}
              onPress={addBigRock}
              activeOpacity={0.7}
            >
              <Plus size={18} color={colors?.primary || '#4169E1'} />
              <Text style={[styles.addButtonText, { color: colors?.primary || '#4169E1' }]}>
                Add another rock
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ONE Thing Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors?.text || '#1a1a1a' }]}>
            ONE Thing
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors?.textSecondary || '#666' }]}>
            Of everything you've committed to — what is the ONE thing that makes this week a success no matter what else happens?
          </Text>

          {/* Select from big rocks */}
          {filledRocks.length > 0 && (
            <View style={styles.rockSelectionList}>
              {filledRocks.map(rock => {
                const isSelected = oneThingSource === 'rock' && oneThing === rock.title.trim();
                return (
                  <TouchableOpacity
                    key={rock.id}
                    style={[
                      styles.rockSelectionItem,
                      {
                        borderColor: isSelected
                          ? colors?.primary || '#4169E1'
                          : colors?.border || '#e5e7eb',
                        backgroundColor: isSelected ? '#4169E108' : '#fff',
                      },
                    ]}
                    onPress={() => selectRockAsOneThing(rock.title.trim())}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isSelected
                            ? colors?.primary || '#4169E1'
                            : '#d1d5db',
                          backgroundColor: isSelected
                            ? colors?.primary || '#4169E1'
                            : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Check size={12} color="#fff" />}
                    </View>
                    <Text
                      style={[
                        styles.rockSelectionText,
                        { color: colors?.text || '#1a1a1a' },
                      ]}
                      numberOfLines={1}
                    >
                      {rock.title.trim()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Or type custom */}
          <Text style={[styles.orDivider, { color: colors?.textSecondary || '#999' }]}>
            — or type your own —
          </Text>
          <TextInput
            style={[
              styles.oneThingInput,
              {
                color: colors?.text || '#1a1a1a',
                borderColor:
                  oneThingSource === 'custom' && oneThing.trim()
                    ? colors?.primary || '#4169E1'
                    : colors?.border || '#e5e7eb',
              },
            ]}
            placeholder="My ONE thing this week is..."
            placeholderTextColor={colors?.textSecondary || '#9ca3af'}
            value={oneThingSource === 'custom' ? oneThing : ''}
            onChangeText={text => {
              setOneThing(text);
              setOneThingSource('custom');
            }}
            multiline={false}
            returnKeyType="done"
          />
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.bottomBar, { borderTopColor: colors?.border || '#e5e7eb' }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={20} color={colors?.textSecondary || '#666'} />
          <Text style={[styles.backButtonText, { color: colors?.textSecondary || '#666' }]}>
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: colors?.primary || '#4169E1', opacity: saving ? 0.6 : 1 },
          ]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continue</Text>
              <ChevronRight size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  rockCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  rockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rockNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  rockInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  calendarToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  calendarLabel: {
    flex: 1,
    fontSize: 13,
  },
  dateInput: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rockSelectionList: {
    gap: 8,
    marginBottom: 8,
  },
  rockSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rockSelectionText: {
    flex: 1,
    fontSize: 15,
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 12,
    marginVertical: 12,
  },
  oneThingInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
