import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Text } from 'react-native';
import { AspirationalQuote } from './AspirationalQuote';
import { LifeCompass } from './LifeCompass';
import { useTheme } from '@/contexts/ThemeContext';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import JournalForm from '@/components/reflections/JournalForm';
import { getSupabaseClient } from '@/lib/supabase';

export function CompassView() {
  const { colors } = useTheme();
  const [isTaskEventFormVisible, setIsTaskEventFormVisible] = useState(false);
  const [taskEventFormType, setTaskEventFormType] = useState<'task' | 'event' | 'depositIdea'>('task');
  const [isJournalFormVisible, setIsJournalFormVisible] = useState(false);
  const [journalFormType, setJournalFormType] = useState<'rose' | 'thorn' | 'reflection'>('reflection');
  const [firstName, setFirstName] = useState<string>('');

  const handleTaskFormOpen = (formType: 'task' | 'event' | 'depositIdea') => {
    setTaskEventFormType(formType);
    setIsTaskEventFormVisible(true);
  };

  const handleJournalFormOpen = (formType: 'rose' | 'thorn' | 'reflection') => {
    setJournalFormType(formType);
    setIsJournalFormVisible(true);
  };

  const handleTaskEventFormClose = () => {
    setIsTaskEventFormVisible(false);
  };

  const handleTaskEventFormSuccess = () => {
    setIsTaskEventFormVisible(false);
  };

  const handleJournalFormClose = () => {
    setIsJournalFormVisible(false);
  };

  // Fetch user's first name
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('0008-ap-users')
          .select('first_name')
          .eq('id', user.id)
          .single();

        if (userData?.first_name) {
          setFirstName(userData.first_name);
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
      }
    };

    fetchUserName();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AspirationalQuote /> 
      <View style={styles.compassWrapper}>
        <LifeCompass
          size={300}
          onTaskFormOpen={handleTaskFormOpen}
          onJournalFormOpen={handleJournalFormOpen}
        />
        {/* Personalized title under compass */}
        <Text style={[styles.personalizedTitle, { color: colors.textSecondary }]}>
          {firstName 
            ? `${firstName}'s Authentic Life Operating System`
            : 'Your Authentic Life Operating System'
          }
        </Text>
      </View>

      <Modal
        visible={isTaskEventFormVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleTaskEventFormClose}
      >
        <TaskEventForm
          mode="create"
          preSelectedType={taskEventFormType}
          onSubmitSuccess={handleTaskEventFormSuccess}
          onClose={handleTaskEventFormClose}
        />
      </Modal>

      <JournalForm
        visible={isJournalFormVisible}
        mode="create"
        reflectionType={journalFormType}
        onClose={handleJournalFormClose}
        onSaveSuccess={handleJournalFormClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compassWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 20,
    minHeight: 350,
  },
  personalizedTitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
});
