import React from 'react';
import { JournalView } from '@/components/journal/JournalView';

/**
 * ZoneJournalPanel — Minimalist Executive design system
 * Trivial wrapper around JournalView locked to all-time scope for the
 * MY SPACE > Journal tile. The parent CollapsiblePanel controls
 * expand/collapse; this panel only renders feed content when expanded.
 *
 * dateRange="all" matches fetchZoneJournalCount's all-time count badge.
 * showTimePeriodSelector={false} hides the per-period picker since the
 * tile badge represents the locked all-time count.
 */

export interface ZoneJournalPanelProps {
  domainId: string;
  zoneName: string;
  onEntryPress: (entry: any) => void;
}

export function ZoneJournalPanel({
  domainId,
  zoneName,
  onEntryPress,
}: ZoneJournalPanelProps) {
  return (
    <JournalView
      scope={{ type: 'domain', id: domainId, name: zoneName }}
      dateRange="all"
      showTimePeriodSelector={false}
      onEntryPress={onEntryPress}
    />
  );
}
