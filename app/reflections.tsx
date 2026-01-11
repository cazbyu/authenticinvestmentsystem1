import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Plus } from 'lucide-react-native';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import DailyNotesView from '@/components/reflections/DailyNotesView';
import WeeklyReflectionView from '@/components/reflections/WeeklyReflectionView';
import ReflectionHistoryView from '@/components/reflections/ReflectionHistoryView';
import JournalForm from '@/components/reflections/JournalForm';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { ActionDetailsModal } from '@/components/tasks/ActionDetailsModal';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import { ReflectionDetailsModal } from '@/components/reflections/ReflectionDetailsModal';
import ActionSelectionModal, { ActionType as ActionModalType } from '@/components/reflections/ActionSelectionModal';
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
  const [isActionSelectionVisible, setIsActionSelectionVisible] = useState(false);
  const [pendingReflection, setPendingReflection] = useState<ReflectionWithRelations | null>(null);
  const [isTaskDetailModalVisible, setIsTaskDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskFormMode, setTaskFormMode] = useState<'create' | 'edit'>('create');
  const [isDepositIdeaModalVisible, setIsDepositIdeaModalVisible] = useState(false);
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any | null>(null);
  const [isReflectionDetailModalVisible, setIsReflectionDetailModalVisible] = useState(false);
  const [selectedReflectionDetail, setSelectedReflectionDetail] = useState<ReflectionWithRelations | null>(null);

  // Follow-through TaskEventForm state
  const [refreshAssociatedItemsKey, setRefreshAssociatedItemsKey] = useState(0);

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
        .is('deleted_at', null)
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
    setSelectedReflectionDetail(reflection);
    setIsReflectionDetailModalVisible(true);
  };

  const handleActionSelection = (action: ActionModalType) => {
    if (!pendingReflection) return;

    if (action === 'followUp') {
      setIsActionSelectionVisible(false);
      setSelectedReflection(pendingReflection);
      setPendingReflection(null);
      setIsJournalFormVisible(true);
    } else {
      const typeMapping: Record<Exclude<ActionModalType, 'followUp'>, 'task' | 'event' | 'depositIdea' | 'withdrawal'> = {
        task: 'task',
        event: 'event',
        depositIdea: 'depositIdea',
        withdrawal: 'withdrawal',
      };

      setTaskEventFormType(typeMapping[action]);
      setTaskEventFormInitialData({
        notes: pendingReflection.content || '',
        selectedRoleIds: pendingReflection.roles?.map((r) => r.id) || [],
        selectedDomainIds: pendingReflection.domains?.map((d) => d.id) || [],
        selectedKeyRelationshipIds: pendingReflection.keyRelationships?.map((kr) => kr.id) || [],
      });
      setPendingReflection(null);
      setIsActionSelectionVisible(false);
      setIsTaskEventFormVisible(true);
    }
  };

  const handleNoteCardPress = (item: any) => {
    if (item.type === 'reflection') {
      handleReflectionPress(item as ReflectionWithRelations);
    } else if (item.type === 'depositIdea' && item.parentItem) {
      setSelectedDepositIdea(item.parentItem);
      setIsDepositIdeaModalVisible(true);
    } else if (item.isActive && item.parentItem) {
      if (item.parent_type === 'task') {
        setSelectedTask(item.parentItem);
        setIsTaskDetailModalVisible(true);
      } else if (item.parent_type === 'depositIdea') {
        setSelectedDepositIdea(item.parentItem);
        setIsDepositIdeaModalVisible(true);
      }
    } else if (!item.isActive || item.type === 'withdrawal') {
      setSelectedReflection(item);
      setIsJournalFormVisible(true);
    }
  };

  const handleJournalFormClose = () => {
    setIsJournalFormVisible(false);
    setSelectedReflection(null);
  };

  const handleTaskEventFormClose = () => {
    setIsTaskEventFormVisible(false);
    setTaskEventFormInitialData(null);
    setEditingTask(null);
    setTaskFormMode('create');
  };

  const handleTaskEventFormSuccess = () => {
    setIsTaskEventFormVisible(false);
    setTaskEventFormInitialData(null);
    setEditingTask(null);
    setTaskFormMode('create');
  };

  const handleUpdateTask = (task: any) => {
    setEditingTask(task);
    setTaskFormMode('edit');
    setIsTaskDetailModalVisible(false);
    setTimeout(() => setIsTaskEventFormVisible(true), 100);
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Reflections"
        authenticScore={authenticScore}
        activeView={activeTab}
        onViewChange={(view) => handleTabChange(view as TabType)}
      />

      <View style={styles.content} pointerEvents="box-none">
        {activeTab === 'daily' && <DailyNotesView onReflectionPress={handleReflectionPress} onNotePress={handleNoteCardPress} />}
        {activeTab === 'weekly' && <WeeklyReflectionView onNotePress={handleNoteCardPress} />}
        {activeTab === 'reflectionHistory' && (
          <ReflectionHistoryView onReflectionPress={handleReflectionPress} />
        )}
      </View>

      <DraggableFab
        onPress={() => {
          setTaskEventFormType('task');
          setTaskEventFormInitialData(null);
          setIsTaskEventFormVisible(true);
        }}
        size={44}
        backgroundColor={colors.primary}
      >
        <Plus size={28} color="#ffffff" />
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

      <Modal
        visible={isTaskEventFormVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleTaskEventFormClose}
      >
        <TaskEventForm
          mode={taskFormMode}
          initialData={editingTask || {
            type: taskEventFormType,
            notes: taskEventFormInitialData?.notes || '',
            selectedRoleIds: taskEventFormInitialData?.selectedRoleIds || [],
            selectedDomainIds: taskEventFormInitialData?.selectedDomainIds || [],
            selectedKeyRelationshipIds: taskEventFormInitialData?.selectedKeyRelationshipIds || [],
          }}
          onSubmitSuccess={handleTaskEventFormSuccess}
          onClose={handleTaskEventFormClose}
        />
      </Modal>

      <ActionSelectionModal
        visible={isActionSelectionVisible}
        onActionSelect={handleActionSelection}
        onClose={() => {
          setIsActionSelectionVisible(false);
          setPendingReflection(null);
        }}
      />

      {isTaskDetailModalVisible && selectedTask && (
        <ActionDetailsModal
          visible={isTaskDetailModalVisible}
          task={selectedTask}
          onClose={() => {
            setIsTaskDetailModalVisible(false);
            setSelectedTask(null);
          }}
          onDelete={(task) => {
            console.log('Delete task:', task.id);
            setIsTaskDetailModalVisible(false);
            setSelectedTask(null);
          }}
          onEdit={handleUpdateTask}
          onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
        />
      )}

      {isDepositIdeaModalVisible && selectedDepositIdea && (
        <DepositIdeaDetailModal
          visible={isDepositIdeaModalVisible}
          depositIdea={selectedDepositIdea}
          onClose={() => {
            setIsDepositIdeaModalVisible(false);
            setSelectedDepositIdea(null);
          }}
          onDelete={(depositIdea) => {
            console.log('Delete deposit idea:', depositIdea.id);
            setIsDepositIdeaModalVisible(false);
            setSelectedDepositIdea(null);
          }}
          onActivate={(depositIdea) => {
            console.log('Activate deposit idea:', depositIdea.id);
            setIsDepositIdeaModalVisible(false);
            setSelectedDepositIdea(null);
          }}
          onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
        />
      )}

      {isReflectionDetailModalVisible && selectedReflectionDetail && (
        <ReflectionDetailsModal
          visible={isReflectionDetailModalVisible}
          reflection={selectedReflectionDetail}
          onClose={() => {
            setIsReflectionDetailModalVisible(false);
            setSelectedReflectionDetail(null);
          }}
          onDelete={(reflection) => {
            console.log('Delete reflection:', reflection.id);
            setIsReflectionDetailModalVisible(false);
            setSelectedReflectionDetail(null);
          }}
          onEdit={(reflection) => {
            setIsReflectionDetailModalVisible(false);
            setSelectedReflection(reflection);
            setIsJournalFormVisible(true);
          }}
          onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
