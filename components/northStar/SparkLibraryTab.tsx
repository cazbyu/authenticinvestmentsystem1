import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { 
  Quote, 
  HelpCircle,
  Plus,
  Filter,
  User,
  Users,
  Settings,
  Star,
  Trash2,
  Edit3,
  Compass,
  Target,
  Heart,
  Briefcase,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

// Types
type ContentType = 'all' | 'quotes' | 'questions';
type SourceFilter = 'all' | 'self' | 'coach' | 'system';
type DomainFilter = 'all' | 'mission' | 'wellness' | 'goals' | 'roles';

interface PowerQuote {
  id: string;
  quote_text: string;
  attribution: string | null;
  source_type: 'self' | 'coach' | 'system';
  domain: string | null;
  is_pinned: boolean;
  times_shown: number;
  created_at: string;
  type: 'quote';
}

interface PowerQuestion {
  id: string;
  question_text: string;
  question_context: string | null;
  source_type: 'self' | 'coach' | 'system';
  domain: string | null;
  is_pinned: boolean;
  times_shown: number;
  created_at: string;
  type: 'question';
}

type SparkItem = PowerQuote | PowerQuestion;

interface SparkLibraryTabProps {
  onRefresh?: () => void;
}

export function SparkLibraryTab({ onRefresh }: SparkLibraryTabProps) {
  const router = useRouter();
  const { colors } = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<PowerQuote[]>([]);
  const [questions, setQuestions] = useState<PowerQuestion[]>([]);
  const [contentType, setContentType] = useState<ContentType>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch data
  const fetchSparkContent = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('0008-ap-user-power-quotes')
        .select('id, quote_text, attribution, source_type, domain, is_pinned, times_shown, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (quotesError) {
        console.error('Error fetching quotes:', quotesError);
      } else {
        setQuotes((quotesData || []).map(q => ({ ...q, type: 'quote' as const })));
      }

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('0008-ap-user-power-questions')
        .select('id, question_text, question_context, source_type, domain, is_pinned, times_shown, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
      } else {
        setQuestions((questionsData || []).map(q => ({ ...q, type: 'question' as const })));
      }

    } catch (err) {
      console.error('Error in fetchSparkContent:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSparkContent();
  }, [fetchSparkContent]);

  // Filter and combine items
  const filteredItems = useMemo(() => {
    let items: SparkItem[] = [];

    // Add by content type
    if (contentType === 'all' || contentType === 'quotes') {
      items = [...items, ...quotes];
    }
    if (contentType === 'all' || contentType === 'questions') {
      items = [...items, ...questions];
    }

    // Filter by source
    if (sourceFilter !== 'all') {
      items = items.filter(item => item.source_type === sourceFilter);
    }

    // Filter by domain
    if (domainFilter !== 'all') {
      items = items.filter(item => item.domain === domainFilter);
    }

    // Sort: pinned first, then by created_at
    items.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return items;
  }, [quotes, questions, contentType, sourceFilter, domainFilter]);

  // Handlers
  const handleAddQuote = useCallback(() => {
    router.push('/sparks/add?type=quote');
  }, [router]);

  const handleAddQuestion = useCallback(() => {
    router.push('/sparks/add?type=question');
  }, [router]);

  const handleEditItem = useCallback((item: SparkItem) => {
    const type = item.type === 'quote' ? 'quote' : 'question';
    router.push(`/sparks/edit?type=${type}&id=${item.id}`);
  }, [router]);

  const handleTogglePin = useCallback(async (item: SparkItem) => {
    try {
      const supabase = getSupabaseClient();
      const table = item.type === 'quote' 
        ? '0008-ap-user-power-quotes' 
        : '0008-ap-user-power-questions';

      const { error } = await supabase
        .from(table)
        .update({ is_pinned: !item.is_pinned })
        .eq('id', item.id);

      if (error) throw error;

      // Refresh data
      fetchSparkContent();
    } catch (err) {
      console.error('Error toggling pin:', err);
      Alert.alert('Error', 'Failed to update item');
    }
  }, [fetchSparkContent]);

  const handleDeleteItem = useCallback((item: SparkItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete this ${item.type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const table = item.type === 'quote' 
                ? '0008-ap-user-power-quotes' 
                : '0008-ap-user-power-questions';

              const { error } = await supabase
                .from(table)
                .update({ is_active: false })
                .eq('id', item.id);

              if (error) throw error;

              fetchSparkContent();
            } catch (err) {
              console.error('Error deleting item:', err);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  }, [fetchSparkContent]);

  // Get domain icon
  const getDomainIcon = (domain: string | null) => {
    switch (domain) {
      case 'mission':
        return <Compass size={12} color="#0078d4" />;
      case 'wellness':
        return <Heart size={12} color="#16a34a" />;
      case 'goals':
        return <Target size={12} color="#8b5cf6" />;
      case 'roles':
        return <Briefcase size={12} color="#f59e0b" />;
      default:
        return null;
    }
  };

  // Get source icon
  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'self':
        return <User size={12} color={colors.textSecondary} />;
      case 'coach':
        return <Users size={12} color={colors.textSecondary} />;
      case 'system':
        return <Settings size={12} color={colors.textSecondary} />;
      default:
        return null;
    }
  };

  // Render item
  const renderItem = useCallback(({ item }: { item: SparkItem }) => {
    const isQuote = item.type === 'quote';
    const text = isQuote 
      ? (item as PowerQuote).quote_text 
      : (item as PowerQuestion).question_text;
    const subtitle = isQuote 
      ? (item as PowerQuote).attribution 
      : (item as PowerQuestion).question_context;

    return (
      <View style={[styles.itemCard, { backgroundColor: colors.card }]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemBadges}>
            {/* Type Badge */}
            <View 
              style={[
                styles.typeBadge, 
                { backgroundColor: isQuote ? '#dbeafe' : '#f3e8ff' }
              ]}
            >
              {isQuote ? (
                <Quote size={12} color="#1e40af" />
              ) : (
                <HelpCircle size={12} color="#7c3aed" />
              )}
              <Text 
                style={[
                  styles.typeBadgeText, 
                  { color: isQuote ? '#1e40af' : '#7c3aed' }
                ]}
              >
                {isQuote ? 'Quote' : 'Question'}
              </Text>
            </View>

            {/* Domain Badge */}
            {item.domain && (
              <View style={[styles.domainBadge, { backgroundColor: colors.background }]}>
                {getDomainIcon(item.domain)}
                <Text style={[styles.domainBadgeText, { color: colors.textSecondary }]}>
                  {item.domain}
                </Text>
              </View>
            )}

            {/* Pinned Badge */}
            {item.is_pinned && (
              <View style={[styles.pinnedBadge, { backgroundColor: '#fef3c7' }]}>
                <Star size={10} color="#92400e" fill="#92400e" />
              </View>
            )}
          </View>

          {/* Source & Actions */}
          <View style={styles.itemActions}>
            {getSourceIcon(item.source_type)}
            <TouchableOpacity
              onPress={() => handleTogglePin(item)}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Star 
                size={16} 
                color={item.is_pinned ? '#f59e0b' : colors.textSecondary}
                fill={item.is_pinned ? '#f59e0b' : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleEditItem(item)}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Edit3 size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteItem(item)}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.itemText, { color: colors.text }]}>
          {isQuote ? `"${text}"` : text}
        </Text>

        {subtitle && (
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            {isQuote ? `— ${subtitle}` : subtitle}
          </Text>
        )}

        <View style={styles.itemFooter}>
          <Text style={[styles.timesShown, { color: colors.textSecondary }]}>
            Shown {item.times_shown} times
          </Text>
        </View>
      </View>
    );
  }, [colors, handleTogglePin, handleEditItem, handleDeleteItem]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B91C1C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.addQuoteButton}
          onPress={handleAddQuote}
        >
          <Quote size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addQuestionButton}
          onPress={handleAddQuestion}
        >
          <HelpCircle size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Question</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton, 
            { 
              backgroundColor: showFilters ? '#B91C1C' : colors.card,
              borderColor: colors.border,
            }
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? '#ffffff' : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={[styles.filtersContainer, { backgroundColor: colors.card }]}>
          {/* Content Type Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Type:</Text>
            <View style={styles.filterOptions}>
              {(['all', 'quotes', 'questions'] as ContentType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    contentType === type && styles.filterChipActive,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setContentType(type)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: contentType === type ? '#ffffff' : colors.text },
                    ]}
                  >
                    {type === 'all' ? 'All' : type === 'quotes' ? 'Quotes' : 'Questions'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Source Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Source:</Text>
            <View style={styles.filterOptions}>
              {(['all', 'self', 'coach', 'system'] as SourceFilter[]).map((source) => (
                <TouchableOpacity
                  key={source}
                  style={[
                    styles.filterChip,
                    sourceFilter === source && styles.filterChipActive,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setSourceFilter(source)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: sourceFilter === source ? '#ffffff' : colors.text },
                    ]}
                  >
                    {source === 'all' ? 'All' : source === 'self' ? 'Mine' : source === 'coach' ? 'Coach' : 'System'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Domain Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Domain:</Text>
            <View style={styles.filterOptions}>
              {(['all', 'mission', 'wellness', 'goals', 'roles'] as DomainFilter[]).map((domain) => (
                <TouchableOpacity
                  key={domain}
                  style={[
                    styles.filterChip,
                    domainFilter === domain && styles.filterChipActive,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setDomainFilter(domain)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: domainFilter === domain ? '#ffffff' : colors.text },
                    ]}
                  >
                    {domain === 'all' ? 'All' : domain.charAt(0).toUpperCase() + domain.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Results Count */}
      <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
        {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
        {(sourceFilter !== 'all' || domainFilter !== 'all' || contentType !== 'all') && ' (filtered)'}
      </Text>

      {/* Items List */}
      {filteredItems.length > 0 ? (
        <View style={styles.listContainer}>
          {filteredItems.map((item) => (
            <View key={`${item.type}-${item.id}`}>
              {renderItem({ item })}
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
          <Quote size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Sparks Yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Add inspiring quotes and powerful questions to fuel your morning spark rituals.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addQuoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#B91C1C',
  },
  addQuestionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Filters
  filtersContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  filterRow: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: '#B91C1C',
    borderColor: '#B91C1C',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Results Count
  resultsCount: {
    fontSize: 12,
    marginBottom: 12,
  },

  // List
  listContainer: {
    gap: 12,
  },

  // Item Card
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  domainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  domainBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  pinnedBadge: {
    padding: 4,
    borderRadius: 4,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  itemText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  itemSubtitle: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  timesShown: {
    fontSize: 11,
  },

  // Empty State
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});