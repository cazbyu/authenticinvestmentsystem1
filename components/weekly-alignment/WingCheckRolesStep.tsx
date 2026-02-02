import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Compass, ChevronRight, Check, HelpCircle, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
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
  priority_order?: number | null;
}

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasExistingPriorities, setHasExistingPriorities] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-roles')
        .select('id, label, category, icon, color, purpose, is_active, priority_order')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority_order', { ascending: true, nullsFirst: false })
        .order('label', { ascending: true });

      if (error) throw error;

      const rolesData = data || [];
      setRoles(rolesData);

      // Check if user already has priority roles set - load ALL of them (no limit)
      const existingPriorities = rolesData
        .filter(r => r.priority_order !== null && r.priority_order !== undefined)
        .sort((a, b) => (a.priority_order || 0) - (b.priority_order || 0))
        .map(r => r.id);

      if (existingPriorities.length > 0) {
        setSelectedRoleIds(existingPriorities);
        setHasExistingPriorities(true);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleRoleSelection(roleId: string) {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        // Remove from selection
        return prev.filter(id => id !== roleId);
      } else {
        // Add to selection (no limit - maintains order of selection)
        return [...prev, roleId];
      }
    });
  }

  async function handleContinue() {
    if (selectedRoleIds.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please select at least one priority role to continue.');
      } else {
        Alert.alert('Select Roles', 'Please select at least one priority role to continue.');
      }
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      // First, clear all existing priority_order values for this user's roles
      const { error: clearError } = await supabase
        .from('0008-ap-roles')
        .update({ priority_order: null })
        .eq('user_id', userId);

      if (clearError) throw clearError;

      // Then set priority_order for selected roles (1, 2, 3, 4, ...)
      for (let i = 0; i < selectedRoleIds.length; i++) {
        const { error: updateError } = await supabase
          .from('0008-ap-roles')
          .update({ priority_order: i + 1 })
          .eq('id', selectedRoleIds[i]);

        if (updateError) throw updateError;
      }

      // Capture data for the weekly alignment flow
      onDataCapture({
        rolesReviewed: selectedRoleIds,
        roleHealthFlags: {}, // Not using health flags in this simplified flow
      });

      onNext();
    } catch (error) {
      console.error('Error saving priority roles:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save your priority roles. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save your priority roles. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleManageRoles() {
    // Navigate to Role Bank's Manage Roles tab
    router.push('/(tabs)/roles');
  }

  function getCategoryColor(category: string): string {
    switch (category?.toLowerCase()) {
      case 'personal': return '#9370DB';
      case 'professional': return '#3B82F6';
      case 'community': return '#10B981';
      case 'family': return '#F59E0B';
      case 'home & stewardship': return '#8B5CF6';
      case 'recreation': return '#EC4899';
      case 'caregiving': return '#EF4444';
      default: return '#6B7280';
    }
  }

  function getSelectionNumber(roleId: string): number | null {
    const index = selectedRoleIds.indexOf(roleId);
    return index >= 0 ? index + 1 : null;
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

  // No roles state
  if (roles.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={[styles.iconContainer, { backgroundColor: ROLES_COLOR_LIGHT }]}>
              <Compass size={40} color={ROLES_COLOR} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.stepLabel, { color: ROLES_COLOR }]}>Step 2</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Wing Check: Roles</Text>
            </View>
          </View>
        </View>

        {/* Empty State */}
        <View style={[styles.emptyStateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.emptyStateIconContainer}>
            <Compass size={48} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No Roles Set Up Yet
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            Before we can identify your priority roles, you'll need to create some roles first. 
            Roles represent the different hats you wear in life—like Father, Professional, Friend, etc.
          </Text>
          <TouchableOpacity
            style={[styles.manageRolesButton, { backgroundColor: ROLES_COLOR }]}
            onPress={handleManageRoles}
            activeOpacity={0.8}
          >
            <Settings size={20} color="#FFFFFF" />
            <Text style={styles.manageRolesButtonText}>Set Up Roles</Text>
          </TouchableOpacity>
        </View>

        {/* Skip Option */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onNext}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
            <Compass size={40} color={ROLES_COLOR} />
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
              Select and prioritize the roles that matter most to you right now. The order you tap them sets their priority.
            </Text>
          </View>
        )}
      </View>

      {/* Progress Card */}
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {selectedRoleIds.length} of {roles.length} roles prioritized
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: ROLES_COLOR,
                width: `${Math.min((selectedRoleIds.length / roles.length) * 100, 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Question Card */}
      <View style={[styles.questionCard, { backgroundColor: ROLES_COLOR_LIGHT, borderColor: ROLES_COLOR_BORDER }]}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          Which roles matter most to you right now?
        </Text>
        <Text style={[styles.questionHint, { color: colors.textSecondary }]}>
          Tap roles to prioritize them. The order you select them sets their rank (R1, R2, R3...).
        </Text>
      </View>

      {/* Roles by Category */}
      {categories.map(category => (
        <View key={category} style={styles.categorySection}>
          <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>
            {category}
          </Text>

          <View style={styles.rolesGrid}>
            {rolesByCategory[category].map(role => {
              const isSelected = selectedRoleIds.includes(role.id);
              const selectionNumber = getSelectionNumber(role.id);
              const categoryColor = getCategoryColor(role.category);

              return (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: isSelected ? `${categoryColor}15` : colors.surface,
                      borderColor: isSelected ? categoryColor : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => toggleRoleSelection(role.id)}
                  activeOpacity={0.7}
                >
                  {/* Selection Badge */}
                  {isSelected && selectionNumber && (
                    <View style={[styles.selectionBadge, { backgroundColor: categoryColor }]}>
                      <Text style={styles.selectionBadgeText}>{selectionNumber}</Text>
                    </View>
                  )}

                  {/* Role Icon */}
                  <View style={[styles.roleIconContainer, { backgroundColor: `${categoryColor}20` }]}>
                    <RoleIcon
                      name={role.icon || role.label}
                      color={categoryColor}
                      size={28}
                    />
                  </View>

                  {/* Role Label */}
                  <Text
                    style={[
                      styles.roleLabel,
                      { color: isSelected ? categoryColor : colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {role.label}
                  </Text>

                  {/* Check indicator */}
                  {isSelected && (
                    <View style={[styles.checkContainer, { backgroundColor: categoryColor }]}>
                      <Check size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Selected Summary */}
      {selectedRoleIds.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: ROLES_COLOR_BORDER }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Your Priority Roles ({selectedRoleIds.length}):
          </Text>
          <View style={styles.summaryList}>
            {selectedRoleIds.map((roleId, index) => {
              const role = roles.find(r => r.id === roleId);
              if (!role) return null;
              return (
                <View key={roleId} style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: ROLES_COLOR }]}>R{index + 1}</Text>
                  <Text style={[styles.summaryRole, { color: colors.text }]}>{role.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          {
            backgroundColor: selectedRoleIds.length > 0 ? ROLES_COLOR : colors.border,
            opacity: saving ? 0.7 : 1,
          },
        ]}
        onPress={handleContinue}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.continueButtonText}>
              {hasExistingPriorities ? 'Update & Continue' : 'Continue'}
            </Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>

      {/* Manage Roles Link */}
      <TouchableOpacity
        style={styles.manageRolesLink}
        onPress={handleManageRoles}
        activeOpacity={0.7}
      >
        <Settings size={16} color={colors.textSecondary} />
        <Text style={[styles.manageRolesLinkText, { color: colors.textSecondary }]}>
          Manage Roles
        </Text>
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

  // Question
  questionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 8,
  },
  questionHint: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Categories
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Roles Grid
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roleCard: {
    width: '30%',
    minWidth: 100,
    maxWidth: 120,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  checkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Summary
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryList: {
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryNumber: {
    fontSize: 14,
    fontWeight: '700',
    width: 32,
  },
  summaryRole: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Continue Button
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

  // Manage Roles Link
  manageRolesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  manageRolesLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Empty State
  emptyStateCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateIconContainer: {
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  manageRolesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  manageRolesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default WingCheckRolesStep;