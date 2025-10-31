import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface DelegateModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (delegateId: string) => void;
  existingDelegates: Delegate[];
  userId: string;
}

interface Delegate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export default function DelegateModal({
  visible,
  onClose,
  onSave,
  existingDelegates,
  userId,
}: DelegateModalProps) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDelegateId, setSelectedDelegateId] = useState<string | null>(null);

  const handleSave = async () => {
    if (selectedDelegateId) {
      onSave(selectedDelegateId);
      handleClose();
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('0008-ap-delegates')
        .insert({
          user_id: userId,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      onSave(data.id);
      handleClose();
    } catch (err) {
      console.error('Error creating delegate:', err);
      setError('Failed to create delegate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setError('');
    setSelectedDelegateId(null);
    onClose();
  };

  const handleSelectExisting = (delegateId: string) => {
    setSelectedDelegateId(delegateId);
    setName('');
    setEmail('');
    setPhone('');
    setError('');
  };

  const handleCreateNew = () => {
    setSelectedDelegateId(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delegate To</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {existingDelegates.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  Existing Delegates
                </Text>
                {existingDelegates.map((delegate) => (
                  <TouchableOpacity
                    key={delegate.id}
                    style={[
                      styles.delegateOption,
                      {
                        backgroundColor:
                          selectedDelegateId === delegate.id ? theme.primary + '20' : theme.background,
                        borderColor:
                          selectedDelegateId === delegate.id ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => handleSelectExisting(delegate.id)}
                  >
                    <Text style={[styles.delegateName, { color: theme.text }]}>
                      {delegate.name}
                    </Text>
                    {delegate.email && (
                      <Text style={[styles.delegateDetail, { color: theme.textSecondary }]}>
                        {delegate.email}
                      </Text>
                    )}
                    {delegate.phone && (
                      <Text style={[styles.delegateDetail, { color: theme.textSecondary }]}>
                        {delegate.phone}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!selectedDelegateId && (
              <>
                {existingDelegates.length > 0 && (
                  <Text style={[styles.orText, { color: theme.textSecondary }]}>
                    Or create new delegate
                  </Text>
                )}

                <View style={styles.section}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      setError('');
                    }}
                    placeholder="Enter name"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email (optional)"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={[styles.label, { color: theme.text }]}>Phone</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter phone (optional)"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          <View style={styles.buttonContainer}>
            {selectedDelegateId && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={handleCreateNew}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Create New Instead
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary },
                loading && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {selectedDelegateId ? 'Select' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  delegateOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  delegateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  delegateDetail: {
    fontSize: 14,
    marginTop: 2,
  },
  orText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 12,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
