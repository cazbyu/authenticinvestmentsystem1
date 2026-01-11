import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChevronRight, Calendar, CheckSquare, Flower2, AlertTriangle, Lightbulb, BookOpen } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface ParentItemInfoProps {
  parentId: string;
  parentType: 'task' | 'event' | 'reflection' | 'rose' | 'thorn' | 'depositIdea';
  onPress?: () => void;
}

interface ParentItem {
  id: string;
  title: string;
  type: string;
  date?: string;
}

export default function ParentItemInfo({ parentId, parentType, onPress }: ParentItemInfoProps) {
  const [parentItem, setParentItem] = useState<ParentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchParentItem();
  }, [parentId, parentType]);

  const fetchParentItem = async () => {
    if (!parentId || !parentType) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      let data = null;

      switch (parentType) {
        case 'task':
        case 'event':
          const { data: taskData, error: taskError } = await supabase
            .from('0008-ap-tasks')
            .select('id, title, type, due_date')
            .eq('id', parentId)
            .maybeSingle();

          if (taskError) throw taskError;
          if (taskData) {
            data = {
              id: taskData.id,
              title: taskData.title,
              type: taskData.type || 'task',
              date: taskData.due_date,
            };
          }
          break;

        case 'reflection':
        case 'rose':
        case 'thorn':
          const { data: reflectionData, error: reflectionError } = await supabase
            .from('0008-ap-reflections')
            .select('id, title, type, reflection_date')
            .eq('id', parentId)
            .maybeSingle();

          if (reflectionError) throw reflectionError;
          if (reflectionData) {
            data = {
              id: reflectionData.id,
              title: reflectionData.title || 'Untitled',
              type: reflectionData.type || 'reflection',
              date: reflectionData.reflection_date,
            };
          }
          break;

        case 'depositIdea':
          const { data: depositData, error: depositError } = await supabase
            .from('0008-ap-deposit-ideas')
            .select('id, title, created_at')
            .eq('id', parentId)
            .maybeSingle();

          if (depositError) throw depositError;
          if (depositData) {
            data = {
              id: depositData.id,
              title: depositData.title,
              type: 'depositIdea',
              date: depositData.created_at,
            };
          }
          break;
      }

      setParentItem(data);
    } catch (err) {
      console.error('Error fetching parent item:', err);
      setError('Failed to load parent item');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    const iconSize = 16;
    const iconColor = '#6b7280';

    switch (parentType) {
      case 'event':
        return <Calendar size={iconSize} color={iconColor} />;
      case 'task':
        return <CheckSquare size={iconSize} color={iconColor} />;
      case 'rose':
        return <Flower2 size={iconSize} color={iconColor} />;
      case 'thorn':
        return <AlertTriangle size={iconSize} color={iconColor} />;
      case 'depositIdea':
        return <Lightbulb size={iconSize} color={iconColor} />;
      case 'reflection':
        return <BookOpen size={iconSize} color={iconColor} />;
      default:
        return <CheckSquare size={iconSize} color={iconColor} />;
    }
  };

  const getTypeLabel = () => {
    switch (parentType) {
      case 'event':
        return 'Event';
      case 'task':
        return 'Task';
      case 'rose':
        return 'Rose';
      case 'thorn':
        return 'Thorn';
      case 'depositIdea':
        return 'Deposit Idea';
      case 'reflection':
        return 'Reflection';
      default:
        return 'Item';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6b7280" />
          <Text style={styles.loadingText}>Loading parent item...</Text>
        </View>
      </View>
    );
  }

  if (error || !parentItem) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Parent item not found'}</Text>
        </View>
      </View>
    );
  }

  const formattedDate = formatDate(parentItem.date);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Linked to:</Text>
      <TouchableOpacity
        style={styles.parentCard}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.typeRow}>
            <Text style={styles.typeLabel}>{getTypeLabel()}</Text>
            {formattedDate && <Text style={styles.dateText}>{formattedDate}</Text>}
          </View>
          <Text style={styles.titleText} numberOfLines={2}>
            {parentItem.title}
          </Text>
        </View>
        {onPress && (
          <View style={styles.chevronContainer}>
            <ChevronRight size={16} color="#9ca3af" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  parentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    lineHeight: 18,
  },
  chevronContainer: {
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
});
