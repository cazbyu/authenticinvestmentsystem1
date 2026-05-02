import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useNorthStarVisit } from '@/hooks/NorthStarVisits';
import { UniversalHeader } from '@/components/UniversalHeader';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import NorthStarIdentityHeader from '@/components/northStar/NorthStarIdentityHeader';
import NorthStarMyPurpose from '@/components/northStar/NorthStarMyPurpose';
import { toLocalISOString } from '@/lib/dateUtils';

const ACCENT = '#8b1a1a';

type DeepCapture = {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
};

interface CoachRelationship {
  id: string;
  coach_id: string;
  is_primary: boolean;
  status: string;
  coach_role: string | null;
}

const TOOLS: Array<{ name: string; icon: string; desc: string }> = [
  { name: 'Mission Generator', icon: '⚙', desc: '6-step guided flow' },
  { name: 'Vision Builder', icon: '✦', desc: '5-year picture' },
  { name: 'Values Explorer', icon: '◈', desc: 'Find your anchors' },
  { name: 'Power Q Journal', icon: '◻', desc: 'Track your answers' },
  { name: "Coach's Corner", icon: '◎', desc: 'Connect with a coach' },
  { name: 'Spark Library', icon: '⚡', desc: 'Quotes & questions' },
];

function formatRelativeDate(iso: string): string {
  const then = new Date(iso);
  const ms = Date.now() - then.getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export default function NorthStarPage() {
  const { colors } = useTheme();
  const { recordVisit } = useNorthStarVisit();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCoach, setHasCoach] = useState(false);
  const [coachRelationships, setCoachRelationships] = useState<CoachRelationship[]>([]);
  const [settingsSidebarVisible, setSettingsSidebarVisible] = useState(false);

  // North Star data
  const [missionStatement, setMissionStatement] = useState<string | null>(null);
  const [vision, setVision] = useState<string | null>(null);
  const [lifeMotto, setLifeMotto] = useState<string | null>(null);
  const [coreValues, setCoreValues] = useState<string[] | null>(null);

  // Deep captures
  const [deepCaptures, setDeepCaptures] = useState<DeepCapture[]>([]);
  const [captureInput, setCaptureInput] = useState('');
  const [captureTitle, setCaptureTitle] = useState('');
  const [savingCapture, setSavingCapture] = useState(false);

  // Tool panels (all coming-soon for NS-2)
  const [activeToolPanel, setActiveToolPanel] = useState<string | null>(null);

  // Record visit on mount
  useEffect(() => {
    recordVisit('full_page');
  }, []);

  // ---- Fetchers ----

  const checkCoachRelationships = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-coach-client-meta')
        .select(`
          id,
          coach_id,
          is_primary,
          status,
          coach_role
        `)
        .eq('client_id', user.id)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching coach relationships:', error);
        return;
      }

      const relationships = data || [];
      setCoachRelationships(relationships);
      setHasCoach(relationships.length > 0);
    } catch (err) {
      console.error('Error checking coach relationships:', err);
    }
  }, []);

  const fetchNorthStarData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, life_motto, core_values')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[NS-2] error fetching north star:', error);
        return;
      }

      if (data) {
        setMissionStatement(data.mission_statement);
        setVision(data['5yr_vision']);
        setLifeMotto(data.life_motto);
        setCoreValues(Array.isArray(data.core_values) ? (data.core_values as string[]) : []);
      } else {
        setMissionStatement(null);
        setVision(null);
        setLifeMotto(null);
        setCoreValues([]);
      }
    } catch (err) {
      console.error('[NS-2] error in fetchNorthStarData:', err);
    }
  }, []);

  const fetchDeepCaptures = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-ns-deep-captures')
        .select('id, title, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[NS-2] error fetching deep captures:', error);
        return;
      }

      setDeepCaptures((data ?? []) as DeepCapture[]);
    } catch (err) {
      console.error('[NS-2] error in fetchDeepCaptures:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      await Promise.all([
        checkCoachRelationships(),
        fetchNorthStarData(),
        fetchDeepCaptures(),
      ]);
      setLoading(false);
    };
    initializePage();
  }, [checkCoachRelationships, fetchNorthStarData, fetchDeepCaptures]);

  // ---- Save handlers ----

  const handleSaveField = useCallback(
    async (
      field: 'mission_statement' | '5yr_vision' | 'life_motto',
      value: string,
    ): Promise<void> => {
      // optimistic local update
      if (field === 'mission_statement') setMissionStatement(value);
      else if (field === '5yr_vision') setVision(value);
      else if (field === 'life_motto') setLifeMotto(value);

      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existing } = await supabase
          .from('0008-ap-north-star')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('0008-ap-north-star')
            .update({ [field]: value, updated_at: toLocalISOString(new Date()) })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('0008-ap-north-star')
            .insert({ user_id: user.id, [field]: value, updated_at: toLocalISOString(new Date()) });
        }
      } catch (err) {
        console.error('[NS-2] failed to save north star field:', err);
        await fetchNorthStarData(); // revert by refresh
      }
    },
    [fetchNorthStarData],
  );

  const handleSaveCoreValues = useCallback(
    async (values: string[]): Promise<void> => {
      setCoreValues(values); // optimistic

      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existing } = await supabase
          .from('0008-ap-north-star')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('0008-ap-north-star')
            .update({ core_values: values, updated_at: toLocalISOString(new Date()) })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('0008-ap-north-star')
            .insert({ user_id: user.id, core_values: values, updated_at: toLocalISOString(new Date()) });
        }
      } catch (err) {
        console.error('[NS-2] failed to save core values:', err);
        await fetchNorthStarData();
      }
    },
    [fetchNorthStarData],
  );

  const handleSaveCapture = useCallback(async (): Promise<void> => {
    const content = captureInput.trim();
    if (!content) return;
    const title = captureTitle.trim() || null;

    setSavingCapture(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-ns-deep-captures')
        .insert({ user_id: user.id, title, content })
        .select('id, title, content, created_at')
        .single();

      if (error) {
        console.error('[NS-2] failed to insert deep capture:', error);
        return;
      }

      if (data) {
        setDeepCaptures(prev => [data as DeepCapture, ...prev]);
        setCaptureInput('');
        setCaptureTitle('');
      }
    } catch (err) {
      console.error('[NS-2] error in handleSaveCapture:', err);
    } finally {
      setSavingCapture(false);
    }
  }, [captureInput, captureTitle]);

  // ---- Refresh ----

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      checkCoachRelationships(),
      fetchNorthStarData(),
      fetchDeepCaptures(),
    ]);
    setRefreshing(false);
  }, [checkCoachRelationships, fetchNorthStarData, fetchDeepCaptures]);

  // ---- Coming-soon helper ----

  const showComingSoon = useCallback((feature: string) => {
    const msg = `${feature} coming soon.`;
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert(feature, msg);
    }
  }, []);

  // ---- Computed counts ----

  const deepCapturesCount = deepCaptures.length;
  const coreValuesCount = (coreValues ?? []).length;
  const powerQAnswersCount = 0; // future arc — Power Q journal not yet built

  // ---- Render ----

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
        <SettingsSidebar
          visible={settingsSidebarVisible}
          onClose={() => setSettingsSidebarVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.spacer10} />

        <NorthStarIdentityHeader
          deepCapturesCount={deepCapturesCount}
          powerQAnswersCount={powerQAnswersCount}
          coreValuesCount={coreValuesCount}
        />

        <View style={styles.spacer10} />

        <NorthStarMyPurpose
          missionStatement={missionStatement}
          vision={vision}
          lifeMotto={lifeMotto}
          coreValues={coreValues}
          onSaveField={handleSaveField}
          onSaveCoreValues={handleSaveCoreValues}
          onRefineMission={() => showComingSoon('Mission Generator')}
          onRefineVision={() => showComingSoon('Vision Builder')}
        />

        <View style={styles.spacer10} />

        {/* Deep Captures */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.sectionLabelRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              DEEP CAPTURES
            </Text>
          </View>

          <View style={styles.cardBody}>
            <TextInput
              value={captureTitle}
              onChangeText={setCaptureTitle}
              placeholder="Title (optional)"
              placeholderTextColor="#9ca3af"
              style={styles.captureTitleInput}
              maxLength={120}
            />

            <TextInput
              value={captureInput}
              onChangeText={setCaptureInput}
              placeholder="Capture a purpose-level thought, insight, or idea..."
              placeholderTextColor="#9ca3af"
              style={styles.captureInput}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.captureBtnRow}>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: ACCENT },
                  (savingCapture || !captureInput.trim()) && { opacity: 0.5 },
                ]}
                onPress={handleSaveCapture}
                disabled={savingCapture || !captureInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>
                  {savingCapture ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exploreBtn, { borderColor: ACCENT }]}
                onPress={() => showComingSoon('Development Director')}
                activeOpacity={0.7}
              >
                <Text style={[styles.exploreBtnText, { color: ACCENT }]}>
                  Explore with DD
                </Text>
              </TouchableOpacity>
            </View>

            {deepCaptures.length === 0 ? (
              <Text style={styles.capturesEmpty}>
                No deep captures yet. This is your purpose journal.
              </Text>
            ) : (
              <View style={styles.capturesList}>
                {deepCaptures.map((c, idx) => (
                  <View key={c.id}>
                    <View style={styles.captureRow}>
                      <View style={styles.captureMetaRow}>
                        {c.title ? (
                          <Text
                            style={[styles.captureTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {c.title}
                          </Text>
                        ) : (
                          <Text
                            style={[
                              styles.captureTitleEmpty,
                              { color: colors.textSecondary },
                            ]}
                          >
                            (untitled)
                          </Text>
                        )}
                        <Text
                          style={[styles.captureDate, { color: colors.textSecondary }]}
                        >
                          {formatRelativeDate(c.created_at)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.capturePreview, { color: colors.textSecondary }]}
                        numberOfLines={2}
                      >
                        {c.content}
                      </Text>
                    </View>
                    {idx < deepCaptures.length - 1 && (
                      <View
                        style={[styles.captureDivider, { backgroundColor: colors.border }]}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.spacer10} />

        {/* Tools */}
        <View style={styles.toolsSection}>
          <Text style={[styles.toolsLabel, { color: colors.textSecondary }]}>
            TOOLS
          </Text>
          <View style={styles.toolsGrid}>
            {TOOLS.map((tool) => (
              <TouchableOpacity
                key={tool.name}
                style={[
                  styles.toolTile,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => showComingSoon(tool.name)}
                activeOpacity={0.7}
              >
                <View style={styles.toolIconWrap}>
                  <Text style={styles.toolIcon}>{tool.icon}</Text>
                </View>
                <Text style={[styles.toolName, { color: colors.text }]}>
                  {tool.name}
                </Text>
                <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                  {tool.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <SettingsSidebar
        visible={settingsSidebarVisible}
        onClose={() => setSettingsSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  spacer10: {
    height: 10,
  },

  card: {
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  sectionLabelRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },

  captureTitleInput: {
    fontSize: 13,
    color: '#111827',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  captureInput: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
    minHeight: 70,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  captureBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  exploreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  capturesEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#9ca3af',
    paddingVertical: 8,
  },
  capturesList: {
    gap: 0,
  },
  captureRow: {
    paddingVertical: 10,
    gap: 4,
  },
  captureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  captureTitle: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  captureTitleEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    flex: 1,
  },
  captureDate: {
    fontSize: 11,
  },
  capturePreview: {
    fontSize: 12,
    lineHeight: 18,
  },
  captureDivider: {
    height: StyleSheet.hairlineWidth,
  },

  toolsSection: {
    gap: 10,
  },
  toolsLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolTile: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 12,
    gap: 6,
  },
  toolIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIcon: {
    fontSize: 14,
    color: ACCENT,
  },
  toolName: {
    fontSize: 13,
    fontWeight: '500',
  },
  toolDesc: {
    fontSize: 11,
  },
});
