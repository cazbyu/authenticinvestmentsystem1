import React from 'react';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';

/**
 * ZoneAnalyticsToolshedPanel — Minimalist Executive design system
 * Trivial wrapper around AnalyticsView for the Toolshed Surfaces >
 * Analytics tile. Builds the domain-scoped scope object once and
 * forwards. Receives domainId + zoneName from wellness.tsx (passed
 * through ZoneToolshed).
 *
 * AnalyticsView owns its own loading / empty / error states; this
 * panel just renders it inside the CollapsiblePanel body.
 *
 * Until 1+6c removes the standalone Analytics tab from
 * wellness.tsx, the same analytics view renders in two places
 * (the tab + this panel). Both use the same scope shape, so they
 * cannot diverge.
 */

export interface ZoneAnalyticsToolshedPanelProps {
  domainId: string;
  zoneName: string;
}

export function ZoneAnalyticsToolshedPanel({
  domainId,
  zoneName,
}: ZoneAnalyticsToolshedPanelProps) {
  return (
    <AnalyticsView
      scope={{ type: 'domain', id: domainId, name: zoneName }}
    />
  );
}
