import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Users, ChevronRight, AlertCircle, CheckCircle, MinusCircle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface WingCheckRolesStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onDataCapture: (data: {
    rolesReviewed: string[];
    roleHealthFlags: Record<string, 'thriving' | 'stable' | 'needs_attention'>;
  }) => void;
}

interface Role {
  id: string;
  label: string;
  category: string;
  icon?: string;
  color?: string;
  purpose?: string;
  is_active: boolean;
}

type HealthStatus = 'thriving' | 'stable' | 'needs_attention' | null;

export function WingCheckRolesStep({
  userId,
  colors,
  onNext,
  onBack,
  onDataCapture,
}: WingCheckRolesStepProps) {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [healthFlags, setHealthFlags] = useState<Record<string, HealthStatus>>({});
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-roles')
        .select('id, label, category, icon, color, purpose, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setRoles(data || []);
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  }

  function setRoleHealth(roleId: string, status: HealthStatus) {
    setHealthFlags(prev => ({
      ...prev,
      [roleId]: status,
    }));
  }

  function handleNext() {
    // Capture which roles were reviewed and their health status
    const reviewedRoles = Object.keys(healthFlags).filter(id => healthFlags[id] !== null);
    const validHealthFlags: Record<string, 'thriving' | 'stable' | 'needs_attention'> = {};
    
    reviewedRoles.forEach(id => {
      const status = healthFlags[id];
      if (status) {
        validHealthFlags[id] = status;
      }
    });

    onDataCapture({
      rolesReviewed: reviewedRoles,
      roleHealthFlags: validHealthFlags,
    });
    
    onNext();
  }

  function getCategoryColor(category: string): string {
    switch (category?.toLowerCase()) {
      case 'personal': return '#9370DB';
      case 'professional': return '#3B82F6';
      case 'community': return '#10B981';
      case 'family': return '#F59E0B';
      default: return '#6B7280';
    }
  }

  function getCategoryEmoji(category: string): string {
    switch (category?.toLowerCase()) {
      case 'personal': return '🧘';
      case 'professional': return '💼';
      case 'community': return '🤝';
      case 'family': return '👨‍👩‍👧‍👦';
      default: return '👤';
    }
  }

  function getHealthIcon(status: HealthStatus) {
    switch (status) {
      case 'thriving':
        return <CheckCircle size={20} color="#10B981" />;
      case 'stable':
        return <MinusCircle size={20} color="#F59E0B" />;
      case 'needs_attention':
        return <AlertCircle size={20} color="#EF4444" />;
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your roles...
        </Text>
      </View>
    );
  }

  // Group roles by category
  const rolesByCategory = roles.reduce<Record<string, Role[]>>((acc, role) => {
    const category = role.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(role);
    return acc;
  }, {});

  const categories = Object.keys(rolesByCategory);
  const reviewedCount = Object.values(healthFlags).filter(v => v !== null).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={[styles.iconCircle, { backgroundColor: '#9370DB20' }]}>
          <Users size={40} color="#9370DB" />
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Wing Check: Roles
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          How are your life roles doing?
        </Text>
      </View>

      {/* Progress Indicator */}
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {reviewedCount} of {roles.length} roles checked
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: '#9370DB',
                width: `${roles.length > 0 ? (reviewedCount / roles.length) * 100 : 0}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Instructions */}
      <View style={[styles.instructionCard, { backgroundColor: '#9370DB10', borderColor: '#9370DB40' }]}>
        <Text style={[styles.instructionText, { color: colors.text }]}>
          💡 Tap each role and rate how it's going this week. Be honest with yourself.
        </Text>
      </View>

      {/* Roles by Category */}
      {roles.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Users size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No Roles Defined
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            You haven't set up any life roles yet. You can define them in the Roles section.
          </Text>
        </View>
      ) : (
        categories.map(category => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryEmoji}>{getCategoryEmoji(category)}</Text>
              <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>
                {category}
              </Text>
            </View>

            {rolesByCategory[category].map(role => {
              const health = healthFlags[role.id];
              const isExpanded = expandedRole === role.id;

              return (
                <View key={role.id} style={styles.roleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.roleCard,
                      { 
                        backgroundColor: colors.surface, 
                        borderColor: health ? getCategoryColor(category) : colors.border,
                        borderWidth: health ? 2 : 1,
                      },
                    ]}
                    onPress={() => setExpandedRole(isExpanded ? null : role.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roleInfo}>
                      <Text style={[styles.roleLabel, { color: colors.text }]}>
                        {role.icon ? `${role.icon} ` : ''}{role.label}
                      </Text>
                      {role.purpose && (
                        <Text 
                          style={[styles.rolePurpose, { color: colors.textSecondary }]}
                          numberOfLines={isExpanded ? undefined : 1}
                        >
                          {role.purpose}
                        </Text>
                      )}
                    </View>
                    <View style={styles.roleStatus}>
                      {getHealthIcon(health)}
                    </View>
                  </TouchableOpacity>

                  {/* Health Selection Buttons */}
                  {isExpanded && (
                    <View style={styles.healthButtons}>
                      <TouchableOpacity
                        style={[
                          styles.healthButton,
                          { backgroundColor: health === 'thriving' ? '#10B98120' : colors.background },
                          { borderColor: health === 'thriving' ? '#10B981' : colors.border },
                        ]}
                        onPress={() => setRoleHealth(role.id, 'thriving')}
                      >
                        <CheckCircle size={18} color="#10B981" />
                        <Text style={[styles.healthButtonText, { color: '#10B981' }]}>
                          Thriving
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.healthButton,
                          { backgroundColor: health === 'stable' ? '#F59E0B20' : colors.background },
                          { borderColor: health === 'stable' ? '#F59E0B' : colors.border },
                        ]}
                        onPress={() => setRoleHealth(role.id, 'stable')}
                      >
                        <MinusCircle size={18} color="#F59E0B" />
                        <Text style={[styles.healthButtonText, { color: '#F59E0B' }]}>
                          Stable
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.healthButton,
                          { backgroundColor: health === 'needs_attention' ? '#EF444420' : colors.background },
                          { borderColor: health === 'needs_attention' ? '#EF4444' : colors.border },
                        ]}
                        onPress={() => setRoleHealth(role.id, 'needs_attention')}
                      >
                        <AlertCircle size={18} color="#EF4444" />
                        <Text style={[styles.healthButtonText, { color: '#EF4444' }]}>
                          Needs Work
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: '#9370DB' }]}
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
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleContainer: {
    marginBottom: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleInfo: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rolePurpose: {
    fontSize: 13,
    lineHeight: 18,
  },
  roleStatus: {
    marginLeft: 12,
  },
  healthButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  healthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  healthButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default WingCheckRolesStep;