import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useNorthStarVisit } from '@/hooks/useNorthStarVisit';
import { useRouter } from 'expo-router';

interface MissionCardOverlayProps {
  visible: boolean;
  onClose: () => void;
}

interface NorthStarData {
  mission_statement: string | null;
  '5yr_vision': string | null;
  life_motto: string | null;
  core_values: string[];
}

export function MissionCardOverlay({ visible, onClose }: MissionCardOverlayProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { recordVisit } = useNorthStarVisit();
  
  const [data, setData] = useState<NorthStarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      fetchNorthStarData();
      recordVisit('mission_card');
    }
  }, [visible]);

  const fetchNorthStarData = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: northStar, error } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, life_motto, core_values')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching NorthStar data:', error);
        return;
      }

      setData(northStar);
    } catch (err) {
      console.error('Error in fetchNorthStarData:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToFullPage = () => {
    onClose();
    router.push('/north-star');
  };

  const isEmpty = !data?.mission_statement && !data?.['5yr_vision'] && !data?.life_motto;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="star" size={24} color="#C9A227" />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Your North Star
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#C9A227" />
            </View>
          ) : isEmpty ? (
            <View style={styles.emptyState}>
              <Ionicons name="compass-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Define Your North Star
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your mission, vision, and values guide every action. Take a moment to define them.
              </Text>
              <TouchableOpacity 
                style={[styles.setupButton, { backgroundColor: '#C9A227' }]}
                onPress={handleGoToFullPage}
              >
                <Text style={styles.setupButtonText}>Set Up Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Life Motto */}
              {data?.life_motto && (
                <View style={styles.section}>
                  <Text style={[styles.mottoText, { color: colors.text }]}>
                    "{data.life_motto}"
                  </Text>
                </View>
              )}

              {/* Mission Statement */}
              {data?.mission_statement && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: '#B91C1C' }]}>
                    MISSION
                  </Text>
                  <Text style={[styles.sectionText, { color: colors.text }]}>
                    {data.mission_statement}
                  </Text>
                </View>
              )}

              {/* 5-Year Vision */}
              {data?.['5yr_vision'] && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: '#B91C1C' }]}>
                    5-YEAR VISION
                  </Text>
                  <Text style={[styles.sectionText, { color: colors.text }]}>
                    {data['5yr_vision']}
                  </Text>
                </View>
              )}

              {/* Core Values */}
              {data?.core_values && data.core_values.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: '#B91C1C' }]}>
                    CORE VALUES
                  </Text>
                  <View style={styles.valuesContainer}>
                    {data.core_values.slice(0, 5).map((value, index) => (
                      <View 
                        key={index} 
                        style={[styles.valueChip, { backgroundColor: colors.background }]}
                      >
                        <Text style={[styles.valueText, { color: colors.text }]}>
                          {value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer */}
          {!isEmpty && (
            <TouchableOpacity 
              style={styles.footer} 
              onPress={handleGoToFullPage}
            >
              <Text style={[styles.footerText, { color: '#B91C1C' }]}>
                View Full North Star
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#B91C1C" />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  card: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  mottoText: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  valuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  setupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
});