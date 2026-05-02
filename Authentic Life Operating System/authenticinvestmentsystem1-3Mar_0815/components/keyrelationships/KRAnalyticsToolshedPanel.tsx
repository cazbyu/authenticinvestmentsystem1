import React from 'react';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';

/**
 * KRAnalyticsToolshedPanel — R-6-components-C sibling of components/roles/RoleAnalyticsToolshedPanel.tsx.
 *
 * Wraps <AnalyticsView> with key_relationship scope. AnalyticsView is the
 * shared scope-aware view that already supports KR scoping (filters
 * tasks/withdrawals via 0008-ap-universal-key-relationships-join when
 * scope.type === 'key_relationship'; verified at lines 150 + 217).
 *
 * AnalyticsView owns its own loading / empty / error states; this panel
 * just renders it inside the parent CollapsiblePanel body.
 *
 * userId and accentColor are part of the API contract for parity with
 * role-side but not consumed here (AnalyticsView fetches by scope.id and
 * uses its own theming). Underscore-prefixed to silence unused-param
 * lint while preserving the documented contract.
 *
 * krName is bridged null → undefined for AnalyticsScope (which expects
 * `name?: string`). Mirrors the same bridge pattern KRJournalToolshedPanel
 * uses + the pattern roles.tsx uses post-R-6-schema's TS interface widening.
 */

export interface KRAnalyticsToolshedPanelProps {
  krId: string;
  userId: string;
  krName: string | null;
  accentColor: string;
}

export function KRAnalyticsToolshedPanel({
  krId,
  userId: _userId,
  krName,
  accentColor: _accentColor,
}: KRAnalyticsToolshedPanelProps) {
  return (
    <AnalyticsView
      scope={{ type: 'key_relationship', id: krId, name: krName ?? undefined }}
    />
  );
}
