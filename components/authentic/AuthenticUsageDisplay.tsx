import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import {
  fetchAuthenticUsage,
  fetchScopedAuthenticUsage,
  formatScopedAuthenticUsageText,
  formatAuthenticUsageText,
  invalidateCache,
  ScopedAuthenticUsage,
  AuthenticUsageData
} from '@/lib/authenticDepositUtils';
import { eventBus } from '@/lib/eventBus';

interface AuthenticUsageDisplayProps {
  userId: string;
  scope?: {
    type: 'role' | 'domain' | 'key_relationship';
    id: string;
    name: string;
  };
}

export function AuthenticUsageDisplay({ userId, scope }: AuthenticUsageDisplayProps) {
  const { colors } = useTheme();
  const [usage, setUsage] = useState<ScopedAuthenticUsage | AuthenticUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsage = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const supabase = getSupabaseClient();

      if (scope) {
        const scopedUsage = await fetchScopedAuthenticUsage(supabase, userId, scope);
        setUsage(scopedUsage);
      } else {
        const basicUsage = await fetchAuthenticUsage(supabase, userId);
        setUsage(basicUsage);
      }
    } catch (error) {
      console.error('Error loading authentic usage:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsage();
  }, [userId, scope?.id]);

  useEffect(() => {
    const handleTaskEvent = () => {
      invalidateCache('authentic');
      loadUsage(true);
    };

    eventBus.on('TASK_CREATED', handleTaskEvent);
    eventBus.on('TASK_UPDATED', handleTaskEvent);
    eventBus.on('TASK_COMPLETED', handleTaskEvent);
    eventBus.on('TASK_DELETED', handleTaskEvent);

    return () => {
      eventBus.off('TASK_CREATED', handleTaskEvent);
      eventBus.off('TASK_UPDATED', handleTaskEvent);
      eventBus.off('TASK_COMPLETED', handleTaskEvent);
      eventBus.off('TASK_DELETED', handleTaskEvent);
    };
  }, []);

  const handleRefresh = () => {
    invalidateCache('authentic');
    loadUsage(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!usage) {
    return null;
  }

  const isScopedUsage = 'scopeCount' in usage;
  const displayText = isScopedUsage
    ? formatScopedAuthenticUsageText(usage as ScopedAuthenticUsage)
    : formatAuthenticUsageText(usage);

  const warningLevel = usage.remaining <= 2 ? 'critical' : usage.remaining <= 5 ? 'warning' : 'normal';
  const borderColor = warningLevel === 'critical' ? '#dc2626' : warningLevel === 'warning' ? '#eab308' : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor }]}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            Authentic Deposits
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {displayText}
          </Text>
          {isScopedUsage && (
            <Text style={[styles.scopeInfo, { color: colors.textSecondary }]}>
              {(usage as ScopedAuthenticUsage).scopeCount} for {(usage as ScopedAuthenticUsage).scopeName} this week
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={refreshing}
          style={styles.refreshButton}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={20} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>
      {usage.remaining === 0 && (
        <View style={[styles.limitBanner, { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.limitText, { color: '#991b1b' }]}>
            Weekly limit reached
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  scopeInfo: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  refreshButton: {
    padding: 8,
    marginLeft: 12,
  },
  limitBanner: {
    marginTop: 12,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  limitText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
