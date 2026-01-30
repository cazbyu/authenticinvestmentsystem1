import { getSupabaseClient } from '@/lib/supabase';

type TestVariant = 'direct' | 'builder' | 'mental_state';

export async function getVariant(userId: string, testName: string): Promise<TestVariant> {
  const supabase = getSupabaseClient();
  
  // Check if user already has a variant assigned
  const { data: existing } = await supabase
    .from('0008-ap-feature-tests')
    .select('variant')
    .eq('user_id', userId)
    .eq('test_name', testName)
    .limit(1)
    .maybeSingle();
  
  if (existing) {
    return existing.variant as TestVariant;
  }
  
  // Assign new variant randomly
  const variants: TestVariant[] = ['direct', 'builder', 'mental_state'];
  const variant = variants[Math.floor(Math.random() * variants.length)];
  
  return variant;
}

export async function trackTestAction(
  userId: string,
  testName: string,
  variant: string,
  action: string,
  metadata?: Record<string, any>
) {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('0008-ap-feature-tests')
    .insert({
      user_id: userId,
      test_name: testName,
      variant,
      action,
      metadata: metadata || {},
    });
}