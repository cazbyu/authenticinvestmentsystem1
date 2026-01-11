import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Plus, Edit2, Trash2 } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

interface Aspiration {
  id: string;
  aspiration_date: string;
  aspiration_text: string;
  created_at: string;
  updated_at: string;
}

export function AspirationsLibrary() {
  const { colors } = useTheme();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAspirationText, setNewAspirationText] = useState('');
  const [newAspirationDate, setNewAspirationDate] = useState('');

  useEffect(() => {
    fetchAspirations();
  }, []);

  const fetchAspirations = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-aspirations-library')
        .select('*')
        .eq('user_id', user.id)
        .order('aspiration_date', { ascending: false });

      if (error) {
        console.error('Error fetching aspirations:', error);
        return;
      }

      setAspirations(data || []);
    } catch (error) {
      console.error('Error in fetchAspirations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAspiration = async () => {
    if (!newAspirationText.trim()) {
      Alert.alert('Error', 'Please enter aspiration text');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const aspirationDate = newAspirationDate || new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('0008-ap-aspirations-library')
        .insert({
          user_id: user.id,
          aspiration_date: aspirationDate,
          aspiration_text: newAspirationText.trim(),
        });

      if (error) {
        console.error('Error adding aspiration:', error);
        Alert.alert('Error', 'Failed to add aspiration');
        return;
      }

      setNewAspirationText('');
      setNewAspirationDate('');
      setIsAddingNew(false);
      fetchAspirations();
    } catch (error) {
      console.error('Error in handleAddAspiration:', error);
      Alert.alert('Error', 'An error occurred');
    }
  };

  const handleDeleteAspiration = async (id: string) => {
    Alert.alert(
      'Delete Aspiration',
      'Are you sure you want to delete this aspiration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { error } = await supabase
                .from('0008-ap-aspirations-library')
                .delete()
                .eq('id', id);

              if (error) {
                console.error('Error deleting aspiration:', error);
                Alert.alert('Error', 'Failed to delete aspiration');
                return;
              }

              fetchAspirations();
            } catch (error) {
              console.error('Error in handleDeleteAspiration:', error);
              Alert.alert('Error', 'An error occurred');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderAspiration = ({ item }: { item: Aspiration }) => (
    <View style={[styles.aspirationRow, { borderBottomColor: colors.border }]}>
      <View style={styles.dateColumn}>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {formatDate(item.aspiration_date)}
        </Text>
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.aspirationText, { color: colors.text }]}>
          {item.aspiration_text}
        </Text>
      </View>
      <View style={styles.actionsColumn}>
        <TouchableOpacity
          onPress={() => handleDeleteAspiration(item.id)}
          style={styles.actionButton}
        >
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Aspirations Library
        </Text>
        <TouchableOpacity
          onPress={() => setIsAddingNew(true)}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Plus size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {isAddingNew && (
        <View style={[styles.addForm, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter aspiration date (YYYY-MM-DD) or leave blank for today"
            placeholderTextColor={colors.textSecondary}
            value={newAspirationDate}
            onChangeText={setNewAspirationDate}
          />
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter your aspiration..."
            placeholderTextColor={colors.textSecondary}
            value={newAspirationText}
            onChangeText={setNewAspirationText}
            multiline
            numberOfLines={3}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => {
                setIsAddingNew(false);
                setNewAspirationText('');
                setNewAspirationDate('');
              }}
              style={[styles.cancelButton, { backgroundColor: colors.border }]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAddAspiration}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.buttonText, { color: '#ffffff' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerCell, styles.dateHeader, { color: colors.textSecondary }]}>Date</Text>
        <Text style={[styles.headerCell, styles.textHeader, { color: colors.textSecondary }]}>Aspiration</Text>
        <Text style={[styles.headerCell, styles.actionsHeader, { color: colors.textSecondary }]}>Actions</Text>
      </View>

      {aspirations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No aspirations yet. Add your first aspiration above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={aspirations}
          renderItem={renderAspiration}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addForm: {
    padding: 16,
    borderBottomWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateHeader: {
    width: 100,
  },
  textHeader: {
    flex: 1,
  },
  actionsHeader: {
    width: 60,
    textAlign: 'center',
  },
  aspirationRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  dateColumn: {
    width: 100,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textColumn: {
    flex: 1,
    paddingRight: 12,
  },
  aspirationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsColumn: {
    width: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
