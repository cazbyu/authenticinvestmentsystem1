import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar, CheckSquare } from 'lucide-react-native';

interface Event {
  id: string;
  title: string;
  start_time?: string;
  points?: number;
}

interface Task {
  id: string;
  title: string;
  points?: number;
  priority?: string;
}

interface FinalCommitmentSectionProps {
  actionsData: {
    today: Event[];
    overdue: Event[];
  };
  fuelLevel: number | null;
  urgentTasks: Task[];
  allTasks: Task[];
  colors: any;
  formatTimeDisplay: (time: string) => string;
  getPriorityColor: (task: Task) => string;
  getCommittedItems: (items: any[]) => any[];
  commitReflection: boolean;
  commitRose: boolean;
  commitThorn: boolean;
  mindsetPoints: number;
}

export function FinalCommitmentSection({
  actionsData,
  fuelLevel,
  urgentTasks,
  allTasks,
  colors,
  formatTimeDisplay,
  getPriorityColor,
  getCommittedItems,
  commitReflection,
  commitRose,
  commitThorn,
  mindsetPoints,
}: FinalCommitmentSectionProps) {
  // Calculate committed tasks - EL1 and EL2
  const committedUrgent = (fuelLevel === 1 || fuelLevel === 2) ? getCommittedItems(urgentTasks) : [];
  const committedFromAll = (fuelLevel === 1 || fuelLevel === 2) ? getCommittedItems(allTasks) : [];
  const allCommittedTasks = [...committedUrgent];
  committedFromAll.forEach(task => {
    if (!allCommittedTasks.find(t => t.id === task.id)) {
      allCommittedTasks.push(task);
    }
  });

  // ✅ Calculate target score WITHOUT overdue events, ALWAYS including +10 for Evening Review
  const eventPoints = (actionsData?.today || []).reduce((sum, e) => sum + (e.points || 3), 0);
  const taskPoints = allCommittedTasks.reduce((sum, t) => sum + (t.points || 3), 0);
  const reflectionPoints = Math.min((commitReflection ? 1 : 0) + (commitRose ? 2 : 0) + (commitThorn ? 1 : 0), 10);
  const eveningReviewPoints = 10; // ✅ Always 10 points
  const completionBonus = 10;
  const targetScore = eventPoints + taskPoints + mindsetPoints + reflectionPoints + eveningReviewPoints + completionBonus;

  return (
    <View style={styles.section}>
      <Text style={[styles.commitmentHeader, { color: colors.text }]}>
        Final Commitment
      </Text>
      <Text style={[styles.commitmentSubtitle, { color: colors.textSecondary }]}>
        This is your contract with yourself today - you ready?
      </Text>

      {/* Combined Tasks + Events Table */}
      <View style={[styles.commitmentTable, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.commitmentTableTitle, { color: colors.text }]}>
          Today's Menu
        </Text>

        {/* ✅ Events Section - ONLY TODAY'S EVENTS */}
        {actionsData && actionsData.today.length > 0 && (
          <>
            <Text style={[styles.commitmentSectionLabel, { color: colors.textSecondary }]}>
              EVENTS ({actionsData.today.length})
            </Text>
            {actionsData.today.map((event) => (
              <View key={event.id} style={[styles.commitmentItem, { borderBottomColor: colors.border }]}>
                <Calendar size={16} color={colors.primary} />
                <Text style={[styles.commitmentItemTitle, { color: colors.text }]} numberOfLines={1}>
                  {event.title}
                  {event.start_time && (
                    <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                      {' '}({formatTimeDisplay(event.start_time)})
                    </Text>
                  )}
                </Text>
                <Text style={[styles.commitmentItemPoints, { color: '#10B981' }]}>
                  +{event.points || 3}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Tasks Section - EL1 and EL2 - Show COMMITTED tasks */}
        {(fuelLevel === 1 || fuelLevel === 2) && (
          <>
            <Text style={[styles.commitmentSectionLabel, { color: colors.textSecondary, marginTop: 12 }]}>
              TASKS ({allCommittedTasks.length})
            </Text>

            {allCommittedTasks.length === 0 ? (
              <View style={[styles.emptyTasksState, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.emptyTasksText, { color: colors.textSecondary }]}>
                  No tasks committed yet. {urgentTasks.length > 0 ? 'Click/tap tasks above to commit.' : ''}
                </Text>
              </View>
            ) : (
              <>
                {allCommittedTasks.map((task) => (
                  <View key={task.id} style={[styles.commitmentItem, { borderBottomColor: colors.border }]}>
                    <CheckSquare size={16} color={getPriorityColor(task)} />
                    <Text style={[styles.commitmentItemTitle, { color: colors.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.commitmentItemPoints, { color: '#10B981' }]}>
                      +{Math.round(task.points || 3)}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </View>

      {/* Scoring Note */}
      <View style={[styles.scoringNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.scoringNoteText, { color: colors.textSecondary }]}>
          Max 10 points from reflections (Reflection, Rose, Thorn combined)
        </Text>
      </View>

      {/* Final Target Display */}
      <View style={[styles.finalTargetCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
        <Text style={[styles.finalTargetLabel, { color: colors.textSecondary }]}>
          🎯 Your Target Score Today
        </Text>
        <Text style={[styles.finalTargetPoints, { color: colors.primary }]}>
          {targetScore} points
        </Text>
        <Text style={[styles.finalTargetBreakdown, { color: colors.textSecondary }]}>
          {(actionsData?.today.length || 0) + (actionsData?.overdue.length || 0)} events
          {allCommittedTasks.length > 0 ? ` + ${allCommittedTasks.length} tasks` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  commitmentHeader: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  commitmentSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  commitmentTable: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  commitmentTableTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  commitmentSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  commitmentItemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 13,
  },
  commitmentItemPoints: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyTasksState: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyTasksText: {
    fontSize: 14,
    textAlign: 'center',
  },
  scoringNote: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  scoringNoteText: {
    fontSize: 13,
    textAlign: 'center',
  },
  finalTargetCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  finalTargetLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  finalTargetPoints: {
    fontSize: 32,
    fontWeight: '700',
  },
  finalTargetBreakdown: {
    fontSize: 14,
  },
});