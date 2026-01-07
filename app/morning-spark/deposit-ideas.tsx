import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSquare, Square, User, Heart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  checkTodaysSpark,
  getDepositIdeasByRole,
  getDepositIdeasByZone,
  activateDepositIdeas,
  formatDaysAgo,
  getDepositIdeasMessage,
  DepositIdea,
} from '@/lib/sparkUtils';

interface ToastMessage {
  message: string;
  visible: boolean;
}

type ViewMode = 'role' | 'zone';

export default function DepositIdeasScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [depositIdeas, setDepositIdeas] = useState<DepositIdea[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('role');
  const [topRoleIds, setTopRoleIds] = useState<string[]>([]);

  const [toast, setToast] = useState<ToastMessage>({ message: '', visible: false });
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (userId && !loading) {
      loadIdeas();
    }
  }, [viewMode]);

  useEffect(() => {
    if (toast.visible) {
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2700),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToast({ message: '', visible: false });
      });
    }
  }, [toast.visible]);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      const spark = await checkTodaysSpark(user.id);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      if (spark.fuel_level === 1) {
        router.replace('/morning-spark/commit');
        return;
      }

      setFuelLevel(spark.fuel_level);

      const { data: prefs } = await supabase
        .from('0008-ap-user-preferences')
        .select('top_three_roles')
        .eq('user_id', user.id)
        .maybeSingle();

      const roleIds = prefs?.top_three_roles || [];
      setTopRoleIds(roleIds);

      await loadIdeas(user.id, roleIds);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load deposit ideas. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadIdeas(uid?: string, roles?: string[]) {
    try {
      const targetUserId = uid || userId;
      const targetRoles = roles || topRoleIds;

      let ideas: DepositIdea[];
      if (viewMode === 'role') {
        ideas = await getDepositIdeasByRole(targetUserId, targetRoles, 5);
      } else {
        ideas = await getDepositIdeasByZone(targetUserId, 5);
      }

      setDepositIdeas(ideas);
    } catch (error) {
      console.error('Error loading ideas:', error);
    }
  }

  function showToast(message: string) {
    setToast({ message, visible: true });
  }

  function toggleSelection(ideaId: string) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ideaId)) {
        newSet.delete(ideaId);
      } else {
        newSet.add(ideaId);
      }
      return newSet;
    });
  }

  function selectAll() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedIds(new Set(depositIdeas.map(idea => idea.id)));
  }

  function clearSelection() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedIds(new Set());
  }

  async function handleActivate() {
    if (selectedIds.size === 0) return;

    if (fuelLevel === 1 && selectedIds.size >= 5) {
      Alert.alert(
        'That\'s Quite a Lot',
        'Are you sure you want to take on this much today?',
        [
          {
            text: 'Let Me Reconsider',
            style: 'cancel',
          },
          {
            text: 'Yes, I\'m Sure',
            onPress: () => proceedWithActivation(),
          },
        ]
      );
    } else {
      proceedWithActivation();
    }
  }

  async function proceedWithActivation() {
    try {
      setActivating(true);

      const selectedIdeas = depositIdeas.filter(idea => selectedIds.has(idea.id));
      await activateDepositIdeas(userId, selectedIdeas);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      showToast(`✓ Activated ${selectedIds.size} idea${selectedIds.size > 1 ? 's' : ''}!`);

      setTimeout(() => {
        router.push('/morning-spark/commit');
      }, 800);
    } catch (error) {
      console.error('Error activating deposit ideas:', error);
      Alert.alert('Error', 'Couldn\'t activate ideas. Please try again.');
      setActivating(false);
    }
  }

  function handleSkip() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/morning-spark/commit');
  }

  function toggleViewMode(mode: ViewMode) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setViewMode(mode);
  }

  function renderDepositIdeaCard(idea: DepositIdea) {
    const isSelected = selectedIds.has(idea.id);

    return (
      <TouchableOpacity
        key={idea.id}
        style={[
          styles.ideaCard,
          {
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          },
          isSelected && styles.ideaCardSelected,
        ]}
        onPress={() => toggleSelection(idea.id)}
        activeOpacity={0.7}
        disabled={activating}
      >
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <CheckSquare size={24} color={colors.primary} />
          ) : (
            <Square size={24} color={colors.textSecondary} />
          )}
        </View>

        <View style={styles.ideaContent}>
          <Text style={[styles.ideaTitle, { color: colors.text }]} numberOfLines={2}>
            {idea.title}
          </Text>
          <Text style={[styles.ideaDate, { color: colors.textSecondary }]}>
            Saved {formatDaysAgo(idea.created_at)}
          </Text>
        </View>

        <View style={[styles.pointsBadge, { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' }]}>
          <Text style={[styles.pointsText, { color: '#10B981' }]}>+5</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasIdeas = depositIdeas.length > 0;
  const selectedCount = selectedIds.size;
  const canActivate = selectedCount > 0 && !activating;
  const pointsPreview = selectedCount * 5;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Deposit Ideas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Activate Deposit Ideas</Text>
          {fuelLevel && (
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              {getDepositIdeasMessage(fuelLevel)}
            </Text>
          )}
        </View>

        {hasIdeas && (
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'role' && { backgroundColor: colors.primary },
                viewMode !== 'role' && { borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => toggleViewMode('role')}
              activeOpacity={0.7}
            >
              <User size={16} color={viewMode === 'role' ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.toggleText,
                  { color: viewMode === 'role' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                View by Role
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'zone' && { backgroundColor: colors.primary },
                viewMode !== 'zone' && { borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => toggleViewMode('zone')}
              activeOpacity={0.7}
            >
              <Heart size={16} color={viewMode === 'zone' ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.toggleText,
                  { color: viewMode === 'zone' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                View by Zone
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!hasIdeas ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💡</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No deposit ideas yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You can create some in the Idea Bank.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.selectionControls}>
              <Text style={[styles.selectionCount, { color: colors.text }]}>
                {selectedCount === 0
                  ? 'No ideas selected'
                  : `${selectedCount} idea${selectedCount > 1 ? 's' : ''} selected`}
              </Text>

              {depositIdeas.length > 1 && (
                <View style={styles.quickActions}>
                  {selectedCount === depositIdeas.length ? (
                    <TouchableOpacity onPress={clearSelection} style={styles.quickActionButton}>
                      <Text style={[styles.quickActionText, { color: colors.primary }]}>
                        Clear All
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={selectAll} style={styles.quickActionButton}>
                      <Text style={[styles.quickActionText, { color: colors.primary }]}>
                        Select All
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.cardsContainer}>
              {depositIdeas.map((idea) => renderDepositIdeaCard(idea))}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {hasIdeas && selectedCount > 0 && (
          <View style={[styles.pointsPreview, { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' }]}>
            <Text style={[styles.pointsPreviewText, { color: '#10B981' }]}>
              This will add +{pointsPreview} to your target
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: canActivate ? colors.primary : colors.border,
            },
          ]}
          onPress={handleActivate}
          disabled={!canActivate}
          activeOpacity={0.8}
        >
          {activating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryButtonText, { opacity: canActivate ? 1 : 0.5 }]}>
              {selectedCount > 0 ? `Activate ${selectedCount} Idea${selectedCount > 1 ? 's' : ''}` : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleSkip}
          activeOpacity={0.8}
          disabled={activating}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {toast.visible && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
              opacity: toastOpacity,
            },
          ]}
        >
          <Text style={[styles.toastText, { color: colors.text }]}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
  },
  titleSection: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  selectionCount: {
    fontSize: 15,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardsContainer: {
    gap: 12,
  },
  ideaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: 44,
  },
  ideaCardSelected: {
    borderWidth: 2,
  },
  checkboxContainer: {
    marginRight: 12,
    width: 24,
    height: 24,
  },
  ideaContent: {
    flex: 1,
  },
  ideaTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  ideaDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  pointsPreview: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  pointsPreviewText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
