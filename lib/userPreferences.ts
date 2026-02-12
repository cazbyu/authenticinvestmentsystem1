import { getSupabaseClient } from './supabase';

export interface UserPreferences {
  id: string;
  user_id: string;
  week_start_day: 'sunday' | 'monday';
  weekly_alignment_day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  timezone: string;
  reminder_settings: {
    morning_spark: {
      enabled: boolean;
      time: string;
      delivery: ('email' | 'in_app' | 'push')[];
    };
    evening_review: {
      enabled: boolean;
      time: string;
      delivery: ('email' | 'in_app' | 'push')[];
    };
    weekly_alignment: {
      enabled: boolean;
      day: string;
      time: string;
      delivery: ('email' | 'in_app' | 'push')[];
    };
    task_followup: {
      enabled: boolean;
      delivery: ('email' | 'in_app' | 'push')[];
    };
  };
  theme: 'light' | 'dark' | 'auto';
  accent_color: string;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
  share_sparks_with_coach: boolean;
  share_reviews_with_coach: boolean;
  share_reflections_with_coach: boolean;
  alignment_guide_enabled: boolean;
  coaching_chat_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('0008-ap-user-preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user preferences:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception in getUserPreferences:', error);
    return null;
  }
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('0008-ap-user-preferences')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user preferences:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception in updateUserPreferences:', error);
    return false;
  }
}

export async function updateReminderSettings(
  userId: string,
  ritualType: 'morning_spark' | 'evening_review' | 'weekly_alignment' | 'task_followup',
  settings: any
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { data: prefs } = await supabase
      .from('0008-ap-user-preferences')
      .select('reminder_settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (!prefs) return false;

    const updatedSettings = {
      ...prefs.reminder_settings,
      [ritualType]: {
        ...prefs.reminder_settings[ritualType],
        ...settings
      }
    };

    const { error } = await supabase
      .from('0008-ap-user-preferences')
      .update({ reminder_settings: updatedSettings })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating reminder settings:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception in updateReminderSettings:', error);
    return false;
  }
}

export function getDefaultUserPreferences(userId: string): Partial<UserPreferences> {
  return {
    user_id: userId,
    week_start_day: 'sunday',
    weekly_alignment_day: 'sunday',
    timezone: 'UTC',
    reminder_settings: {
      morning_spark: {
        enabled: true,
        time: '06:00:00',
        delivery: ['in_app']
      },
      evening_review: {
        enabled: true,
        time: '20:00:00',
        delivery: ['in_app']
      },
      weekly_alignment: {
        enabled: true,
        day: 'sunday',
        time: '09:00:00',
        delivery: ['in_app']
      },
      task_followup: {
        enabled: true,
        delivery: ['in_app']
      }
    },
    theme: 'auto',
    accent_color: '#0078d4',
    email_notifications_enabled: true,
    push_notifications_enabled: false,
    in_app_notifications_enabled: true,
    share_sparks_with_coach: false,
    share_reviews_with_coach: false,
    share_reflections_with_coach: false,
    alignment_guide_enabled: true,
    coaching_chat_enabled: true,
  };
}
