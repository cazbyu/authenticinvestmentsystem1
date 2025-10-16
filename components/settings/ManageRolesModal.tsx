import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { X } from 'lucide-react-native';
import { ManageRolesContent } from './ManageRolesContent';

// Interfaces
interface ManageRolesModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ManageRolesModal({ visible, onClose, onUpdate }: ManageRolesModalProps) {
  const handleClose = () => {
    onClose();
    // Notify parent to refresh after modal closes
    if (onUpdate) {
      onUpdate();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Roles</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ManageRolesContent onUpdate={onUpdate} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'white'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  closeButton: {
    padding: 4
  },
});
