import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface BrainDumpNote {
  id: string;
  content: string;
}

interface BrainDumpSectionProps {
  brainDumpNotes: BrainDumpNote[];
  colors: any;
  loadingBrainDump: boolean;
  handleDeferNote: (noteId: string) => void;
  handleFollowUpNote: (noteId: string) => void;
}

export function BrainDumpSection({
  brainDumpNotes,
  colors,
  loadingBrainDump,
  handleDeferNote,
  handleFollowUpNote,
}: BrainDumpSectionProps) {
  const [showBrainDump, setShowBrainDump] = useState(false);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (!showBrainDump && brainDumpNotes.length > 0) {
            setShowBrainDump(true);
          } else {
            setShowBrainDump(!showBrainDump);
          }
        }}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
            💭 Brain Dump
          </Text>
          <Text style={[styles.collapsibleCount, { color: colors.textSecondary }]}>
            {brainDumpNotes.length === 0 ? '- none created yesterday' : '- ready for review'}
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showBrainDump ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showBrainDump && brainDumpNotes.length > 0 && (
        <>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
            You created some notes for yourself yesterday. Would you like to defer them so they don't weigh on you?
          </Text>

          {loadingBrainDump ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.brainDumpContainer, { backgroundColor: colors.surface }]}>
              {brainDumpNotes.map((note) => (
                <View
                  key={note.id}
                  style={[styles.brainDumpNote, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.brainDumpContent, { color: colors.text }]} numberOfLines={3}>
                    {note.content}
                  </Text>
                  <View style={styles.brainDumpActions}>
                    <TouchableOpacity
                      style={[styles.brainDumpButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handleDeferNote(note.id)}
                    >
                      <Text style={[styles.brainDumpButtonText, { color: colors.text }]}>
                        Defer to Log
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.brainDumpButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleFollowUpNote(note.id)}
                    >
                      <Text style={[styles.brainDumpButtonText, { color: '#FFFFFF' }]}>
                        Follow Up Tomorrow
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsibleCount: {
    fontSize: 14,
    fontWeight: '400',
  },
  collapsibleIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  brainDumpContainer: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  brainDumpNote: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  brainDumpContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  brainDumpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  brainDumpButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  brainDumpButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});