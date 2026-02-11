/**
 * Step 5 (Alignment Check) service layer
 * Handles PQ3/PQ5 selection, response saving, and personal library.
 */

import { getSupabaseClient } from '@/lib/supabase';

export interface PowerQuestion {
  id: string;
  question_text: string;
  question_context: string | null;
  power_question: number;
  role_name: string | null;
  role_category: string | null;
  is_repeatable: boolean;
  is_active: boolean;
  ob_priority?: number | null;
}

export interface PQ3Selection {
  question: PowerQuestion;
  isUniversal: boolean;
}

export async function selectPQ3Question(
  userId: string,
  weekStart: string
): Promise<PQ3Selection | null> {
  const supabase = getSupabaseClient();

  // 1. Get user's active role labels
  const { data: roles } = await supabase
    .from('0008-ap-roles')
    .select('label, category')
    .eq('user_id', userId)
    .eq('is_active', true);

  const roleLabels = (roles || []).map((r: { label: string }) => r.label);

  // 2. Get all active PQ3 questions ordered by ob_priority (lowest first)
  const { data: allPQ3 } = await supabase
    .from('0008-ap-power-questions')
    .select('id, question_text, question_context, power_question, role_name, role_category, is_repeatable, is_active, ob_priority')
    .eq('power_question', 3)
    .eq('is_active', true)
    .order('ob_priority', { ascending: true });

  if (!allPQ3 || allPQ3.length === 0) return null;

  // 3. Exclude questions already answered this week
  const { data: answeredThisWeek } = await supabase
    .from('0008-ap-question-responses')
    .select('question_id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .eq('power_question', 3);

  const answeredIds = new Set((answeredThisWeek || []).map((a: { question_id: string }) => a.question_id));

  // 4. Filter to eligible: universal + user's roles, excluding answered
  const universal = allPQ3.filter((q: PowerQuestion) => q.role_name === null);
  const roleSpecific = allPQ3.filter(
    (q: PowerQuestion) => q.role_name !== null && roleLabels.includes(q.role_name)
  );
  const availableUniversal = universal.filter((q: PowerQuestion) => !answeredIds.has(q.id));
  const availableRoleSpecific = roleSpecific.filter((q: PowerQuestion) => !answeredIds.has(q.id));

  // 5. Build eligible pool (role-specific + universal, unanswered)
  const eligibleQuestions = [...availableRoleSpecific, ...availableUniversal];

  // 6. Fallback if all answered this week: use any PQ3
  const poolToUse = eligibleQuestions.length > 0
    ? eligibleQuestions
    : [...roleSpecific, ...universal];

  if (poolToUse.length === 0) return null;

  // 7. Find lowest ob_priority in pool
  const lowestPriority = Math.min(
    ...poolToUse.map((q: PowerQuestion) => q.ob_priority ?? 999)
  );

  // 8. Filter to only questions at that priority level
  const priorityPool = poolToUse.filter(
    (q: PowerQuestion) => (q.ob_priority ?? 999) === lowestPriority
  );

  // 9. Split by role within priority pool
  const priorityRoleSpecific = priorityPool.filter((q: PowerQuestion) => q.role_name !== null);
  const priorityUniversal = priorityPool.filter((q: PowerQuestion) => q.role_name === null);

  // 10. Apply 60/40 weighting within this priority-level pool
  let pool: PowerQuestion[];
  let isUniversal: boolean;

  if (priorityRoleSpecific.length > 0 && priorityUniversal.length > 0) {
    isUniversal = Math.random() > 0.6; // 40% chance universal
    pool = isUniversal ? priorityUniversal : priorityRoleSpecific;
  } else if (priorityRoleSpecific.length > 0) {
    pool = priorityRoleSpecific;
    isUniversal = false;
  } else if (priorityUniversal.length > 0) {
    pool = priorityUniversal;
    isUniversal = true;
  } else {
    pool = priorityPool;
    isUniversal = priorityPool[0]?.role_name === null;
  }

  const question = pool[Math.floor(Math.random() * pool.length)];
  return { question, isUniversal };
}

export async function selectPQ5Question(
  userId: string,
  weekStart: string,
  pq3RoleName?: string | null
): Promise<PowerQuestion | null> {
  const supabase = getSupabaseClient();

  // 1. Get all active PQ5 questions
  const { data: allPQ5 } = await supabase
    .from('0008-ap-power-questions')
    .select('id, question_text, question_context, power_question, role_name, role_category, is_repeatable, is_active')
    .eq('power_question', 5)
    .eq('is_active', true);

  if (!allPQ5 || allPQ5.length === 0) return null;

  // 2. Exclude questions used this week
  const { data: usedThisWeek } = await supabase
    .from('0008-ap-question-responses')
    .select('question_id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .eq('power_question', 5);

  const usedIds = new Set((usedThisWeek || []).map((a: { question_id: string }) => a.question_id));
  const available = allPQ5.filter((q: PowerQuestion) => !usedIds.has(q.id));

  if (available.length === 0) {
    // Fall back to any PQ5
    const fallback = allPQ5[Math.floor(Math.random() * allPQ5.length)];
    return fallback;
  }

  // 3. If PQ3 was role-specific, try to match
  if (pq3RoleName) {
    const roleMatched = available.filter((q: PowerQuestion) => q.role_name === pq3RoleName);
    if (roleMatched.length > 0) {
      return roleMatched[Math.floor(Math.random() * roleMatched.length)];
    }
  }

  // 4. Pick any available PQ5
  return available[Math.floor(Math.random() * available.length)];
}

export async function ensureWeeklyAlignmentRow(
  userId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<string | null> {
  const supabase = getSupabaseClient();

  // Try to find existing row
  const { data: existing } = await supabase
    .from('0008-ap-weekly-alignments')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new row with minimal data
  const { data: created, error } = await supabase
    .from('0008-ap-weekly-alignments')
    .insert({
      user_id: userId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating weekly alignment row:', error);
    return null;
  }

  return created?.id || null;
}

export async function savePQ3Response(
  userId: string,
  questionId: string,
  responseText: string,
  weekStart: string,
  weeklyAlignmentId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data: response, error } = await supabase
    .from('0008-ap-question-responses')
    .upsert(
      {
        user_id: userId,
        question_id: questionId,
        response_text: responseText,
        context_type: 'trajectory',
        context_id: weeklyAlignmentId,
        power_question: 3,
        week_start: weekStart,
        used_in_synthesis: false,
      },
      { onConflict: 'user_id,question_id,week_start' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Error saving PQ3 response:', error);
    return null;
  }

  const { error: updateError } = await supabase
    .from('0008-ap-weekly-alignments')
    .update({
      pq3_question_id: questionId,
      pq3_response_id: response.id,
      step_5_pq3_done: true,
    })
    .eq('id', weeklyAlignmentId);

  if (updateError) {
    console.error('Error updating weekly alignment with PQ3:', updateError);
  }

  return response?.id || null;
}

export async function savePQ5Response(
  userId: string,
  questionId: string,
  responseText: string,
  weekStart: string,
  weeklyAlignmentId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data: response, error } = await supabase
    .from('0008-ap-question-responses')
    .upsert(
      {
        user_id: userId,
        question_id: questionId,
        response_text: responseText,
        context_type: 'alignment',
        context_id: weeklyAlignmentId,
        power_question: 5,
        week_start: weekStart,
        used_in_synthesis: false,
      },
      { onConflict: 'user_id,question_id,week_start' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Error saving PQ5 response:', error);
    return null;
  }

  const { error: updateError } = await supabase
    .from('0008-ap-weekly-alignments')
    .update({
      pq5_question_id: questionId,
      pq5_response_id: response.id,
      step_5_pq5_done: true,
    })
    .eq('id', weeklyAlignmentId);

  if (updateError) {
    console.error('Error updating weekly alignment with PQ5:', updateError);
  }

  return response?.id || null;
}

export async function addToPersonalLibrary(
  userId: string,
  question: PowerQuestion,
  weeklyAlignmentId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('0008-ap-user-power-questions')
    .select('id')
    .eq('user_id', userId)
    .eq('source_question_id', question.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('0008-ap-weekly-alignments')
      .update({ step_5_added_to_library: true })
      .eq('id', weeklyAlignmentId);
    return true;
  }

  const { error } = await supabase
    .from('0008-ap-user-power-questions')
    .insert({
      user_id: userId,
      question_text: question.question_text,
      question_context: question.question_context,
      power_question: question.power_question,
      source_question_id: question.id,
      source_type: 'alignment_check',
      is_active: true,
      show_in_compass: false,
      show_in_spark: false,
    });

  if (error) {
    console.error('Error adding to personal library:', error);
    return false;
  }

  await supabase
    .from('0008-ap-weekly-alignments')
    .update({ step_5_added_to_library: true })
    .eq('id', weeklyAlignmentId);

  return true;
}

export function getBridgeMessage(pq3RoleName: string | null, wasSkipped: boolean): string {
  if (wasSkipped) {
    return "That's okay. Sometimes the most important thing is just showing up. Let's look forward.";
  }
  if (pq3RoleName) {
    return `Good. That honest look at your ${pq3RoleName} role is what separates intention from growth. Now, with that in mind...`;
  }
  return "Good. That kind of honesty is where alignment starts. Now, with that in mind...";
}
