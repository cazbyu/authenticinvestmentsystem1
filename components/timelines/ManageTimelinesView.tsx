import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArchivedTimelinesView } from '@/components/settings/ArchivedTimelinesView';
import { ManageCustomTimelinesContent } from './ManageCustomTimelinesContent';
import { ManageGlobalTimelinesModal } from './ManageGlobalTimelinesModal';

export type ManageTimelinesSubTab = 'custom' | 'global' | 'archive';

interface ManageTimelinesViewProps {
  onUpdate?: () => void;
}

export function ManageTimelinesView({ onUpdate }: ManageTimelinesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<ManageTimelinesSubTab>('global');
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUpdate = () => {
    console.log('[ManageTimelinesView] handleUpdate called, triggering parent update');
    setRefreshTrigger(prev => prev + 1);
    onUpdate?.();
  };

  const renderSubTabButtons = () => (
    <View style={styles.subTabsContainer}>
      <TouchableOpacity
        style={[
          styles.subTab,
          activeSubTab === 'custom' && styles.activeSubTab,
        ]}
        onPress={() => setActiveSubTab('custom')}
        accessibilityLabel="Manage Custom Timelines"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeSubTab === 'custom' }}
      >
        <Text
          style={[
            styles.subTabText,
            activeSubTab === 'custom' && styles.activeSubTabText,
          ]}
        >
          Custom Timelines
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.subTab,
          activeSubTab === 'global' && styles.activeSubTab,
        ]}
        onPress={() => setActiveSubTab('global')}
        accessibilityLabel="Manage Standardized 12 Week Timelines"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeSubTab === 'global' }}
      >
        <Text
          style={[
            styles.subTabText,
            activeSubTab === 'global' && styles.activeSubTabText,
          ]}
        >
          12 Week Timelines
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.subTab,
          activeSubTab === 'archive' && styles.activeSubTab,
        ]}
        onPress={() => setActiveSubTab('archive')}
        accessibilityLabel="View Timeline Archive"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeSubTab === 'archive' }}
      >
        <Text
          style={[
            styles.subTabText,
            activeSubTab === 'archive' && styles.activeSubTabText,
          ]}
        >
          Archive
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (activeSubTab === 'custom') {
      return <ManageCustomTimelinesContent onUpdate={handleUpdate} />;
    }
    if (activeSubTab === 'archive') {
      return <ArchivedTimelinesView onUpdate={handleUpdate} />;
    }
    if (activeSubTab === 'global') {
      return (
        <View style={styles.globalContainer}>
          <View style={styles.globalHeader}>
            <Text style={styles.globalTitle}>Standardized 12 Week Timelines</Text>
            <Text style={styles.globalSubtitle}>
              Manage your global 12-week cycles and timelines
            </Text>
          </View>
          <TouchableOpacity
            style={styles.openModalButton}
            onPress={() => setShowGlobalModal(true)}
          >
            <Text style={styles.openModalButtonText}>Open Timeline Manager</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {renderSubTabButtons()}
      <View style={styles.content}>
        {renderContent()}
      </View>

      <ManageGlobalTimelinesModal
        visible={showGlobalModal}
        onClose={() => setShowGlobalModal(false)}
        onUpdate={handleUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  subTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeSubTab: {
    borderBottomColor: '#0078d4',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  activeSubTabText: {
    color: '#0078d4',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  globalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
  },
  globalHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  globalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  globalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  openModalButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  openModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
