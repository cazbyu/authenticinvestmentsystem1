import React from 'react';
import { JournalView } from '@/components/journal/JournalView';

/**
 * KRJournalToolshedPanel — R-6-components-C sibling of components/roles/RoleJournalToolshedPanel.tsx.
 *
 * Wraps <JournalView> with key_relationship scope. JournalView is the
 * shared scope-aware view that already supports KR scoping (filters
 * tasks/reflections/withdrawals/deposit-ideas via 0008-ap-universal-
 * key-relationships-join when scope.type === 'key_relationship').
 *
 * Period selector enabled by default (matches role-side; deviates from
 * the wellness twin ZoneJournalPanel which locks to dateRange='all'
 * because its tile badge represents an all-time count). KR-side has no
 * such tile constraint, so the period selector is exposed.
 *
 * Date-range state is owned by R-6-mount (roles.tsx) and passed in.
 * Optional — defaults to JournalView's own default if not provided.
 *
 * userId and accentColor are part of the API contract for parity with
 * role-side but not consumed here (JournalView fetches by scope.id and
 * uses its own theming). Underscore-prefixed to silence the unused-param
 * lint while preserving the documented contract.
 *
 * krName is bridged null → undefined for JournalScope (which expects
 * `name?: string`, not `string | null`). Mirrors the same bridge pattern
 * roles.tsx uses post-R-6-schema's TS interface widening.
 */

export interface KRJournalToolshedPanelProps {
  krId: string;
  userId: string;
  krName: string | null;
  accentColor: string;
  onEntryPress: (entry: any) => void;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  onDateRangeChange?: (dateRange: 'today' | 'week' | 'month' | 'all') => void;
}

export function KRJournalToolshedPanel({
  krId,
  userId: _userId,
  krName,
  accentColor: _accentColor,
  onEntryPress,
  dateRange,
  onDateRangeChange,
}: KRJournalToolshedPanelProps) {
  return (
    <JournalView
      scope={{ type: 'key_relationship', id: krId, name: krName ?? undefined }}
      onEntryPress={onEntryPress}
      dateRange={dateRange}
      showTimePeriodSelector={true}
      onDateRangeChange={onDateRangeChange}
    />
  );
}
