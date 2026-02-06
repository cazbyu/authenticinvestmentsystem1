import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { UserCheck, ChevronDown, ChevronUp, Check, UserPlus } from 'lucide-react-native';
import DelegateModal from '@/components/tasks/DelegateModal';
import { getSupabaseClient } from '@/lib/supabase';

export interface DelegateContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface DelegateTask {
  id: string;
  title: string;
  due_date?: string;
}

interface TacticalDelegateCardProps {
  tasks: DelegateTask[];
  delegates: DelegateContact[];
  userId: string;
  colors: any;
  onDelegateTask: (taskId: string, delegateName: string, delegateEmail?: string) => Promise<void>;
  delegatedMap: Map<string, { delegateId: string; delegateName: string }>;
  onDelegatesRefresh: () => void;
}

const BLUE = '#3B82F6';
const BLUE_LIGHT = '#3B82F610';
const BLUE_BORDER = '#3B82F640';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TacticalDelegateCard({
  tasks,
  delegates,
  userId,
  colors,
  onDelegateTask,
  delegatedMap,
  onDelegatesRefresh,
}: TacticalDelegateCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [selectingTaskId, setSelectingTaskId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const undelegated = tasks.filter((t) => !delegatedMap.has(t.id));
  const delegated = tasks.filter((t) => delegatedMap.has(t.id));

  async function handlePickDelegate(delegate: DelegateContact) {
    if (!selectingTaskId || assigning) return;
    setAssigning(true);
    try {
      await onDelegateTask(selectingTaskId, delegate.name, delegate.email || undefined);
      setSelectingTaskId(null);
    } finally {
      setAssigning(false);
    }
  }

  async function handleModalSave(delegateId: string) {
    setShowModal(false);
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('0008-ap-delegates')
      .select('name, email')
      .eq('id', delegateId)
      .maybeSingle();

    if (data && selectingTaskId) {
      setAssigning(true);
      try {
        await onDelegateTask(selectingTaskId, data.name, data.email || undefined);
        setSelectingTaskId(null);
      } finally {
        setAssigning(false);
      }
    }
    onDelegatesRefresh();
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: BLUE_BORDER }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <UserCheck size={20} color={BLUE} />
        <Text style={[styles.title, { color: colors.text, flex: 1 }]}>Delegate Tasks</Text>
        {delegated.length > 0 && (
          <View style={[styles.badge, { backgroundColor: BLUE }]}>
            <Text style={styles.badgeText}>{delegated.length}</Text>
          </View>
        )}
        {expanded ? (
          <ChevronUp size={20} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {tasks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks available to delegate
            </Text>
          ) : (
            <>
              <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                Select a task to assign to someone else
              </Text>

              {undelegated.map((task) => (
                <View key={task.id}>
                  <TouchableOpacity
                    style={[
                      styles.taskRow,
                      {
                        backgroundColor:
                          selectingTaskId === task.id ? BLUE_LIGHT : 'transparent',
                        borderColor: selectingTaskId === task.id ? BLUE : colors.border,
                      },
                    ]}
                    onPress={() =>
                      setSelectingTaskId(selectingTaskId === task.id ? null : task.id)
                    }
                    disabled={assigning}
                  >
                    <View
                      style={[
                        styles.selectCircle,
                        {
                          borderColor: selectingTaskId === task.id ? BLUE : colors.border,
                        },
                      ]}
                    >
                      {selectingTaskId === task.id && <Check size={14} color={BLUE} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      {task.due_date && (
                        <Text style={[styles.taskDate, { color: colors.textSecondary }]}>
                          {formatDate(task.due_date)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {selectingTaskId === task.id && (
                    <View
                      style={[
                        styles.picker,
                        { backgroundColor: BLUE_LIGHT, borderColor: BLUE_BORDER },
                      ]}
                    >
                      <Text style={[styles.pickerLabel, { color: BLUE }]}>Choose a delegate:</Text>
                      <View style={styles.chipList}>
                        {delegates.map((d) => (
                          <TouchableOpacity
                            key={d.id}
                            style={[
                              styles.delegateChip,
                              { borderColor: BLUE_BORDER, backgroundColor: colors.surface },
                            ]}
                            onPress={() => handlePickDelegate(d)}
                            disabled={assigning}
                          >
                            <Text style={[styles.chipText, { color: colors.text }]}>{d.name}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[styles.addChip, { borderColor: BLUE }]}
                          onPress={() => setShowModal(true)}
                          disabled={assigning}
                        >
                          <UserPlus size={12} color={BLUE} />
                          <Text style={[styles.addChipText, { color: BLUE }]}>Add New</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {delegated.length > 0 && (
                <View style={styles.delegatedSection}>
                  <Text style={[styles.delegatedLabel, { color: colors.textSecondary }]}>
                    Delegated
                  </Text>
                  {delegated.map((task) => {
                    const info = delegatedMap.get(task.id);
                    return (
                      <View
                        key={task.id}
                        style={[
                          styles.delegatedRow,
                          { backgroundColor: '#10B98108', borderColor: '#10B98140' },
                        ]}
                      >
                        <Check size={16} color="#10B981" />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.taskTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {task.title}
                          </Text>
                          <Text style={[styles.taskDate, { color: '#10B981' }]}>
                            Delegated to {info?.delegateName}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      )}

      <DelegateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleModalSave}
        existingDelegates={delegates}
        userId={userId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    marginTop: 12,
  },
  instruction: {
    fontSize: 13,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    gap: 10,
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  taskDate: {
    fontSize: 12,
    marginTop: 2,
  },
  picker: {
    marginLeft: 32,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  delegateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  addChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  delegatedSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#10B98130',
    paddingTop: 10,
  },
  delegatedLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  delegatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    gap: 10,
  },
});
