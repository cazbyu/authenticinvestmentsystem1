import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { 
  Crown, 
  Users, 
  MessageCircle, 
  Calendar,
  Shield,
  Eye,
  EyeOff,
  ChevronRight,
  Plus,
  Star,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

// Types
interface CoachRelationship {
  id: string;
  coach_id: string;
  is_primary: boolean;
  status: string;
  coach_role: string | null;
  can_view_score?: boolean;
  can_view_activity_counts?: boolean;
  can_view_journal_content?: boolean;
  next_meeting_date?: string | null;
  coach_profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

interface CoachsCornerTabProps {
  relationships: CoachRelationship[];
  onRefresh?: () => void;
}

export function CoachsCornerTab({ relationships, onRefresh }: CoachsCornerTabProps) {
  const router = useRouter();
  const { theme } = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [enrichedRelationships, setEnrichedRelationships] = useState<CoachRelationship[]>([]);

  // Separate head coach from staff
  const headCoach = enrichedRelationships.find(r => r.is_primary);
  const coachingStaff = enrichedRelationships.filter(r => !r.is_primary);

  // Fetch coach profiles to enrich relationship data
  const fetchCoachProfiles = useCallback(async () => {
    if (relationships.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const coachIds = relationships.map(r => r.coach_id);

      // Fetch profiles for all coaches
      const { data: profiles, error } = await supabase
        .from('0008-ap-users')
        .select('id, full_name, avatar_url, email')
        .in('id', coachIds);

      if (error) {
        console.error('Error fetching coach profiles:', error);
        setEnrichedRelationships(relationships);
        setLoading(false);
        return;
      }

      // Enrich relationships with profile data
      const enriched = relationships.map(rel => {
        const profile = profiles?.find(p => p.id === rel.coach_id);
        return {
          ...rel,
          coach_profile: profile || undefined,
        };
      });

      setEnrichedRelationships(enriched);
    } catch (err) {
      console.error('Error in fetchCoachProfiles:', err);
      setEnrichedRelationships(relationships);
    } finally {
      setLoading(false);
    }
  }, [relationships]);

  useEffect(() => {
    fetchCoachProfiles();
  }, [fetchCoachProfiles]);

  // Navigation handlers
  const handleMessageCoach = useCallback((coachId: string) => {
    router.push(`/coach/chat?coach_id=${coachId}`);
  }, [router]);

  const handleScheduleMeeting = useCallback((coachId: string) => {
    router.push(`/coach/schedule?coach_id=${coachId}`);
  }, [router]);

  const handleViewCoachProfile = useCallback((coachId: string) => {
    router.push(`/coach/profile/${coachId}`);
  }, [router]);

  const handleManagePermissions = useCallback((relationshipId: string) => {
    router.push(`/settings/coach-permissions?relationship=${relationshipId}`);
  }, [router]);

  const handleInviteCoach = useCallback(() => {
    router.push('/coach/invite');
  }, [router]);

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format next meeting date
  const formatNextMeeting = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (enrichedRelationships.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
          <Users size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Coaches Yet
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Connect with a coach to get personalized guidance and accountability on your journey.
          </Text>
          <TouchableOpacity
            onPress={handleInviteCoach}
            style={[styles.inviteButton, { backgroundColor: theme.colors.primary }]}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.inviteButtonText}>Invite a Coach</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Head Coach Hero Card */}
      {headCoach && (
        <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.heroHeader}>
            <Crown size={20} color="#f59e0b" />
            <Text style={[styles.heroLabel, { color: '#f59e0b' }]}>Head Coach</Text>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.heroAvatar}>
              {headCoach.coach_profile?.avatar_url ? (
                <Image
                  source={{ uri: headCoach.coach_profile.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: '#f59e0b' }]}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(headCoach.coach_profile?.full_name)}
                  </Text>
                </View>
              )}
              <View style={styles.primaryBadge}>
                <Star size={12} color="#ffffff" fill="#ffffff" />
              </View>
            </View>

            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { color: theme.colors.text }]}>
                {headCoach.coach_profile?.full_name || 'Your Coach'}
              </Text>
              {headCoach.coach_role && (
                <Text style={[styles.heroRole, { color: theme.colors.textSecondary }]}>
                  {headCoach.coach_role}
                </Text>
              )}
              {headCoach.next_meeting_date && (
                <View style={styles.nextMeeting}>
                  <Calendar size={14} color={theme.colors.primary} />
                  <Text style={[styles.nextMeetingText, { color: theme.colors.primary }]}>
                    Next: {formatNextMeeting(headCoach.next_meeting_date)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Glass Wall Permissions */}
          <View style={[styles.permissionsRow, { borderTopColor: theme.colors.border }]}>
            <View style={styles.permissionItem}>
              <Shield size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.permissionLabel, { color: theme.colors.textSecondary }]}>
                Visibility:
              </Text>
              {headCoach.can_view_score && (
                <View style={[styles.permissionBadge, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.permissionBadgeText, { color: '#166534' }]}>Score</Text>
                </View>
              )}
              {headCoach.can_view_activity_counts && (
                <View style={[styles.permissionBadge, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[styles.permissionBadgeText, { color: '#1e40af' }]}>Activity</Text>
                </View>
              )}
              {headCoach.can_view_journal_content && (
                <View style={[styles.permissionBadge, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.permissionBadgeText, { color: '#92400e' }]}>Journal</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleManagePermissions(headCoach.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.editPermissions, { color: theme.colors.primary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleMessageCoach(headCoach.coach_id)}
            >
              <MessageCircle size={18} color="#ffffff" />
              <Text style={styles.actionButtonText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary, { borderColor: theme.colors.border }]}
              onPress={() => handleScheduleMeeting(headCoach.coach_id)}
            >
              <Calendar size={18} color={theme.colors.text} />
              <Text style={[styles.actionButtonTextSecondary, { color: theme.colors.text }]}>
                Schedule
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Coaching Staff Section */}
      {coachingStaff.length > 0 && (
        <View style={[styles.staffSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.staffHeader}>
            <Users size={18} color={theme.colors.textSecondary} />
            <Text style={[styles.staffTitle, { color: theme.colors.text }]}>
              Coaching Staff
            </Text>
            <Text style={[styles.staffCount, { color: theme.colors.textSecondary }]}>
              ({coachingStaff.length})
            </Text>
          </View>

          <View style={styles.staffList}>
            {coachingStaff.map((coach) => (
              <TouchableOpacity
                key={coach.id}
                style={[styles.staffCard, { borderColor: theme.colors.border }]}
                onPress={() => handleViewCoachProfile(coach.coach_id)}
                activeOpacity={0.7}
              >
                <View style={styles.staffAvatar}>
                  {coach.coach_profile?.avatar_url ? (
                    <Image
                      source={{ uri: coach.coach_profile.avatar_url }}
                      style={styles.staffAvatarImage}
                    />
                  ) : (
                    <View style={[styles.staffAvatarFallback, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.staffAvatarInitials}>
                        {getInitials(coach.coach_profile?.full_name)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.staffInfo}>
                  <Text style={[styles.staffName, { color: theme.colors.text }]}>
                    {coach.coach_profile?.full_name || 'Coach'}
                  </Text>
                  {coach.coach_role && (
                    <Text style={[styles.staffRole, { color: theme.colors.textSecondary }]}>
                      {coach.coach_role}
                    </Text>
                  )}
                </View>

                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Invite More Coaches */}
      <TouchableOpacity
        style={[styles.inviteCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={handleInviteCoach}
        activeOpacity={0.7}
      >
        <Plus size={20} color={theme.colors.primary} />
        <Text style={[styles.inviteCardText, { color: theme.colors.primary }]}>
          Invite Another Coach
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  // Empty State
  emptyCard: {
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
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  inviteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Hero Card (Head Coach)
  heroCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  heroAvatar: {
    position: 'relative',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#f59e0b',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroRole: {
    fontSize: 14,
    marginBottom: 8,
  },
  nextMeeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextMeetingText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Permissions Row
  permissionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginBottom: 16,
    borderTopWidth: 1,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  permissionLabel: {
    fontSize: 12,
  },
  permissionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  permissionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  editPermissions: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Action Buttons
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Staff Section
  staffSection: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  staffTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  staffCount: {
    fontSize: 14,
  },
  staffList: {
    gap: 12,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  staffAvatar: {},
  staffAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  staffAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAvatarInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
  },
  staffRole: {
    fontSize: 13,
    marginTop: 2,
  },

  // Invite Card
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  inviteCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
});