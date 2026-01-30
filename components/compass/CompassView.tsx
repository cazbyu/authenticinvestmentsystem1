import React, { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { AspirationalQuote } from './AspirationalQuote';
import { LifeCompass } from './LifeCompass';
import { useTheme } from '@/contexts/ThemeContext';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import JournalForm from '@/components/reflections/JournalForm';

export function CompassView() {
  const { colors } = useTheme();
  const [isTaskEventFormVisible, setIsTaskEventFormVisible] = useState(false);
  const [taskEventFormType, setTaskEventFormType] = useState<'task' | 'event' | 'depositIdea'>('task');
  const [isJournalFormVisible, setIsJournalFormVisible] = useState(false);
  const [journalFormType, setJournalFormType] = useState<'rose' | 'thorn' | 'reflection'>('reflection');

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AspirationalQuote />
      <View style={styles.compassWrapper}>
        <LifeCompass
          size={320}
          onTaskFormOpen={handleTaskFormOpen}
          onJournalFormOpen={handleJournalFormOpen}
        />
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
    minHeight: 600,
  },
  compassWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingBottom: 60,
    minHeight: 400,
  },
});
