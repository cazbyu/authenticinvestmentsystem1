// WingCheckWellnessStep.tsx - Step 3 of Weekly Alignment
// Zone-reflection delegates to WellnessVisionBoard (matches Role Living Vision Board)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
} from 'react-native';
import {
  ChevronRight,
  Check,
  HelpCircle,
} from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { getWeekStart, formatLocalDate } from '@/lib/dateUtils';
import { WellnessVisionBoard } from './WellnessVisionBoard';
import { AlignmentEscortCard } from './AlignmentEscortCard';

const CompassWellnessIcon = require('@/assets/images/compass-wellness-zones.png');

interface WingCheckWellnessStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  guidedModeEnabled?: boolean;
  weekPlan?: any;
  onDataCapture: (data: {
    wellnessReviewed: boolean;
    zonesChecked: string[];
    flaggedWellnessZones: string[];
  }) => void;
  guidedModeEnabled?: boolean;
  weekPlanItems?: import('@/types/weekPlan').WeekPlanItem[];
  onAddWeekPlanItem?: (item: Omit<import('@/types/weekPlan').WeekPlanItem, 'id' | 'created_at'>) => void;
}

interface WellnessZone {
  id: string;
  domain_id: string;
  name: string;
  description?: string;
  icon?: string;
  priority_order?: number | null;
  fulfillment_vision?: string;
  dream?: string;
  purpose?: string;
  user_zone_id?: string;
}

// Flow states for the step
type FlowState = 
  | 'loading'           // Initial data fetch
  | 'main'              // Main hub view
  | 'prioritize'        // Prioritization selection view
  | 'review-zones'      // List of prioritized zones for review
  | 'zone-reflection';  // Fulfillment + ONE Thing for selected zone

// Brand color for Wellness (green)
const WELLNESS_COLOR = '#39b54a';
const WELLNESS_COLOR_LIGHT = '#39b54a15';
const WELLNESS_COLOR_BORDER = '#39b54a40';

// Zone icon colors by name
function getZoneColor(zoneName: string): string {
  switch (zoneName?.toLowerCase()) {
    case 'physical': return '#EF4444';      // Red
    case 'emotional': return '#EC4899';     // Pink
    case 'intellectual': return '#3B82F6';  // Blue
    case 'social': return '#F59E0B';        // Amber
    case 'spiritual': return '#8B5CF6';     // Purple
    case 'financial': return '#10B981';     // Emerald
    case 'recreational': return '#06B6D4';  // Cyan
    case 'community': return '#6366F1';     // Indigo
    default: return '#6B7280';              // Gray
  }
}

// Zone icons (emoji fallback)
function getZoneEmoji(zoneName: string): string {
  switch (zoneName?.toLowerCase()) {
    case 'physical': return '💪';
    case 'emotional': return '❤️';
    case 'intellectual': return '🧠';
    case 'social': return '👥';
    case 'spiritual': return '✨';
    case 'financial': return '💰';
    case 'recreational': return '🎮';
    case 'community': return '🌍';
    default: return '🌿';
  }
}

export function WingCheckWellnessStep({
  userId,
  colors,
  onNext,
  onBack,
  onRegisterBackHandler,
  guidedModeEnabled = false,
  weekPlan,
  onDataCapture,
  guidedModeEnabled = true,
  weekPlanItems = [],
  onAddWeekPlanItem,
}: WingCheckWellnessStepProps) {
  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  
  // Data state
  const [allZones, setAllZones] = useState<WellnessZone[]>([]);
  const [prioritizedZones, setPrioritizedZones] = useState<WellnessZone[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Escort card dismissed state
  const [escortDismissed, setEscortDismissed] = useState<Record<string, boolean>>({});
  
  // Zone reflection state
  const [selectedReflectionZone, setSelectedReflectionZone] = useState<WellnessZone | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<string>('');
  const [weekStartDay, setWeekStartDay] = useState<'sunday' | 'monday'>('sunday');
  
  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for back handler (prevents stale closures)
  const flowStateRef = useRef<FlowState>(flowState);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  // Calculate week start date after we have user preference
  useEffect(() => {
    if (weekStartDay) {
      const weekStart = getWeekStart(new Date(), weekStartDay);
      setWeekStartDate(formatLocalDate(weekStart));
    }
  }, [weekStartDay]);

  // Back handler for parent component
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => {
        const currentFlowState = flowStateRef.current;
        
        if (currentFlowState === 'main') {
          // At root - let parent handle exit
          return false;
        } else if (currentFlowState === 'prioritize') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'review-zones') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'zone-reflection') {
          setSelectedReflectionZone(null);
          setFlowState('review-zones');
          return true;
        }
        return false;
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

 async function loadData() {
    try {
      const supabase = getSupabaseClient();

      // Load user's week start preference
      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('week_start_day')
        .eq('id', userId)
        .single();
      
      if (userData?.week_start_day) {
        setWeekStartDay(userData.week_start_day as 'sunday' | 'monday');
      }

      // Load all wellness zones from domains table
      const { data: domainsData, error: domainsError } = await supabase
        .from('0008-ap-domains')
        .select('id, name, description, icon')
        .order('name', { ascending: true });

      if (domainsError) throw domainsError;

      // Load user's wellness zone preferences
      const { data: userZonesData, error: userZonesError } = await supabase
        .from('0008-ap-user-wellness-zones')
        .select('id, domain_id, priority_order, fulfillment_vision, dream, purpose, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority_order', { ascending: true, nullsFirst: false });

      if (userZonesError && userZonesError.code !== 'PGRST116') {
        throw userZonesError;
      }

      const userZones = userZonesData || [];

      // Merge domains with user preferences
      const zones: WellnessZone[] = (domainsData || []).map(domain => {
        const userZone = userZones.find(uz => uz.domain_id === domain.id);
        return {
          id: domain.id,
          domain_id: domain.id,
          name: domain.name,
          description: domain.description,
          icon: domain.icon,
          priority_order: userZone?.priority_order || null,
          fulfillment_vision: userZone?.fulfillment_vision || null,
          dream: userZone?.dream || null,
          purpose: userZone?.purpose || null,
          user_zone_id: userZone?.id || null,
        };
      });

      setAllZones(zones);

      // Get prioritized zones
      const prioritized = zones
        .filter(z => z.priority_order !== null && z.priority_order !== undefined)
        .sort((a, b) => (a.priority_order || 0) - (b.priority_order || 0));
      
      setPrioritizedZones(prioritized);
      setSelectedZoneIds(prioritized.map(z => z.id));

      setFlowState('main');

    } catch (error) {
      console.error('Error loading wellness zones data:', error);
      setFlowState('main');
    } finally {
      setLoading(false);
    }
  }

  // Slide transition helper
  function slideToState(newState: FlowState) {
    Animated.timing(slideAnim, {
      toValue: -1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setFlowState(newState);
      slideAnim.setValue(1);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }

  function toggleZoneSelection(zoneId: string) {
    setSelectedZoneIds(prev => {
      if (prev.includes(zoneId)) {
        return prev.filter(id => id !== zoneId);
      } else {
        return [...prev, zoneId];
      }
    });
  }

  async function savePriorities() {
    if (selectedZoneIds.length < 3) {
      if (Platform.OS === 'web') {
        window.alert('Please prioritize at least 3 wellness zones to continue.');
      } else {
        Alert.alert('Prioritize Zones', 'Please prioritize at least 3 wellness zones to continue.');
      }
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      // Clear all existing priority_order values for this user
      const { error: clearError } = await supabase
        .from('0008-ap-user-wellness-zones')
        .update({ priority_order: null })
        .eq('user_id', userId);

      if (clearError) throw clearError;

      // Upsert priority_order for selected zones
      for (let i = 0; i < selectedZoneIds.length; i++) {
        const zoneId = selectedZoneIds[i];
        const zone = allZones.find(z => z.id === zoneId);
        
        if (zone?.user_zone_id) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('0008-ap-user-wellness-zones')
            .update({ priority_order: i + 1 })
            .eq('id', zone.user_zone_id);

          if (updateError) throw updateError;
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('0008-ap-user-wellness-zones')
            .insert({
              user_id: userId,
              domain_id: zoneId,
              priority_order: i + 1,
              is_active: true,
            });

          if (insertError) throw insertError;
        }
      }

      // Reload data to get updated priorities
      await loadData();
      slideToState('main');
    } catch (error) {
      console.error('Error saving priorities:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save priorities. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save priorities. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleContinueToGoals() {
    onDataCapture({
      wellnessReviewed: true,
      zonesChecked: selectedZoneIds,
      flaggedWellnessZones: [], // Could add flagging feature later
    });
    onNext();
  }

  function getSelectionNumber(zoneId: string): number | null {
    const index = selectedZoneIds.indexOf(zoneId);
    return index >= 0 ? index + 1 : null;
  }

  // Get all zones sorted: prioritized first, then alphabetical
  function getAllZonesSorted(): WellnessZone[] {
    const prioritizedIds = new Set(prioritizedZones.map(z => z.id));
    const nonPrioritized = allZones
      .filter(z => !prioritizedIds.has(z.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return [...prioritizedZones, ...nonPrioritized];
  }

  // ===== RENDER: LOADING STATE =====
  if (flowState === 'loading' || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={WELLNESS_COLOR} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your wellness zones...
        </Text>
      </View>
    );
  }

  // ===== RENDER: PRIORITIZE STATE =====
  if (flowState === 'prioritize') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Standard format, NO back arrow */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: WELLNESS_COLOR_LIGHT }]}>
                <Image source={CompassWellnessIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: WELLNESS_COLOR }]}>Step 3</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Prioritize Zones</Text>
              </View>
            </View>
          </View>

          {/* Instructions */}
          <View style={[styles.instructionCard, { backgroundColor: WELLNESS_COLOR_LIGHT, borderColor: WELLNESS_COLOR_BORDER }]}>
            <Text style={[styles.instructionText, { color: colors.text }]}>
              Tap to prioritize at least your top 3 wellness zones
            </Text>
            <Text style={[styles.instructionHint, { color: colors.textSecondary }]}>
              The order you select them sets their rank (W1, W2, W3...).
            </Text>
          </View>

          {/* Progress */}
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {selectedZoneIds.length} of {allZones.length} zones prioritized
              {selectedZoneIds.length < 3 && ` (minimum 3 required)`}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: selectedZoneIds.length >= 3 ? WELLNESS_COLOR : '#F59E0B',
                    width: `${Math.min((selectedZoneIds.length / Math.max(allZones.length, 3)) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Zones Grid */}
          <View style={styles.zonesGrid}>
            {allZones.map(zone => {
              const isSelected = selectedZoneIds.includes(zone.id);
              const selectionNumber = getSelectionNumber(zone.id);
              const zoneColor = getZoneColor(zone.name);

              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneCard,
                    {
                      backgroundColor: isSelected ? `${zoneColor}15` : colors.surface,
                      borderColor: isSelected ? zoneColor : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => toggleZoneSelection(zone.id)}
                  activeOpacity={0.7}
                >
                  {isSelected && selectionNumber && (
                    <View style={[styles.selectionBadge, { backgroundColor: zoneColor }]}>
                      <Text style={styles.selectionBadgeText}>{selectionNumber}</Text>
                    </View>
                  )}

                  <View style={[styles.zoneIconContainer, { backgroundColor: `${zoneColor}20` }]}>
                    <Text style={styles.zoneEmoji}>{getZoneEmoji(zone.name)}</Text>
                  </View>

                  <Text
                    style={[
                      styles.zoneLabel,
                      { color: isSelected ? zoneColor : colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {zone.name}
                  </Text>

                  {isSelected && (
                    <View style={[styles.checkContainer, { backgroundColor: zoneColor }]}>
                      <Check size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: selectedZoneIds.length >= 3 ? WELLNESS_COLOR : colors.border,
                opacity: saving ? 0.7 : 1,
              },
            ]}
            onPress={savePriorities}
            disabled={saving || selectedZoneIds.length < 3}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Save Priorities</Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: REVIEW ZONES STATE =====
  if (flowState === 'review-zones') {
    const allZonesSorted = getAllZonesSorted();
    
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Standard format, NO back arrow */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: WELLNESS_COLOR_LIGHT }]}>
                <Image source={CompassWellnessIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: WELLNESS_COLOR }]}>Step 3</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Review Your Zones</Text>
              </View>
            </View>
          </View>

          {/* Review Zones Card */}
          <View style={[styles.identityCard, { backgroundColor: WELLNESS_COLOR_LIGHT, borderColor: WELLNESS_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: WELLNESS_COLOR }]}>
                <Text style={styles.identityIconEmoji}>🌿</Text>
              </View>
              <Text style={[styles.identityLabel, { color: WELLNESS_COLOR }]}>REVIEW YOUR ZONES</Text>
            </View>
            
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              Tap a zone to define fulfillment and set your ONE Thing
            </Text>
          </View>

          {/* Escort: After reviewing wellness zones */}
          {guidedModeEnabled && !escortDismissed['step3-zones-review'] && (
            <AlignmentEscortCard
              type="nudge"
              message="Your roles only thrive when YOU are sustained. As you check each zone, notice where you could invest a little this week."
              icon="compass"
              stepColor={WELLNESS_COLOR}
              onDismiss={() => setEscortDismissed(prev => ({ ...prev, 'step3-zones-review': true }))}
            />
          )}

          {/* All Zones List - Prioritized first, then alphabetical */}
          {allZonesSorted.map((zone) => {
            const zoneColor = getZoneColor(zone.name);
            const hasFulfillment = !!zone.fulfillment_vision;
            const priorityIndex = prioritizedZones.findIndex(z => z.id === zone.id);
            const isPrioritized = priorityIndex >= 0;
            
            return (
              <TouchableOpacity
                key={zone.id}
                style={[
                  styles.reviewZoneCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: hasFulfillment ? '#10b981' : colors.border,
                    borderLeftColor: zoneColor,
                    borderLeftWidth: 4,
                  }
                ]}
                onPress={() => {
                  setSelectedReflectionZone(zone);
                  slideToState('zone-reflection');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.reviewZoneLeft}>
                  {isPrioritized && (
                    <View style={[styles.reviewZoneBadge, { backgroundColor: zoneColor }]}>
                      <Text style={styles.reviewZoneBadgeText}>W{priorityIndex + 1}</Text>
                    </View>
                  )}
                  <View style={[styles.reviewZoneIconWrap, { backgroundColor: `${zoneColor}20` }]}>
                    <Text style={styles.reviewZoneEmoji}>{getZoneEmoji(zone.name)}</Text>
                  </View>
                  <View style={styles.reviewZoneInfo}>
                    <Text style={[styles.reviewZoneLabel, { color: colors.text }]}>{zone.name}</Text>
                    {zone.fulfillment_vision ? (
                      <Text style={[styles.reviewZoneFulfillment, { color: colors.textSecondary }]} numberOfLines={1}>
                        {zone.fulfillment_vision}
                      </Text>
                    ) : (
                      <Text style={[styles.reviewZoneFulfillment, { color: '#F59E0B' }]}>
                        Tap to define fulfillment
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.reviewZoneRight}>
                  {hasFulfillment && (
                    <View style={[styles.checkCircle, { backgroundColor: '#10b981' }]}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  )}
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}

          {guidedModeEnabled && (
            <View style={{ marginVertical: 12 }}>
              <AlignmentEscortCard
                type="nudge"
                icon="sparkles"
                message="Your roles only thrive when YOU are sustained. As you check each zone, notice where you could invest a little this week."
                colors={{
                  background: WELLNESS_COLOR_LIGHT,
                  text: colors.text,
                  accent: WELLNESS_COLOR,
                  border: WELLNESS_COLOR_BORDER,
                }}
              />
            </View>
          )}

          {/* Done Reviewing Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: WELLNESS_COLOR }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: WELLNESS_COLOR }]}>Done Reviewing</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: ZONE REFLECTION STATE (Vision Board) =====
  if (flowState === 'zone-reflection' && selectedReflectionZone) {
    const priorityIndex = prioritizedZones.findIndex(z => z.id === selectedReflectionZone.id);

    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <WellnessVisionBoard
          zone={selectedReflectionZone}
          userId={userId}
          colors={colors}
          weekStartDate={weekStartDate}
          priorityIndex={priorityIndex >= 0 ? priorityIndex : 0}
          onBack={() => {
            setSelectedReflectionZone(null);
            slideToState('review-zones');
          }}
          onZoneUpdated={(updatedZone) => {
            setSelectedReflectionZone(updatedZone);
            setAllZones(prev => prev.map(z =>
              z.id === updatedZone.id ? updatedZone : z
            ));
            setPrioritizedZones(prev => prev.map(z =>
              z.id === updatedZone.id ? updatedZone : z
            ));
          }}
          onAddWeekPlanItem={onAddWeekPlanItem}
        />
      </Animated.View>
    );
  }

  // ===== RENDER: MAIN STATE (Hub View) =====
  const top3Zones = prioritizedZones.slice(0, 3);
  const hasMinimumPriorities = prioritizedZones.length >= 3;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header - Matching Step 1 & 2 style exactly */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.compassContainer, { backgroundColor: WELLNESS_COLOR_LIGHT }]}>
            <Image source={CompassWellnessIcon} style={styles.compassIcon} resizeMode="contain" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.stepLabel, { color: WELLNESS_COLOR }]}>Step 3</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Wing Check: Wellness</Text>
          </View>
          <TouchableOpacity
            style={styles.tooltipButton}
            onPress={() => setShowTooltip(!showTooltip)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HelpCircle size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showTooltip && (
          <View style={[styles.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              Your wellness zones represent the different dimensions of a balanced life—physical, emotional, spiritual, etc.
              Prioritize the zones that need your attention right now.
            </Text>
          </View>
        )}
      </View>

      {/* My Top 3 Wellness Zones Card - Styled like My Top 3 Active Roles */}
      <View style={[styles.identityCard, { backgroundColor: WELLNESS_COLOR_LIGHT, borderColor: WELLNESS_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: WELLNESS_COLOR }]}>
            <Text style={styles.identityIconEmoji}>🌿</Text>
          </View>
          <Text style={[styles.identityLabel, { color: WELLNESS_COLOR }]}>MY TOP 3 WELLNESS ZONES</Text>
          <TouchableOpacity onPress={() => slideToState('prioritize')}>
            <Text style={[styles.editLink, { color: WELLNESS_COLOR }]}>Update</Text>
          </TouchableOpacity>
        </View>
        
        {top3Zones.length > 0 ? (
          <View style={styles.top3List}>
            {top3Zones.map((zone, index) => {
              const zoneColor = getZoneColor(zone.name);
              return (
                <View key={zone.id} style={styles.top3Item}>
                  <View style={[styles.top3Badge, { backgroundColor: zoneColor }]}>
                    <Text style={styles.top3BadgeText}>W{index + 1}</Text>
                  </View>
                  <View style={[styles.top3ZoneIcon, { backgroundColor: `${zoneColor}20` }]}>
                    <Text style={styles.top3ZoneEmoji}>{getZoneEmoji(zone.name)}</Text>
                  </View>
                  <Text style={[styles.top3ZoneLabel, { color: colors.text }]}>{zone.name}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
            No zones prioritized yet. Tap "Update" to set your priorities.
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsSection}>
        {/* Review Your Zones Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            { 
              backgroundColor: colors.surface, 
              borderColor: hasMinimumPriorities ? WELLNESS_COLOR : colors.border,
              borderWidth: hasMinimumPriorities ? 2 : 1,
              opacity: hasMinimumPriorities ? 1 : 0.5,
            }
          ]}
          onPress={() => hasMinimumPriorities && slideToState('review-zones')}
          disabled={!hasMinimumPriorities}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionButtonIcon, { backgroundColor: WELLNESS_COLOR }]}>
              <Text style={styles.actionButtonEmoji}>🌿</Text>
            </View>
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: hasMinimumPriorities ? WELLNESS_COLOR : colors.text }]}>
                Review Your Zones
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                Set fulfillment vision & ONE Thing
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={hasMinimumPriorities ? WELLNESS_COLOR : colors.textSecondary} />
        </TouchableOpacity>

        {/* Continue to Goals Button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: hasMinimumPriorities ? WELLNESS_COLOR : colors.border,
            },
          ]}
          onPress={handleContinueToGoals}
          disabled={!hasMinimumPriorities}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue to Goals</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {!hasMinimumPriorities && (
        <Text style={[styles.warningText, { color: '#F59E0B' }]}>
          Please prioritize at least 3 wellness zones to continue
        </Text>
      )}

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
  
  // Header - Matching Step 1 & 2 exactly (72x72 container, 56x56 icon)
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compassContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassIcon: {
    width: 56,
    height: 56,
  },
  headerTextContainer: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  tooltipButton: {
    padding: 8,
  },
  tooltipContent: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Identity Card - Styled like My Core Identity / My Top 3 Active Roles
  identityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  identityIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityIconEmoji: {
    fontSize: 12,
  },
  identityLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  identitySubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Top 3 Zones List
  top3List: {
    gap: 10,
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  top3Badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top3BadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  top3ZoneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top3ZoneEmoji: {
    fontSize: 18,
  },
  top3ZoneLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },

  // Action Buttons Section
  actionButtonsSection: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  actionButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonEmoji: {
    fontSize: 16,
  },
  actionButtonTextWrap: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  // Progress
  progressCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Instruction Card
  instructionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  instructionHint: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },

  // Zones Grid (for Prioritize screen)
  zonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  zoneCard: {
    width: '30%',
    minWidth: 90,
    aspectRatio: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  zoneIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneEmoji: {
    fontSize: 24,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  checkContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Review Zone Cards
  reviewZoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  reviewZoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  reviewZoneBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewZoneBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewZoneIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewZoneEmoji: {
    fontSize: 20,
  },
  reviewZoneInfo: {
    flex: 1,
  },
  reviewZoneLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewZoneFulfillment: {
    fontSize: 13,
    marginTop: 2,
  },
  reviewZoneRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

});

export default WingCheckWellnessStep;