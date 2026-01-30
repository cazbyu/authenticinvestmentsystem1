import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Leaf, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface WingCheckWellnessStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onDataCapture: (data: {
    wellnessReviewed: boolean;
    zonesChecked: string[];
    flaggedZones: string[];
  }) => void;
}

interface WellnessZone {
  id: string;
  name: string;
  icon: string;
  current_score?: number;
  trend?: 'up' | 'down' | 'stable';
  last_entry_date?: string;
}

// Default wellness zones if user hasn't customized
const DEFAULT_ZONES: WellnessZone[] = [
  { id: 'physical', name: 'Physical', icon: '💪' },
  { id: 'mental', name: 'Mental', icon: '🧠' },
  { id: 'emotional', name: 'Emotional', icon: '💖' },
  { id: 'spiritual', name: 'Spiritual', icon: '✨' },
  { id: 'social', name: 'Social', icon: '👥' },
  { id: 'financial', name: 'Financial', icon: '💰' },
];

type ZoneStatus = 'good' | 'okay' | 'needs_attention' | null;

export function WingCheckWellnessStep({
  userId,
  colors,
  onNext,
  onBack,
  onDataCapture,
}: WingCheckWellnessStepProps) {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<WellnessZone[]>([]);
  const [zoneStatus, setZoneStatus] = useState<Record<string, ZoneStatus>>({});
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  useEffect(() => {
    loadWellnessData();
  }, []);

  async function loadWellnessData() {
    try {
      const supabase = getSupabaseClient();

      // Try to load user's custom wellness zones
      const { data: customZones } = await supabase
        .from('0008-ap-wellness-zones')
        .select('id, name, icon, sort_order')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      // Try to load recent wellness entries for scoring
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const { data: recentEntries } = await supabase
        .from('0008-ap-wellness-entries')
        .select('zone_id, score, created_at')
        .eq('user_id', userId)
        .gte('created_at', weekAgoStr)
        .order('created_at', { ascending: false });

      // Process zones with scores
      const processedZones = (customZones && customZones.length > 0 ? customZones : DEFAULT_ZONES).map(zone => {
        const zoneEntries = recentEntries?.filter(e => e.zone_id === zone.id) || [];
        const avgScore = zoneEntries.length > 0
          ? zoneEntries.reduce((sum, e) => sum + (e.score || 0), 0) / zoneEntries.length
          : undefined;

        // Calculate trend
        let trend: 'up' | 'down' | 'stable' | undefined;
        if (zoneEntries.length >= 2) {
          const recent = zoneEntries[0]?.score || 0;
          const older = zoneEntries[zoneEntries.length - 1]?.score || 0;
          if (recent > older) trend = 'up';
          else if (recent < older) trend = 'down';
          else trend = 'stable';
        }

        return {
          ...zone,
          current_score: avgScore,
          trend,
          last_entry_date: zoneEntries[0]?.created_at,
        };
      });

      setZones(processedZones);
    } catch (error) {
      console.error('Error loading wellness data:', error);
      // Fall back to default zones
      setZones(DEFAULT_ZONES);
    } finally {
      setLoading(false);
    }
  }

  function setZoneHealth(zoneId: string, status: ZoneStatus) {
    setZoneStatus(prev => ({
      ...prev,
      [zoneId]: status,
    }));
  }

  function handleNext() {
    const checkedZones = Object.keys(zoneStatus).filter(id => zoneStatus[id] !== null);
    const flaggedZones = Object.keys(zoneStatus).filter(id => zoneStatus[id] === 'needs_attention');

    onDataCapture({
      wellnessReviewed: true,
      zonesChecked: checkedZones,
      flaggedZones: flaggedZones,
    });
    
    onNext();
  }

  function getTrendIcon(trend?: 'up' | 'down' | 'stable') {
    switch (trend) {
      case 'up':
        return <TrendingUp size={16} color="#10B981" />;
      case 'down':
        return <TrendingDown size={16} color="#EF4444" />;
      case 'stable':
        return <Minus size={16} color="#F59E0B" />;
      default:
        return null;
    }
  }

  function getScoreColor(score?: number): string {
    if (score === undefined) return '#6B7280';
    if (score >= 7) return '#10B981';
    if (score >= 5) return '#F59E0B';
    return '#EF4444';
  }

  function getStatusEmoji(status: ZoneStatus): string {
    switch (status) {
      case 'good': return '💚';
      case 'okay': return '💛';
      case 'needs_attention': return '❤️‍🩹';
      default: return '';
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading wellness zones...
        </Text>
      </View>
    );
  }

  const checkedCount = Object.values(zoneStatus).filter(v => v !== null).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={[styles.iconCircle, { backgroundColor: '#39b54a20' }]}>
          <Leaf size={40} color="#39b54a" />
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Wing Check: Wellness
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          How's your wellbeing this week?
        </Text>
      </View>

      {/* Progress Indicator */}
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {checkedCount} of {zones.length} zones checked
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: '#39b54a',
                width: `${zones.length > 0 ? (checkedCount / zones.length) * 100 : 0}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Instructions */}
      <View style={[styles.instructionCard, { backgroundColor: '#39b54a10', borderColor: '#39b54a40' }]}>
        <Text style={[styles.instructionText, { color: colors.text }]}>
          🌿 Tap each zone and give an honest assessment. This helps you spot areas that need nurturing.
        </Text>
      </View>

      {/* Wellness Zones */}
      <View style={styles.zonesGrid}>
        {zones.map(zone => {
          const status = zoneStatus[zone.id];
          const isExpanded = expandedZone === zone.id;

          return (
            <View key={zone.id} style={styles.zoneContainer}>
              <TouchableOpacity
                style={[
                  styles.zoneCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: status ? '#39b54a' : colors.border,
                    borderWidth: status ? 2 : 1,
                  },
                ]}
                onPress={() => setExpandedZone(isExpanded ? null : zone.id)}
                activeOpacity={0.7}
              >
                <View style={styles.zoneHeader}>
                  <Text style={styles.zoneIcon}>{zone.icon}</Text>
                  <Text style={[styles.zoneName, { color: colors.text }]}>
                    {zone.name}
                  </Text>
                  {status && (
                    <Text style={styles.statusEmoji}>{getStatusEmoji(status)}</Text>
                  )}
                </View>

                {zone.current_score !== undefined && (
                  <View style={styles.scoreRow}>
                    <Text style={[styles.scoreText, { color: getScoreColor(zone.current_score) }]}>
                      {zone.current_score.toFixed(1)}/10
                    </Text>
                    {getTrendIcon(zone.trend)}
                  </View>
                )}
              </TouchableOpacity>

              {/* Status Selection */}
              {isExpanded && (
                <View style={styles.statusButtons}>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { 
                        backgroundColor: status === 'good' ? '#10B98120' : colors.background,
                        borderColor: status === 'good' ? '#10B981' : colors.border,
                      },
                    ]}
                    onPress={() => setZoneHealth(zone.id, 'good')}
                  >
                    <Text style={styles.statusButtonEmoji}>💚</Text>
                    <Text style={[styles.statusButtonText, { color: '#10B981' }]}>
                      Good
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { 
                        backgroundColor: status === 'okay' ? '#F59E0B20' : colors.background,
                        borderColor: status === 'okay' ? '#F59E0B' : colors.border,
                      },
                    ]}
                    onPress={() => setZoneHealth(zone.id, 'okay')}
                  >
                    <Text style={styles.statusButtonEmoji}>💛</Text>
                    <Text style={[styles.statusButtonText, { color: '#F59E0B' }]}>
                      Okay
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { 
                        backgroundColor: status === 'needs_attention' ? '#EF444420' : colors.background,
                        borderColor: status === 'needs_attention' ? '#EF4444' : colors.border,
                      },
                    ]}
                    onPress={() => setZoneHealth(zone.id, 'needs_attention')}
                  >
                    <Text style={styles.statusButtonEmoji}>❤️‍🩹</Text>
                    <Text style={[styles.statusButtonText, { color: '#EF4444' }]}>
                      Needs Care
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Summary of flagged zones */}
      {Object.values(zoneStatus).filter(v => v === 'needs_attention').length > 0 && (
        <View style={[styles.flaggedCard, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
          <Text style={[styles.flaggedTitle, { color: '#EF4444' }]}>
            ⚠️ Zones Needing Attention
          </Text>
          <Text style={[styles.flaggedText, { color: colors.text }]}>
            {zones
              .filter(z => zoneStatus[z.id] === 'needs_attention')
              .map(z => `${z.icon} ${z.name}`)
              .join(', ')}
          </Text>
          <Text style={[styles.flaggedHint, { color: colors.textSecondary }]}>
            Consider adding wellness activities for these areas to your tactical plan.
          </Text>
        </View>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: '#39b54a' }]}
        onPress={handleNext}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
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
    marginBottom: 24,
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
  instructionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  zonesGrid: {
    gap: 12,
    marginBottom: 24,
  },
  zoneContainer: {
    marginBottom: 4,
  },
  zoneCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoneIcon: {
    fontSize: 28,
  },
  zoneName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  statusEmoji: {
    fontSize: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 42,
    gap: 8,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  statusButtonEmoji: {
    fontSize: 16,
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  flaggedCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  flaggedTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  flaggedText: {
    fontSize: 15,
    marginBottom: 8,
  },
  flaggedHint: {
    fontSize: 13,
    fontStyle: 'italic',
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

export default WingCheckWellnessStep;