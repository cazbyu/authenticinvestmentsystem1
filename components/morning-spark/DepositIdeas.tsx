import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { User, Heart, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { DepositIdeaCard } from './DepositIdeaCard';
import {
  DepositIdea,
  getDepositIdeasMessage,
} from '@/lib/sparkUtils';
import { toLocalISOString } from '@/lib/dateUtils';

interface DepositIdeasProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onDepositIdeaActivated?: (task: any) => void;
}

type ViewMode = 'role' | 'zone';

interface DepositIdeaWithMetadata extends DepositIdea {
  roleNames?: string[];
  domainNames?: string[];
  roleScore?: number;
}

export function DepositIdeas({
  fuelLevel,
  userId,
  onDepositIdeaActivated,
}: DepositIdeasProps) {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [depositIdeas, setDepositIdeas] = useState<DepositIdeaWithMetadata[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('role');
  const [topRoleIds, setTopRoleIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(fuelLevel === 1);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    if (userId && !loading) {
      loadIdeas();
    }
  }, [viewMode]);

  async function loadData() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const { data: prefs } = await supabase
        .from('0008-ap-user-preferences')
        .select('top_three_roles')
        .eq('user_id', userId)
        .maybeSingle();

      const roleIds = prefs?.top_three_roles || [];
      setTopRoleIds(roleIds);

      await loadIdeas(roleIds);
    } catch (error) {
      console.error('Error loading deposit ideas:', error);
      Alert.alert('Error', 'Failed to load deposit ideas. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadIdeas(roles?: string[]) {
    try {
      const supabase = getSupabaseClient();
      const targetRoles = roles || topRoleIds;

      const { data: ideas, error } = await supabase
        .from('0008-ap-deposit-ideas')
        .select('*')
        .eq('user_id', userId)
        .is('activated_at', null)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!ideas || ideas.length === 0) {
        setDepositIdeas([]);
        return;
      }

      const ideaIds = ideas.map((i) => i.id);

      const [rolesData, domainsData] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', ideaIds)
          .eq('parent_type', 'depositIdea'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', ideaIds)
          .eq('parent_type', 'depositIdea'),
      ]);

      const rolesMap = new Map<string, { id: string; name: string; isTop: boolean }[]>();
      (rolesData.data || []).forEach((r: any) => {
        if (!r.role) return;
        if (!rolesMap.has(r.parent_id)) {
          rolesMap.set(r.parent_id, []);
        }
        rolesMap.get(r.parent_id)!.push({
          id: r.role.id,
          name: r.role.label,
          isTop: targetRoles.includes(r.role.id),
        });
      });

      const domainsMap = new Map<string, string[]>();
      (domainsData.data || []).forEach((d: any) => {
        if (!d.domain) return;
        if (!domainsMap.has(d.parent_id)) {
          domainsMap.set(d.parent_id, []);
        }
        domainsMap.get(d.parent_id)!.push(d.domain.name);
      });

      const ideasWithMetadata: DepositIdeaWithMetadata[] = ideas.map((idea) => {
        const roles = rolesMap.get(idea.id) || [];
        const roleNames = roles.map((r) => r.name);
        const roleScore = roles.filter((r) => r.isTop).length;
        const domainNames = domainsMap.get(idea.id) || [];

        return {
          ...idea,
          roleNames,
          domainNames,
          roleScore,
        };
      });

      let sortedIdeas = ideasWithMetadata;

      if (viewMode === 'role') {
        sortedIdeas.sort((a, b) => {
          const scoreA = a.roleScore || 0;
          const scoreB = b.roleScore || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      } else {
        sortedIdeas.sort((a, b) => {
          const domainsA = a.domainNames?.length || 0;
          const domainsB = b.domainNames?.length || 0;
          if (domainsB !== domainsA) return domainsB - domainsA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      const limitedIdeas = fuelLevel === 3
        ? sortedIdeas.slice(0, 5)
        : sortedIdeas.slice(0, 5);

      setDepositIdeas(limitedIdeas);
    } catch (error) {
      console.error('Error loading deposit ideas:', error);
      throw error;
    }
  }

  async function handleActivate(idea: DepositIdea) {
    if (activating) return;

    try {
      setActivating(idea.id);

      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      const { data: taskData, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          type: 'task',
          title: idea.title,
          due_date: today,
          status: 'pending',
          is_important: true,
          is_urgent: false,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      const { error: updateError } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({
          activated_at: toLocalISOString(new Date()),
          activated_task_id: taskData.id,
        })
        .eq('id', idea.id);

      if (updateError) throw updateError;

      setDepositIdeas((prev) => prev.filter((di) => di.id !== idea.id));

      if (onDepositIdeaActivated) {
        onDepositIdeaActivated(taskData);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', `"${idea.title}" activated for today!`);
    } catch (error) {
      console.error('Error activating deposit idea:', error);
      Alert.alert('Error', 'Failed to activate deposit idea. Please try again.');
    } finally {
      setActivating(null);
    }
  }

  function toggleViewMode(mode: ViewMode) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setViewMode(mode);
  }

  function toggleCollapsed() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCollapsed(!collapsed);
  }

  function getHeaderText(): string {
    if (fuelLevel === 1) {
      return 'Only add what feels energizing, not draining.';
    }
    return getDepositIdeasMessage(fuelLevel);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (depositIdeas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyIcon, { fontSize: 48 }]}>💡</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No deposit ideas yet. Create some in the Idea Bank.
        </Text>
      </View>
    );
  }

  if (fuelLevel === 1 && collapsed) {
    return (
      <View style={styles.collapsedContainer}>
        <TouchableOpacity
          style={styles.collapsedHeader}
          onPress={toggleCollapsed}
          activeOpacity={0.7}
        >
          <View style={styles.collapsedInfo}>
            <Text style={[styles.collapsedTitle, { color: colors.textSecondary }]}>
              Deposit Ideas Available
            </Text>
            <Text style={[styles.collapsedCount, { color: colors.textSecondary }]}>
              {depositIdeas.length} idea{depositIdeas.length !== 1 ? 's' : ''} ready to activate
            </Text>
          </View>
          <ChevronDown size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          {getHeaderText()}
        </Text>

        {fuelLevel === 1 && (
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={toggleCollapsed}
          >
            <ChevronUp size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'role' && { backgroundColor: colors.primary },
            viewMode !== 'role' && {
              borderColor: colors.border,
              borderWidth: 1,
              backgroundColor: colors.surface,
            },
          ]}
          onPress={() => toggleViewMode('role')}
          activeOpacity={0.7}
        >
          <User
            size={16}
            color={viewMode === 'role' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              { color: viewMode === 'role' ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            By Role
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'zone' && { backgroundColor: colors.primary },
            viewMode !== 'zone' && {
              borderColor: colors.border,
              borderWidth: 1,
              backgroundColor: colors.surface,
            },
          ]}
          onPress={() => toggleViewMode('zone')}
          activeOpacity={0.7}
        >
          <Heart
            size={16}
            color={viewMode === 'zone' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              { color: viewMode === 'zone' ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            By Zone
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ideaList}>
        {depositIdeas.map((idea) => (
          <DepositIdeaCard
            key={idea.id}
            idea={idea}
            viewMode={viewMode}
            onActivate={handleActivate}
            disabled={activating !== null}
          />
        ))}
      </View>

      {depositIdeas.length > 0 && (
        <View
          style={[
            styles.pointsInfo,
            { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' },
          ]}
        >
          <Text style={[styles.pointsInfoText, { color: '#10B981' }]}>
            Each activated idea adds +5 points to your target
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  collapsedContainer: {
    padding: 20,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
  },
  collapsedInfo: {
    flex: 1,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  collapsedCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  collapseButton: {
    padding: 4,
    marginLeft: 12,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ideaList: {
    marginBottom: 16,
  },
  pointsInfo: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pointsInfoText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
