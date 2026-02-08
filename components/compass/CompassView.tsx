import React, { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { AspirationalQuote } from './AspirationalQuote';
import { LifeCompass } from './LifeCompass';
import { OverduePopup } from './OverduePopup';
import { useTheme } from '@/contexts/ThemeContext';
import { useAttentionState } from '@/hooks/useAttentionState';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import JournalForm from '@/components/reflections/JournalForm';

export function CompassView() {
  const { colors } = useTheme();
  const {
    weeklyAlignmentOverdue,
    morningSparkDue,
    skipWeeklyAlignment,
    skipMorningSpark,
  } = useAttentionState();

  const [isTaskEventFormVisible, setIsTaskEventFormVisible] = useState(false);
  const [taskEventFormType, setTaskEventFormType] = useState<'task' | 'event' | 'depositIdea'>('task');
  const [isJournalFormVisible, setIsJournalFormVisible] = useState(false);
  const [journalFormType, setJournalFormType] = useState<'rose' | 'thorn' | 'reflection'>('reflection');

  // Session-only "Later" dismissals (not persisted)
  const [waLaterDismissed, setWaLaterDismissed] = useState(false);
  const [msLaterDismissed, setMsLaterDismissed] = useState(false);

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

  // Determine which popup to show (WA takes priority)
  const showWaPopup = weeklyAlignmentOverdue && !waLaterDismissed;
  const showMsPopup = morningSparkDue && !msLaterDismissed && !showWaPopup;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AspirationalQuote /> 
      <View style={styles.compassWrapper}>
        <LifeCompass
          size={300}
          onTaskFormOpen={handleTaskFormOpen}
          onJournalFormOpen={handleJournalFormOpen}
        />

        {/* Overdue popups — positioned below the compass */}
        {showWaPopup && (
          <View style={styles.popupContainer}>
            <OverduePopup
              message="Weekly Alignment overdue"
              primaryLabel="Skip This Week"
              secondaryLabel="Later"
              onPrimary={async () => {
                await skipWeeklyAlignment();
              }}
              onSecondary={() => setWaLaterDismissed(true)}
            />
          </View>
        )}

        {showMsPopup && (
          <View style={styles.popupContainer}>
            <OverduePopup
              message="Morning Spark ready"
              primaryLabel="Skip"
              secondaryLabel="Later"
              onPrimary={async () => {
                await skipMorningSpark();
              }}
              onSecondary={() => setMsLaterDismissed(true)}
            />
          </View>
        )}
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
  popupContainer: {
    width: '100%',
    paddingTop: 8,
  },
});
