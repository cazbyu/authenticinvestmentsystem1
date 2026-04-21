/**
 * wellnessColors — Minimalist Executive design system
 * Accent color per wellness zone, keyed by the domain's `name`
 * column in `0008-ap-domains`. Shared between app/(tabs)/wellness.tsx
 * and components/wellness/WellnessHubPage.tsx.
 */

export const WELLNESS_DOMAIN_COLORS: Record<string, string> = {
  Community:    '#7c3aed',
  Financial:    '#059669',
  Physical:     '#16a34a',
  Social:       '#0078d4',
  Emotional:    '#dc2626',
  Intellectual: '#0891b2',
  Recreational: '#ea580c',
  Spiritual:    '#7c3aed',
};

export function getDomainColor(domainName: string): string {
  return WELLNESS_DOMAIN_COLORS[domainName] ?? '#6b7280';
}
