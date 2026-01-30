import { getSupabaseClient } from '@/lib/supabase';

// ============ A/B TESTING ============

type TestVariant = 'direct' | 'builder' | 'mental_state';

export async function getVariant(userId: string, testName: string): Promise<TestVariant> {
  const supabase = getSupabaseClient();
  
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

// ============ CONTENT ENGAGEMENT ============

type ContentType = 'question' | 'quote' | 'suggestion' | 'link';
type ContentAction = 'shown' | 'answered' | 'skipped' | 'saved' | 'clicked' | 'copied';

export async function trackContent(
  userId: string,
  contentType: ContentType,
  contentText: string,
  context: string,
  action: ContentAction,
  engagementData?: {
    contentId?: string;
    timeSpentSeconds?: number;
    responseLength?: number;
    questionPosition?: number;
    totalQuestions?: number;
    domain?: string;
    author?: string;
    [key: string]: any;
  }
) {
  try {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('0008-ap-content-engagement')
      .insert({
        user_id: userId,
        content_type: contentType,
        content_id: engagementData?.contentId || null,
        content_text: contentText,
        context,
        action,
        engagement_data: engagementData || {},
      });
  } catch (error) {
    // Silent fail - don't break the app for analytics
    console.error('Analytics error:', error);
  }
}

// ============ QUESTION TRACKING ============

export async function trackQuestionShown(
  userId: string,
  questionId: string,
  questionText: string,
  context: string,
  position: number,
  total: number,
  domain?: string
) {
  return trackContent(userId, 'question', questionText, context, 'shown', {
    contentId: questionId,
    questionPosition: position,
    totalQuestions: total,
    domain,
  });
}

export async function trackQuestionAnswered(
  userId: string,
  questionId: string,
  questionText: string,
  context: string,
  responseLength: number,
  timeSpentSeconds: number,
  domain?: string
) {
  return trackContent(userId, 'question', questionText, context, 'answered', {
    contentId: questionId,
    responseLength,
    timeSpentSeconds,
    domain,
  });
}

export async function trackQuestionSkipped(
  userId: string,
  questionId: string,
  questionText: string,
  context: string,
  timeSpentSeconds: number,
  domain?: string
) {
  return trackContent(userId, 'question', questionText, context, 'skipped', {
    contentId: questionId,
    timeSpentSeconds,
    domain,
  });
}

// ============ QUOTE TRACKING ============

export async function trackQuoteShown(
  userId: string,
  quoteText: string,
  author: string,
  context: string
) {
  return trackContent(userId, 'quote', quoteText, context, 'shown', { author });
}

export async function trackQuoteSaved(
  userId: string,
  quoteText: string,
  author: string,
  context: string
) {
  return trackContent(userId, 'quote', quoteText, context, 'saved', { author });
}

// ============ LINK TRACKING ============

export async function trackLinkShown(
  userId: string,
  linkText: string,
  url: string,
  context: string
) {
  return trackContent(userId, 'link', linkText, context, 'shown', { url });
}

export async function trackLinkClicked(
  userId: string,
  linkText: string,
  url: string,
  context: string
) {
  return trackContent(userId, 'link', linkText, context, 'clicked', { url });
}