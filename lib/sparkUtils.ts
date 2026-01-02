import { getSupabaseClient } from './supabase';

export interface DailySpark {
  id: string;
  user_id: string;
  spark_date: string;
  fuel_level: 1 | 2 | 3;
  mode: 'Recovery' | 'Steady' | 'Sprint';
  initial_target_score: 20 | 35 | 55;
  committed_at: string;
  created_at: string;
}

export interface CreateSparkParams {
  userId: string;
  fuelLevel: 1 | 2 | 3;
  sparkDate: string;
}

export function calculateTargetScore(fuelLevel: 1 | 2 | 3): 20 | 35 | 55 {
  switch (fuelLevel) {
    case 1:
      return 20;
    case 2:
      return 35;
    case 3:
      return 55;
  }
}

export function getFuelMode(fuelLevel: 1 | 2 | 3): 'Recovery' | 'Steady' | 'Sprint' {
  switch (fuelLevel) {
    case 1:
      return 'Recovery';
    case 2:
      return 'Steady';
    case 3:
      return 'Sprint';
  }
}

export function getFuelEmoji(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return '🪫';
    case 2:
      return '⚡';
    case 3:
      return '🔥';
  }
}

export function getFuelColor(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return '#ef4444'; // red
    case 2:
      return '#f59e0b'; // amber
    case 3:
      return '#10b981'; // green
  }
}

export function getModeDescription(fuelLevel: 1 | 2 | 3): string {
  switch (fuelLevel) {
    case 1:
      return 'Rest and recharge. Honor low energy.';
    case 2:
      return 'Maintain momentum. Consistent progress.';
    case 3:
      return 'Full power. Bring your A-game.';
  }
}

export async function checkTodaysSpark(userId: string): Promise<DailySpark | null> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('0008-ap-daily-sparks')
    .select('*')
    .eq('user_id', userId)
    .eq('spark_date', today)
    .maybeSingle();

  if (error) {
    console.error('Error checking today\'s spark:', error);
    throw error;
  }

  return data;
}

export async function createDailySpark(params: CreateSparkParams): Promise<DailySpark> {
  const supabase = getSupabaseClient();
  const { userId, fuelLevel, sparkDate } = params;

  const mode = getFuelMode(fuelLevel);
  const targetScore = calculateTargetScore(fuelLevel);

  const { data, error } = await supabase
    .from('0008-ap-daily-sparks')
    .insert({
      user_id: userId,
      spark_date: sparkDate,
      fuel_level: fuelLevel,
      mode: mode,
      initial_target_score: targetScore,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating daily spark:', error);
    throw error;
  }

  return data;
}

export async function getSparkForDate(userId: string, date: string): Promise<DailySpark | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('0008-ap-daily-sparks')
    .select('*')
    .eq('user_id', userId)
    .eq('spark_date', date)
    .maybeSingle();

  if (error) {
    console.error('Error getting spark for date:', error);
    throw error;
  }

  return data;
}

export async function updateSparkFuelLevel(sparkId: string, fuelLevel: 1 | 2 | 3): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('0008-ap-daily-sparks')
    .update({
      fuel_level: fuelLevel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sparkId);

  if (error) {
    console.error('Error updating spark fuel level:', error);
    throw error;
  }
}
