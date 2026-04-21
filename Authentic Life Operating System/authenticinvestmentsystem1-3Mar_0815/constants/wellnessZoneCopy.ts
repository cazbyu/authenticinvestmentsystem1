/**
 * wellnessZoneCopy — Minimalist Executive design system
 * Static tagline per wellness zone, surfaced on the Wellness Hub
 * ZoneCards. Keyed by the domain's `name` column value in
 * `0008-ap-domains`.
 */

export interface WellnessZoneCopy {
  tagline: string;
}

export const WELLNESS_ZONE_COPY: Record<string, WellnessZoneCopy> = {
  Physical:     { tagline: 'Sleep, movement, energy' },
  Emotional:    { tagline: 'Resilience & regulation' },
  Spiritual:    { tagline: 'Practice & reflection' },
  Intellectual: { tagline: 'Learning & curiosity' },
  Social:       { tagline: 'Relationships & connection' },
  Financial:    { tagline: 'Stewardship & planning' },
  Recreational: { tagline: 'Leisure & play' },
  Community:    { tagline: 'Service & belonging' },
};

export function getZoneTagline(name: string): string {
  return WELLNESS_ZONE_COPY[name]?.tagline ?? '';
}
