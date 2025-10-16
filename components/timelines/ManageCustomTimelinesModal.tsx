import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { X } from 'lucide-react-native';
import { ManageCustomTimelinesContent } from './ManageCustomTimelinesContent';

interface ManageCustomTimelinesModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ManageCustomTimelinesModal({ visible, onClose, onUpdate }: ManageCustomTimelinesModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Manage Custom Timelines</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ManageCustomTimelinesContent onUpdate={onUpdate} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
});