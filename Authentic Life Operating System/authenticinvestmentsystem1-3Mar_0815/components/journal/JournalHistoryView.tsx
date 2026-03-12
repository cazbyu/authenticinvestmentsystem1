import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import MonthlyCardsView from '../reflections/MonthlyCardsView';
import MonthlyIndexView from '../reflections/MonthlyIndexView';
import DailyViewModal from '../reflections/DailyViewModal';
import { ReflectionDetailsModal } from '../reflections/ReflectionDetailsModal';
import { ActionDetailsModal } from '../tasks/ActionDetailsModal';
import { DepositIdeaDetailModal } from '../depositIdeas/DepositIdeaDetailModal';
import { getSupabaseClient } from '@/lib/supabase';
import { ReflectionWithRelations, fetchAttachmentsForReflections } from '@/lib/reflectionUtils';

type ViewState = 'monthlyCards' | 'monthlyIndex' | 'dailyView';

export default function JournalHistoryView() {
  const { colors } = useTheme();
  const [currentView, setCurrentView] = useState<ViewState>('monthlyCards');
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number; monthYear: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Reflection detail modal state
  const [selectedReflection, setSelectedReflection] = useState<ReflectionWithRelations | null>(null);
  const [isReflectionDetailVisible, setIsReflectionDetailVisible] = useState(false);

  // Task/Event detail modal state
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskDetailVisible, setIsTaskDetailVisible] = useState(false);
  const [selectedTaskGoalTitle, setSelectedTaskGoalTitle] = useState<string | undefined>(undefined);

  // Deposit Idea detail modal state
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [isDepositIdeaDetailVisible, setIsDepositIdeaDetailVisible] = useState(false);

  const handleMonthPress = (year: number, month: number, monthYear: string) => {
    setSelectedMonth({ year, month, monthYear });
    setCurrentView('monthlyIndex');
  };

  const handleDatePress = (date: string) => {
    const normalizedDate = date.split('T')[0];
    setSelectedDate(normalizedDate);
    setCurrentView('dailyView');
  };

  const handleBackToMonthlyCards = () => {
    setSelectedMonth(null);
    setCurrentView('monthlyCards');
  };

  const handleCloseDailyView = () => {
    setSelectedDate(null);
    setCurrentView('monthlyIndex');
  };

  const handleNotePress = async (item: any) => {
    const itemType = item.type;

    if (itemType === 'reflection' || itemType === 'rose' || itemType === 'thorn') {
      // Fetch full reflection data and open ReflectionDetailsModal
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: reflectionData, error } = await supabase
          .from('0008-ap-reflections')
          .select('*')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single();

        if (error || !reflectionData) {
          console.error('[JournalHistory] Error fetching reflection:', error);
          return;
        }

        // Fetch related data (roles, domains, attachments)
        const [rolesRes, domainsRes, keyRelsRes, notesRes, attachmentsMap] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id, role_id, role:0008-ap-roles(id,label,color)')
            .eq('parent_id', item.id)
            .eq('parent_type', 'reflection'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id, domain_id, domain:0008-ap-domains(id,name,color)')
            .eq('parent_id', item.id)
            .eq('parent_type', 'reflection'),
          supabase
            .from('0008-ap-universal-key-relationships-join')
            .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
            .eq('parent_id', item.id)
            .eq('parent_type', 'reflection'),
          supabase
            .from('0008-ap-universal-notes-join')
            .select('parent_id, note:0008-ap-notes(id,content,created_at)')
            .eq('parent_id', item.id)
            .eq('parent_type', 'reflection'),
          fetchAttachmentsForReflections([item.id]),
        ]);

        const roles = (rolesRes.data ?? []).map((r: any) => r.role).filter(Boolean);
        const domains = (domainsRes.data ?? []).map((d: any) => d.domain).filter(Boolean);
        const keyRelationships = (keyRelsRes.data ?? []).map((k: any) => k.key_relationship).filter(Boolean);
        const notes = (notesRes.data ?? []).map((n: any) => n.note).filter(Boolean);
        const attachments = attachmentsMap.get(item.id) ?? [];

        const fullReflection: ReflectionWithRelations = {
          ...reflectionData,
          roles,
          domains,
          keyRelationships,
          notes,
          attachments,
        };

        setSelectedReflection(fullReflection);
        setIsReflectionDetailVisible(true);
      } catch (err) {
        console.error('[JournalHistory] Error opening reflection detail:', err);
      }
    } else if (itemType === 'task' || itemType === 'event') {
      // Fetch full task/event data and open ActionDetailsModal
      try {
        const supabase = getSupabaseClient();
        const taskId = item.parentItem?.id || item.id;

        const { data: taskData, error } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (error || !taskData) {
          console.error('[JournalHistory] Error fetching task:', error);
          return;
        }

        setSelectedTask(taskData);
        setSelectedTaskGoalTitle(item.goalTitle || undefined);
        setIsTaskDetailVisible(true);
      } catch (err) {
        console.error('[JournalHistory] Error opening task detail:', err);
      }
    } else if (itemType === 'depositIdea') {
      // Fetch full deposit idea data and open DepositIdeaDetailModal
      try {
        const supabase = getSupabaseClient();
        const ideaId = item.parentItem?.id || item.id;

        const { data: ideaData, error } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('id', ideaId)
          .single();

        if (error || !ideaData) {
          console.error('[JournalHistory] Error fetching deposit idea:', error);
          return;
        }

        setSelectedDepositIdea(ideaData);
        setIsDepositIdeaDetailVisible(true);
      } catch (err) {
        console.error('[JournalHistory] Error opening deposit idea detail:', err);
      }
    }
  };

  const handleReflectionDetailClose = () => {
    setIsReflectionDetailVisible(false);
    setSelectedReflection(null);
  };

  const handleReflectionDelete = async (reflection: ReflectionWithRelations) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-reflections')
        .update({ archived: true })
        .eq('id', reflection.id);

      if (error) throw error;

      setIsReflectionDetailVisible(false);
      setSelectedReflection(null);
    } catch (err) {
      console.error('[JournalHistory] Error deleting reflection:', err);
      Alert.alert('Error', 'Failed to delete reflection');
    }
  };

  const handleTaskDetailClose = () => {
    setIsTaskDetailVisible(false);
    setSelectedTask(null);
    setSelectedTaskGoalTitle(undefined);
  };

  const handleTaskDelete = async (task: any) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', task.id);

      if (error) throw error;

      setIsTaskDetailVisible(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('[JournalHistory] Error deleting task:', err);
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  const handleDepositIdeaDetailClose = () => {
    setIsDepositIdeaDetailVisible(false);
    setSelectedDepositIdea(null);
  };

  const handleDepositIdeaDelete = async (idea: any) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({ archived: true })
        .eq('id', idea.id);

      if (error) throw error;

      setIsDepositIdeaDetailVisible(false);
      setSelectedDepositIdea(null);
    } catch (err) {
      console.error('[JournalHistory] Error archiving deposit idea:', err);
      Alert.alert('Error', 'Failed to archive deposit idea');
    }
  };

  const handleDepositIdeaActivate = (idea: any) => {
    // Close modal - activation would typically open a form
    setIsDepositIdeaDetailVisible(false);
    setSelectedDepositIdea(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {currentView === 'monthlyCards' && (
        <MonthlyCardsView onMonthPress={handleMonthPress} />
      )}

      {currentView === 'monthlyIndex' && selectedMonth && (
        <MonthlyIndexView
          year={selectedMonth.year}
          month={selectedMonth.month}
          monthYear={selectedMonth.monthYear}
          onBackPress={handleBackToMonthlyCards}
          onDatePress={handleDatePress}
        />
      )}

      {currentView === 'dailyView' && selectedDate && (
        <DailyViewModal
          visible={true}
          selectedDate={selectedDate}
          onClose={handleCloseDailyView}
          onNotePress={handleNotePress}
        />
      )}

      <ReflectionDetailsModal
        visible={isReflectionDetailVisible}
        reflection={selectedReflection}
        onClose={handleReflectionDetailClose}
        onDelete={handleReflectionDelete}
      />

      <ActionDetailsModal
        visible={isTaskDetailVisible}
        task={selectedTask}
        onClose={handleTaskDetailClose}
        onDelete={handleTaskDelete}
        goalTitle={selectedTaskGoalTitle}
      />

      <DepositIdeaDetailModal
        visible={isDepositIdeaDetailVisible}
        depositIdea={selectedDepositIdea}
        onClose={handleDepositIdeaDetailClose}
        onDelete={handleDepositIdeaDelete}
        onActivate={handleDepositIdeaActivate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
