import React from 'react';
import { JournalView } from '@/components/journal/JournalView';

/**
 * RoleJournalToolshedPanel — R-4 sibling-style panel for the role-side
 * Toolshed > Journal surface.
 *
 * Wraps <JournalView> with role scope. Preserves the existing role-tab
 * Journal UX (period selector enabled, default 'week') — this is the
 * same view that powered the old 4-tab Journal on roles.tsx, surfaced
 * in the new Toolshed structural slot.
 *
 * Deviation from wellness twin (ZoneJournalPanel): wellness locks
 * dateRange="all" + showTimePeriodSelector={false} because its tile
 * badge represents an all-time count. Role-side has no such tile
 * constraint, so the period selector is exposed for parity with the
 * old 4-tab tab.
 *
 * Date-range state is owned by R-5 (roles.tsx) and passed in. Optional
 * — defaults to JournalView's own default if not provided.
 */

export interface RoleJournalToolshedPanelProps {
  roleId: string;
  userId: string;
  roleName: string;
  accentColor: string;
  onEntryPress: (entry: any) => void;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  onDateRangeChange?: (dateRange: 'today' | 'week' | 'month' | 'all') => void;
}

export function RoleJournalToolshedPanel({
  roleId,
  userId: _userId,
  roleName,
  accentColor: _accentColor,
  onEntryPress,
  dateRange,
  onDateRangeChange,
}: RoleJournalToolshedPanelProps) {
  return (
    <JournalView
      scope={{ type: 'role', id: roleId, name: roleName }}
      onEntryPress={onEntryPress}
      dateRange={dateRange}
      showTimePeriodSelector={true}
      onDateRangeChange={onDateRangeChange}
    />
  );
}
