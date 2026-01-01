import { getSupabaseClient } from './supabase';

export type RitualType = 'morning_spark' | 'evening_review' | 'weekly_alignment';

export interface RitualSettings {
  id: string;
  user_id: string;
  ritual_type: RitualType;
  is_enabled: boolean;
  available_from: string;
  available_until: string;
  created_at: string;
  updated_at: string;
}

export async function getRitualSettings(
  userId: string,
  ritualType: RitualType
): Promise<RitualSettings | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('0008-ap-user-ritual-settings')
      .select('*')
      .eq('user_id', userId)
      .eq('ritual_type', ritualType)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching ritual settings for ${ritualType}:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Exception in getRitualSettings for ${ritualType}:`, error);
    return null;
  }
}

export function isWithinTimeWindow(from: string, until: string): boolean {
  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);

    if (from <= until) {
      return currentTime >= from && currentTime <= until;
    } else {
      return currentTime >= from || currentTime <= until;
    }
  } catch (error) {
    console.error('Error checking time window:', error);
    return true;
  }
}

export function isRitualAvailable(settings: RitualSettings | null): boolean {
  try {
    if (!settings) {
      return true;
    }

    if (!settings.is_enabled) {
      return false;
    }

    if (settings.ritual_type === 'weekly_alignment') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend) {
        return false;
      }
    }

    return isWithinTimeWindow(settings.available_from, settings.available_until);
  } catch (error) {
    console.error('Error checking ritual availability:', error);
    return true;
  }
}

export async function updateRitualSettings(
  userId: string,
  ritualType: RitualType,
  updates: Partial<Pick<RitualSettings, 'is_enabled' | 'available_from' | 'available_until'>>
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('0008-ap-user-ritual-settings')
      .upsert(
        {
          user_id: userId,
          ritual_type: ritualType,
          ...updates,
        },
        { onConflict: 'user_id,ritual_type' }
      );

    if (error) {
      console.error(`Error updating ritual settings for ${ritualType}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Exception in updateRitualSettings for ${ritualType}:`, error);
    return false;
  }
}

export async function hasCompletedRitualToday(
  userId: string,
  ritualType: RitualType
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    if (ritualType === 'morning_spark') {
      const { data, error } = await supabase
        .from('0008-ap-daily-sparks')
        .select('id')
        .eq('user_id', userId)
        .eq('spark_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking morning spark completion:', error);
        return false;
      }

      return data !== null;
    }

    if (ritualType === 'evening_review') {
      const { data, error } = await supabase
        .from('0008-ap-daily-reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('review_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking evening review completion:', error);
        return false;
      }

      return data !== null;
    }

    if (ritualType === 'weekly_alignment') {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const weekStartDate = startOfWeek.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('id')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (error) {
        console.error('Error checking weekly alignment completion:', error);
        return false;
      }

      return data !== null;
    }

    return false;
  } catch (error) {
    console.error(`Exception in hasCompletedRitualToday for ${ritualType}:`, error);
    return false;
  }
}

export function getDefaultRitualSettings(ritualType: RitualType): Pick<RitualSettings, 'available_from' | 'available_until' | 'is_enabled'> {
  switch (ritualType) {
    case 'morning_spark':
      return {
        is_enabled: true,
        available_from: '00:00:00',
        available_until: '12:00:00',
      };
    case 'evening_review':
      return {
        is_enabled: true,
        available_from: '17:00:00',
        available_until: '23:59:59',
      };
    case 'weekly_alignment':
      return {
        is_enabled: true,
        available_from: '00:00:00',
        available_until: '23:59:59',
      };
  }
}

export async function shouldShowRitual(
  userId: string,
  ritualType: RitualType
): Promise<boolean> {
  try {
    const settings = await getRitualSettings(userId, ritualType);

    const settingsToUse = settings || {
      ...getDefaultRitualSettings(ritualType),
      id: '',
      user_id: userId,
      ritual_type: ritualType,
      created_at: '',
      updated_at: '',
    };

    if (!isRitualAvailable(settingsToUse)) {
      return false;
    }

    const hasCompleted = await hasCompletedRitualToday(userId, ritualType);
    return !hasCompleted;
  } catch (error) {
    console.error(`Error in shouldShowRitual for ${ritualType}:`, error);
    return true;
  }
}
