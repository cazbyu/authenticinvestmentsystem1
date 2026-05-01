import React from 'react';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';

/**
 * RoleAnalyticsToolshedPanel — R-4 sibling of ZoneAnalyticsToolshedPanel.
 *
 * Wraps <AnalyticsView> with role scope. Same view that powered the
 * old 4-tab Analytics tab on roles.tsx, surfaced in the new Toolshed
 * structural slot.
 *
 * AnalyticsView owns its own loading / empty / error states; this
 * panel just renders it inside the parent CollapsiblePanel body.
 */

export interface RoleAnalyticsToolshedPanelProps {
  roleId: string;
  userId: string;
  roleName: string;
  accentColor: string;
}

export function RoleAnalyticsToolshedPanel({
  roleId,
  userId: _userId,
  roleName,
  accentColor: _accentColor,
}: RoleAnalyticsToolshedPanelProps) {
  return (
    <AnalyticsView
      scope={{ type: 'role', id: roleId, name: roleName }}
    />
  );
}
