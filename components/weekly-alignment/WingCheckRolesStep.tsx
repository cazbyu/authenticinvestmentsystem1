import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Users, ChevronRight, AlertCircle, CheckCircle, MinusCircle, HelpCircle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { RoleIcon } from '@/components/icons/RoleIcon';

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

// Brand color for Roles (purple)
const ROLES_COLOR = '#9370DB';
const ROLES_COLOR_LIGHT = '#9370DB15';
const ROLES_COLOR_BORDER = '#9370DB40';

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
  const [showTooltip, setShowTooltip] = useState(false);

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
        <ActivityIndicator size="large" color={ROLES_COLOR} />
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
      {/* Header - Matching TouchYourStarStep style */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.iconContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
            <Users size={40} color={ROLES_COLOR} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Wing Check: Roles</Text>
          </View>
          {/* Tooltip Button */}
          <TouchableOpacity 
            style={styles.tooltipButton}
            onPress={() => setShowTooltip(!showTooltip)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HelpCircle size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tooltip Content */}
        {showTooltip && (
          <View style={[styles.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              Your life roles represent the different hats you wear—father, professional, friend, etc. 
              Checking in on each role helps you see where you're thriving and where you might need more attention.
            </Text>
          </View>
        )}
      </View>

      {/* Progress Card */}
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {reviewedCount} of {roles.length} roles checked
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: ROLES_COLOR,
                width: `${roles.length > 0 ? (reviewedCount / roles.length) * 100 : 0}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Instructions */}
      <View style={[styles.instructionCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
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
                    {/* Role Icon - Uses RoleIcon component with icon field or label as fallback */}
                    <View style={[styles.roleIconContainer, { backgroundColor: `${getCategoryColor(category)}15` }]}>
                      <RoleIcon 
                        name={role.icon || role.label} 
                        color={getCategoryColor(category)} 
                        size={24} 
                      />
                    </View>
                    
                    <View style={styles.roleInfo}>
                      <Text style={[styles.roleLabel, { color: colors.text }]}>
                        {role.label}
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
        style={[styles.continueButton, { backgroundColor: ROLES_COLOR }]}
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

  // Header - Matching TouchYourStarStep
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Tooltip
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

  // Instructions
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

  // Empty State
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

  // Categories
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

  // Role Cards
  roleContainer: {
    marginBottom: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  roleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  rolePurpose: {
    fontSize: 13,
    lineHeight: 18,
  },
  roleStatus: {
    marginLeft: 8,
  },

  // Health Buttons
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

  // Continue Button
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