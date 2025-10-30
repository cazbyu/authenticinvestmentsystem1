import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import DailyNotesView from '@/components/reflections/DailyNotesView';
import WeeklyReflectionView from '@/components/reflections/WeeklyReflectionView';
import ReflectionHistoryView from '@/components/reflections/ReflectionHistoryView';
import JournalForm from '@/components/reflections/JournalForm';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { DraggableFab } from '@/components/DraggableFab';
import { ReflectionWithRelations } from '@/lib/reflectionUtils';

const TAB_STORAGE_KEY = '@reflections_active_tab';

type TabType = 'daily' | 'weekly' | 'reflectionHistory';
type ActionType = 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'followUp';

interface ActionData {
  notes: string;
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedKeyRelationshipIds: string[];
}

export default function ReflectionsScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [authenticScore, setAuthenticScore] = useState(0);
  const [isJournalFormVisible, setIsJournalFormVisible] = useState(false);
  const [isTaskEventFormVisible, setIsTaskEventFormVisible] = useState(false);
  const [taskEventFormType, setTaskEventFormType] = useState<'task' | 'event' | 'depositIdea' | 'withdrawal'>('task');
  const [taskEventFormInitialData, setTaskEventFormInitialData] = useState<any>(null);
  const [selectedReflection, setSelectedReflection] = useState<ReflectionWithRelations | null>(null);

  useEffect(() => {
    loadActiveTab();
    calculateAuthenticScore();
  }, []);

  const loadActiveTab = async () => {
    try {
      const savedTab = await AsyncStorage.getItem(TAB_STORAGE_KEY);
      if (savedTab === 'daily' || savedTab === 'weekly' || savedTab === 'reflectionHistory') {
        setActiveTab(savedTab);
      }
    } catch (error) {
      console.error('Error loading active tab:', error);
    }
  };

  const handleTabChange = async (tab: TabType) => {
    setActiveTab(tab);
    try {
      await AsyncStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch (error) {
      console.error('Error saving active tab:', error);
    }
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const { data: tasks, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .gte('completed_at', startOfDay.toISOString())
        .lt('completed_at', endOfDay.toISOString());

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        return;
      }

      let score = 0;
      if (tasks) {
        tasks.forEach((task: any) => {
          let points = 0;

          if (!task.is_urgent && task.is_important) points += 2;
          else if (task.is_urgent && task.is_important) points += 1.5;
          else if (task.is_urgent && !task.is_important) points += 1;
          else points += 0.5;

          score += Math.round(points * 10) / 10;
        });
      }

      const { data: withdrawals } = await supabase
        .from('0008-ap-withdrawals')
        .select('amount')
        .eq('user_id', user.id)
        .gte('withdrawn_at', startOfDay.toISOString())
        .lt('withdrawn_at', endOfDay.toISOString());

      if (withdrawals) {
        const totalWithdrawals = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
        score = Math.max(0, score - totalWithdrawals);
      }

      setAuthenticScore(Math.round(score));
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  const handleJournalFormAction = (action: ActionType, data: ActionData) => {
    if (action === 'followUp') {
      return;
    }

    const typeMapping: Record<Exclude<ActionType, 'followUp'>, 'task' | 'event' | 'depositIdea' | 'withdrawal'> = {
      task: 'task',
      event: 'event',
      depositIdea: 'depositIdea',
      withdrawal: 'withdrawal',
    };

    setTaskEventFormType(typeMapping[action]);
    setTaskEventFormInitialData({
      notes: data.notes,
      selectedRoleIds: data.selectedRoleIds,
      selectedDomainIds: data.selectedDomainIds,
      selectedKeyRelationshipIds: data.selectedKeyRelationshipIds,
    });
    setIsJournalFormVisible(false);
    setIsTaskEventFormVisible(true);
  };

  const handleReflectionPress = (reflection: ReflectionWithRelations) => {
    setSelectedReflection(reflection);
    setIsJournalFormVisible(true);
  };

  const handleJournalFormClose = () => {
    setIsJournalFormVisible(false);
    setSelectedReflection(null);
  };

  const handleTaskEventFormClose = () => {
    setIsTaskEventFormVisible(false);
    setTaskEventFormInitialData(null);
  };

  const handleTaskEventFormSuccess = () => {
    setIsTaskEventFormVisible(false);
    setTaskEventFormInitialData(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Reflections"
        authenticScore={authenticScore}
        activeView={activeTab}
        onViewChange={(view) => handleTabChange(view as TabType)}
      />

      <View style={styles.content}>
        {activeTab === 'daily' && <DailyNotesView onReflectionPress={handleReflectionPress} />}
        {activeTab === 'weekly' && <WeeklyReflectionView />}
        {activeTab === 'reflectionHistory' && (
          <ReflectionHistoryView onReflectionPress={handleReflectionPress} />
        )}
      </View>

      <DraggableFab
        onPress={() => setIsJournalFormVisible(true)}
        size={56}
        backgroundColor={colors.primary}
      >
        <Text style={styles.fabText}>J</Text>
      </DraggableFab>

      <JournalForm
        visible={isJournalFormVisible}
        mode={selectedReflection ? 'edit' : 'create'}
        initialData={selectedReflection || undefined}
        onClose={handleJournalFormClose}
        onSaveSuccess={() => {
          handleJournalFormClose();
          calculateAuthenticScore();
        }}
        onActionSelected={handleJournalFormAction}
      />

      {isTaskEventFormVisible && (
        <TaskEventForm
          mode="create"
          initialData={{
            type: taskEventFormType,
            notes: taskEventFormInitialData?.notes || '',
            selectedRoleIds: taskEventFormInitialData?.selectedRoleIds || [],
            selectedDomainIds: taskEventFormInitialData?.selectedDomainIds || [],
            selectedKeyRelationshipIds: taskEventFormInitialData?.selectedKeyRelationshipIds || [],
          }}
          onSubmitSuccess={handleTaskEventFormSuccess}
          onClose={handleTaskEventFormClose}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  fabText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
