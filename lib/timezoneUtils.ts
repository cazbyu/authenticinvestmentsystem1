import { supabase } from './supabase';

export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect timezone, defaulting to UTC:', error);
    return 'UTC';
  }
}

export async function updateUserTimezone(userId: string, timezone: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('0008-ap-users')
      .update({ timezone })
      .eq('id', userId);

    if (error) {
      console.error('Failed to update user timezone:', error);
    }
  } catch (error) {
    console.error('Error updating timezone:', error);
  }
}

export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-users')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch user timezone:', error);
      return 'UTC';
    }

    return data?.timezone || 'UTC';
  } catch (error) {
    console.error('Error fetching timezone:', error);
    return 'UTC';
  }
}

export async function syncUserTimezone(userId: string): Promise<void> {
  const detectedTimezone = detectUserTimezone();
  const storedTimezone = await getUserTimezone(userId);

  if (detectedTimezone !== storedTimezone) {
    await updateUserTimezone(userId, detectedTimezone);
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getTimezonesByRegion(): Record<string, string[]> {
  return {
    'North America': [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
    ],
    'Europe': [
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Amsterdam',
      'Europe/Brussels',
      'Europe/Vienna',
      'Europe/Stockholm',
      'Europe/Zurich',
    ],
    'Asia': [
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Asia/Singapore',
      'Asia/Bangkok',
      'Asia/Jakarta',
      'Asia/Manila',
    ],
    'Australia & Pacific': [
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Perth',
      'Pacific/Auckland',
      'Pacific/Fiji',
    ],
    'South America': [
      'America/Sao_Paulo',
      'America/Buenos_Aires',
      'America/Santiago',
      'America/Bogota',
      'America/Lima',
    ],
    'Africa': [
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi',
      'Africa/Casablanca',
    ],
  };
}

export function getTimezoneDisplayName(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const timezonePart = parts.find(part => part.type === 'timeZoneName');
    return timezonePart ? `${timezone} (${timezonePart.value})` : timezone;
  } catch {
    return timezone;
  }
}
