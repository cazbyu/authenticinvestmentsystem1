import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { NoteCard } from './NoteCard';

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface YesterdaysNotesProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onTaskCreated?: (task: any) => void;
  onEventCreated?: (event: any) => void;
  onDepositIdeaCreated?: (idea: any) => void;
}

export function YesterdaysNotes({
  fuelLevel,
  userId,
  onTaskCreated,
  onEventCreated,
  onDepositIdeaCreated,
}: YesterdaysNotesProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [deferred, setDeferred] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [userId]);

  useEffect(() => {
    if (fuelLevel !== 1) {
      setExpanded(true);
    }
  }, [fuelLevel]);

  async function loadNotes() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-reflections')
        .select('id, content, created_at')
        .eq('user_id', userId)
        .eq('reflection_type', 'brain_dump')
        .eq('archived', false)
        .gte('created_at', `${yesterdayDate}T00:00:00`)
        .lt('created_at', `${yesterdayDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
      Alert.alert('Error', 'Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToTask(noteId: string, content: string) {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const { data: task, error: insertError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          type: 'task',
          title: content.substring(0, 200),
          description: content.length > 200 ? content : null,
          due_date: today,
          status: 'pending',
          priority: 'medium',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', noteId);

      if (deleteError) throw deleteError;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));

      if (onTaskCreated && task) {
        onTaskCreated(task);
      }

      Alert.alert('Success', 'Note converted to task!');
    } catch (error) {
      console.error('Error converting to task:', error);
      Alert.alert('Error', 'Failed to convert note. Please try again.');
      throw error;
    }
  }

  async function handleConvertToDepositIdea(noteId: string, content: string) {
    try {
      const supabase = getSupabaseClient();

      const { data: idea, error: insertError } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({
          user_id: userId,
          title: content.substring(0, 200),
          description: content.length > 200 ? content : null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', noteId);

      if (deleteError) throw deleteError;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));

      if (onDepositIdeaCreated && idea) {
        onDepositIdeaCreated(idea);
      }

      Alert.alert('Success', 'Note converted to deposit idea!');
    } catch (error) {
      console.error('Error converting to deposit idea:', error);
      Alert.alert('Error', 'Failed to convert note. Please try again.');
      throw error;
    }
  }

  async function handleConvertToEvent(
    noteId: string,
    content: string,
    startTime: string
  ) {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const [hours, minutes] = startTime.split(':');
      const startDate = new Date();
      startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const { data: event, error: insertError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: userId,
          type: 'event',
          title: content.substring(0, 200),
          description: content.length > 200 ? content : null,
          start_date: today,
          start_time: startTime,
          end_time: endTime,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', noteId);

      if (deleteError) throw deleteError;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));

      if (onEventCreated && event) {
        onEventCreated(event);
      }

      Alert.alert('Success', 'Note converted to event!');
    } catch (error) {
      console.error('Error converting to event:', error);
      Alert.alert('Error', 'Failed to convert note. Please try again.');
      throw error;
    }
  }

  async function handleLog(noteId: string) {
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));

      Alert.alert('Logged', 'Note has been acknowledged and removed.');
    } catch (error) {
      console.error('Error logging note:', error);
      Alert.alert('Error', 'Failed to log note. Please try again.');
      throw error;
    }
  }

  function handleDeferNotes() {
    setDeferred(true);
    Alert.alert(
      'Notes Deferred',
      "Your notes will remain and appear in this week's alignment.",
      [{ text: 'OK' }]
    );
  }

  function getHeaderText(): string {
    if (fuelLevel === 1) {
      return "You created some notes for yourself yesterday. Would you like to defer them so they don't weigh on you?";
    }
    return 'You left these notes for yourself. Turn them into action, or file them away.';
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <FileText size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No notes from yesterday. You're all clear!
          </Text>
        </View>
      </View>
    );
  }

  if (fuelLevel === 1 && !expanded && !deferred) {
    return (
      <View style={styles.container}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          {getHeaderText()}
        </Text>

        <View style={styles.deferButtons}>
          <TouchableOpacity
            style={[styles.deferButton, { backgroundColor: colors.primary }]}
            onPress={handleDeferNotes}
          >
            <Text style={styles.deferButtonText}>Yes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.deferButton,
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={() => setExpanded(true)}
          >
            <Text style={[styles.deferButtonTextSecondary, { color: colors.text }]}>
              No
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded(true)}
        >
          <Text style={[styles.noteCount, { color: colors.textSecondary }]}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} from yesterday
          </Text>
          <ChevronDown size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  if (deferred) {
    return (
      <View style={styles.container}>
        <View style={styles.deferredContainer}>
          <FileText size={32} color={colors.primary} />
          <Text style={[styles.deferredText, { color: colors.text }]}>
            Notes deferred to Weekly Alignment
          </Text>
          <Text style={[styles.deferredSubtext, { color: colors.textSecondary }]}>
            You can review them during your weekly reflection
          </Text>

          <TouchableOpacity
            style={styles.undoDeferButton}
            onPress={() => {
              setDeferred(false);
              setExpanded(true);
            }}
          >
            <Text style={[styles.undoDeferButtonText, { color: colors.primary }]}>
              Review Now Instead
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          {getHeaderText()}
        </Text>

        {fuelLevel === 1 && (
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => setExpanded(false)}
          >
            <ChevronUp size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.notesList}>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onConvertToTask={handleConvertToTask}
            onConvertToDepositIdea={handleConvertToDepositIdea}
            onConvertToEvent={handleConvertToEvent}
            onLog={handleLog}
          />
        ))}
      </View>

      {notes.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} remaining
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  collapseButton: {
    padding: 4,
    marginLeft: 12,
  },
  deferButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  deferButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deferButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deferButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  noteCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  deferredContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  deferredText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deferredSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  undoDeferButton: {
    padding: 12,
  },
  undoDeferButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesList: {
    marginBottom: 16,
  },
  summaryCard: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
