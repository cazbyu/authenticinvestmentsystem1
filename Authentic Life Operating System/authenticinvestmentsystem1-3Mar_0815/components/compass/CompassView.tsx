import React, { useState, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { AspirationalQuote } from './AspirationalQuote';
import { LifeCompass } from './LifeCompass';
import { useTheme } from '@/contexts/ThemeContext';
const TaskEventForm = lazy(() => import('@/components/tasks/TaskEventForm'));
import JournalForm from '@/components/reflections/JournalForm';

type Direction = 'north' | 'south' | 'east' | 'west';

interface CompassViewProps {
  enablePanels?: boolean;
  defaultZone?: Direction;
  onDirectionChange?: (dir: Direction | null) => void;
}

const ZONE_TO_DIRECTION: Record<'mission' | 'wellness' | 'goals' | 'roles', Direction> = {
  mission: 'north',
  wellness: 'east',
  goals: 'south',
  roles: 'west',
};

const DIRECTION_COLORS: Record<Direction, string> = {
  north: '#8b1a1a',
  east: '#0f6e56',
  south: '#4b3a8f',
  west: '#1e3a5f',
};

const DIRECTION_ROUTES: Record<Direction, string> = {
  north: '/north-star',
  east: '/wellness',
  south: '/goals',
  west: '/roles',
};

const PANEL_CONFIG: Record<Direction, { label: string; body: string; hint: string }> = {
  north: {
    label: 'NORTH — YOUR NORTH STAR',
    body: 'Mission, Vision & Purpose',
    hint: 'Tap to open North Star →',
  },
  south: {
    label: 'SOUTH — THIS WEEK',
    body: 'Tasks and events for this week loading soon...',
    hint: 'Tap to open Goals →',
  },
  east: {
    label: 'EAST — WELLNESS',
    body: 'Your wellness zones',
    hint: 'Tap to open Wellness →',
  },
  west: {
    label: 'WEST — ROLES',
    body: 'Your roles overview',
    hint: 'Tap to open Roles →',
  },
};

export function CompassView({
  enablePanels = false,
  defaultZone = 'south',
  onDirectionChange,
}: CompassViewProps = {}) {
  const { colors } = useTheme();
  const router = useRouter();

  const [activeZone, setActiveZone] = useState<Direction | null>(
    enablePanels ? defaultZone : null,
  );
  const [compassSize, setCompassSize] = useState(enablePanels ? 240 : 300);

  const [userHasNavigated, setUserHasNavigated] = useState(false);

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

  const handleTaskEventFormClose = () => setIsTaskEventFormVisible(false);
  const handleTaskEventFormSuccess = () => setIsTaskEventFormVisible(false);
  const handleJournalFormClose = () => setIsJournalFormVisible(false);

  const handleZoneChange = (zone: 'mission' | 'wellness' | 'goals' | 'roles') => {
    if (!enablePanels) return;
    const dir = ZONE_TO_DIRECTION[zone];
    if (!userHasNavigated && dir === 'north') {
      return; // skip mount-fired event — keep South default
    }
    setUserHasNavigated(true);
    setActiveZone(dir);
    setCompassSize(240);
    onDirectionChange?.(dir);
  };

  const handlePanelPress = () => {
    if (!activeZone) return;
    router.push(DIRECTION_ROUTES[activeZone] as any);
  };

  const renderPanel = () => {
    if (!enablePanels || !activeZone) return null;
    if (activeZone === 'south') return null; // South handled by parent (dashboard)
    const config = PANEL_CONFIG[activeZone];
    const accent = DIRECTION_COLORS[activeZone];

    return (
      <TouchableOpacity
        style={[
          styles.panelCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={handlePanelPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.panelLabel, { color: accent }]}>{config.label}</Text>
        <Text style={[styles.panelBody, { color: colors.text }]}>{config.body}</Text>
        <Text style={[styles.panelHint, { color: colors.textSecondary }]}>{config.hint}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AspirationalQuote />
      <View style={styles.compassWrapper}>
        <LifeCompass
          size={compassSize}
          contextMode="dashboard"
          onTaskFormOpen={handleTaskFormOpen}
          onJournalFormOpen={handleJournalFormOpen}
          onZoneChange={handleZoneChange}
          suppressNavigation={enablePanels}
        />
      </View>

      {renderPanel()}

      <Modal
        visible={isTaskEventFormVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleTaskEventFormClose}
      >
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
          <TaskEventForm
            mode="create"
            preSelectedType={taskEventFormType}
            onSubmitSuccess={handleTaskEventFormSuccess}
            onClose={handleTaskEventFormClose}
          />
        </Suspense>
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
  panelCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 12,
    gap: 6,
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  panelBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  panelHint: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'right',
  },
});
