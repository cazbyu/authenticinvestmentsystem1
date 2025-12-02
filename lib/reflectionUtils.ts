import { supabase } from './supabase';
import { formatLocalDate, getWeekStart, getWeekEnd } from './dateUtils';

export interface ReflectionAttachment {
  id: string;
  reflection_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  public_url?: string;
}

export interface ReflectionWithRelations {
  id: string;
  user_id: string;
  reflection_type: 'daily' | 'weekly';
  date: string;
  content: string;
  reflection_image?: string;
  reflection_title?: string;
  title_generated_at?: string;
  title_generation_method?: 'ai' | 'manual';
  follow_up: boolean;
  follow_up_date?: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  daily_rose?: boolean;
  daily_thorn?: boolean;
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ id: string; parent_id?: string; content: string; created_at: string; parent_type?: string }>;
  attachments?: ReflectionAttachment[];
}

/**
 * Fetches reflections for a specific date range
 */
export async function fetchReflectionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ReflectionWithRelations[]> {
  try {
    const { data: reflections, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!reflections) return [];

    // Fetch related data for each reflection
    const reflectionsWithRelations = await Promise.all(
      reflections.map(async (reflection) => {
        const [rolesData, domainsData, keyRelsData, notesData] = await Promise.all([
          fetchReflectionRoles(reflection.id),
          fetchReflectionDomains(reflection.id),
          fetchReflectionKeyRelationships(reflection.id),
          fetchReflectionNotes(reflection.id, reflection.date, userId),
        ]);

        return {
          ...reflection,
          roles: rolesData,
          domains: domainsData,
          keyRelationships: keyRelsData,
          notes: notesData,
        };
      })
    );

    return reflectionsWithRelations;
  } catch (error) {
    console.error('Error fetching reflections by date range:', error);
    return [];
  }
}

/**
 * Fetches a single reflection by ID with all related data
 */
export async function fetchReflectionById(
  reflectionId: string
): Promise<ReflectionWithRelations | null> {
  try {
    const { data: reflection, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('id', reflectionId)
      .eq('archived', false)
      .maybeSingle();

    if (error) throw error;
    if (!reflection) return null;

    const [rolesData, domainsData, keyRelsData, notesData] = await Promise.all([
      fetchReflectionRoles(reflection.id),
      fetchReflectionDomains(reflection.id),
      fetchReflectionKeyRelationships(reflection.id),
      fetchReflectionNotes(reflection.id, reflection.date, reflection.user_id),
    ]);

    return {
      ...reflection,
      roles: rolesData,
      domains: domainsData,
      keyRelationships: keyRelsData,
      notes: notesData,
    };
  } catch (error) {
    console.error('Error fetching reflection by ID:', error);
    return null;
  }
}

/**
 * Fetches all follow-up reflections for a user (legacy, using follow_up columns)
 */
export async function fetchFollowUpReflections(
  userId: string
): Promise<ReflectionWithRelations[]> {
  try {
    const { data: reflections, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .eq('follow_up', true)
      .not('follow_up_date', 'is', null)
      .order('follow_up_date', { ascending: true });

    if (error) throw error;
    if (!reflections) return [];

    const reflectionsWithRelations = await Promise.all(
      reflections.map(async (reflection) => {
        const [rolesData, domainsData, keyRelsData, notesData] = await Promise.all([
          fetchReflectionRoles(reflection.id),
          fetchReflectionDomains(reflection.id),
          fetchReflectionKeyRelationships(reflection.id),
          fetchReflectionNotes(reflection.id, reflection.date, userId),
        ]);

        return {
          ...reflection,
          roles: rolesData,
          domains: domainsData,
          keyRelationships: keyRelsData,
          notes: notesData,
        };
      })
    );

    return reflectionsWithRelations;
  } catch (error) {
    console.error('Error fetching follow-up reflections:', error);
    return [];
  }
}

/**
 * Helper to fetch roles for a reflection
 */
async function fetchReflectionRoles(
  reflectionId: string
): Promise<Array<{ id: string; label: string; color?: string }>> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('role_id, 0008-ap-roles(id, label, color)')
      .eq('parent_type', 'reflection')
      .eq('parent_id', reflectionId);

    if (error) throw error;
    if (!data) return [];

    return data
      .map((item: any) => item['0008-ap-roles'])
      .filter((role: any) => role !== null);
  } catch (error) {
    console.error('Error fetching reflection roles:', error);
    return [];
  }
}

/**
 * Helper to fetch domains for a reflection
 */
async function fetchReflectionDomains(
  reflectionId: string
): Promise<Array<{ id: string; name: string; color?: string }>> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-universal-domains-join')
      .select('domain_id, 0008-ap-domains(id, name)')
      .eq('parent_type', 'reflection')
      .eq('parent_id', reflectionId);

    if (error) throw error;
    if (!data) return [];

    return data
      .map((item: any) => item['0008-ap-domains'])
      .filter((domain: any) => domain !== null);
  } catch (error) {
    console.error('Error fetching reflection domains:', error);
    return [];
  }
}

/**
 * Helper to fetch key relationships for a reflection
 */
async function fetchReflectionKeyRelationships(
  reflectionId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-universal-key-relationships-join')
      .select('key_relationship_id, 0008-ap-key-relationships(id, name)')
      .eq('parent_type', 'reflection')
      .eq('parent_id', reflectionId);

    if (error) throw error;
    if (!data) return [];

    return data
      .map((item: any) => item['0008-ap-key-relationships'])
      .filter((kr: any) => kr !== null);
  } catch (error) {
    console.error('Error fetching reflection key relationships:', error);
    return [];
  }
}

/**
 * Helper to fetch notes for a reflection
 * Fetches notes from tasks/items completed on the same date as the reflection
 */
async function fetchReflectionNotes(
  reflectionId: string,
  reflectionDate?: string,
  userId?: string
): Promise<Array<{ id: string; parent_id?: string; content: string; created_at: string; parent_type?: string }>> {
  try {
    // First, try to fetch notes directly linked to the reflection
    const { data: directNotes, error: directError } = await supabase
      .from('0008-ap-universal-notes-join')
      .select(`
        parent_type,
        note:0008-ap-notes(
          id,
          content,
          created_at
        )
      `)
      .eq('parent_type', 'reflection')
      .eq('parent_id', reflectionId);

    if (directError) throw directError;

    let notes =
      directNotes
        ?.map((item: any) => ({
          ...item.note,
          parent_type: item.parent_type,
          parent_id: reflectionId,
        }))
        .filter((note: any) => note !== null && note.id) || [];

    // If we have a reflection date, also fetch notes from tasks/items completed on that date
    if (reflectionDate && userId) {
      console.log('[fetchReflectionNotes] Calling get_notes_for_reflection_date with:', {
        userId,
        reflectionDate,
        reflectionId,
      });

      const { data: dateBasedNotes, error: dateError } = await supabase.rpc(
        'get_notes_for_reflection_date',
        {
          p_user_id: userId,
          p_date: reflectionDate,
        }
      );

      console.log('[fetchReflectionNotes] RPC result:', {
        notesCount: dateBasedNotes?.length || 0,
        error: dateError,
        notes: dateBasedNotes,
      });

      if (!dateError && dateBasedNotes) {
        notes = [...notes, ...dateBasedNotes];
      } else if (dateError) {
        console.error('[fetchReflectionNotes] Error from RPC:', dateError);
      }
    }

    // Remove duplicates by note id
    const uniqueNotes = Array.from(
      new Map(notes.map((note: any) => [note.id, note])).values()
    );

    return uniqueNotes;
  } catch (error) {
    console.error('Error fetching reflection notes:', error);
    return [];
  }
}

/**
 * Uploads a reflection image to storage
 */
export async function uploadReflectionImage(
  file: File | Blob,
  userId: string,
  reflectionId: string
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}`;
    const filePath = `${userId}/${reflectionId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('0008-reflection-images')
      .upload(filePath, file);

    if (error) throw error;

    return data.path;
  } catch (error) {
    console.error('Error uploading reflection image:', error);
    return null;
  }
}

/**
 * Deletes a reflection image from storage
 */
export async function deleteReflectionImage(imagePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('0008-reflection-images')
      .remove([imagePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting reflection image:', error);
    return false;
  }
}

/**
 * Calculates the week range for a given date
 */
export function calculateWeekRange(
  date: Date,
  weekStartDay: 'sunday' | 'monday' = 'sunday'
): { weekStart: string; weekEnd: string } {
  const weekStart = getWeekStart(date, weekStartDay);
  const weekEnd = getWeekEnd(date, weekStartDay);

  return {
    weekStart: formatLocalDate(weekStart),
    weekEnd: formatLocalDate(weekEnd),
  };
}

/**
 * Checks if a reflection is older than 90 days
 */
export function isOlderThan90Days(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysDiff > 90;
}

/**
 * Archives reflections older than 90 days
 */
export async function archiveOldReflections(userId: string): Promise<number> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await supabase
      .from('0008-ap-reflections')
      .update({ archived: true })
      .eq('user_id', userId)
      .eq('archived', false)
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (error) throw error;

    return data?.length || 0;
  } catch (error) {
    console.error('Error archiving old reflections:', error);
    return 0;
  }
}

/**
 * Generates an AI title for a reflection using the Edge Function
 */
async function generateReflectionTitle(
  reflectionId: string,
  content: string
): Promise<void> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn('No active session, skipping title generation');
      return;
    }

    const apiUrl = `${supabaseUrl}/functions/v1/generate-reflection-title`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reflectionId,
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to generate reflection title:', errorData);
      return;
    }

    const result = await response.json();
    console.log('Reflection title generated successfully:', result.title);
  } catch (error) {
    console.error('Error generating reflection title:', error);
  }
}

/**
 * Saves a reflection with its associations
 * Also writes to 0008-ap-universal-follow-up-join when followUp + followUpDate are set.
 */
export async function saveReflection(
  userId: string,
  content: string,
  selectedRoleIds: string[],
  selectedDomainIds: string[],
  selectedKeyRelationshipIds: string[],
  reflectionType: 'daily' | 'weekly' = 'daily',
  followUp: boolean = false,
  followUpDate?: string,
  imagePaths?: string[]
): Promise<string | null> {
  try {
    const currentDate = formatLocalDate(new Date());

    // Always create a new reflection (allow multiple reflections per day)
    const { data: newReflection, error: insertError } = await supabase
      .from('0008-ap-reflections')
      .insert({
        user_id: userId,
        content,
        date: currentDate,
        reflection_type: reflectionType,
        follow_up: followUp,
        follow_up_date: followUpDate || null,
        reflection_image: imagePaths ? JSON.stringify(imagePaths) : null,
        archived: false,
      })
      .select()
      .single();

    const reflection = newReflection;
    const reflectionError = insertError;

    if (reflectionError) throw reflectionError;
    if (!reflection) throw new Error('Failed to create reflection');

    // Create universal follow-up join row if needed
    if (followUp && followUpDate) {
      const { error: followUpError } = await supabase
        .from('0008-ap-universal-follow-up-join')
        .insert({
          user_id: userId,
          parent_type: 'reflection',
          parent_id: reflection.id,
          follow_up_date: followUpDate,
          status: 'pending',
          reason_type: 'review', // or null if you prefer
          reason: null,
        });

      if (followUpError) throw followUpError;
    }

    // Insert role associations
    if (selectedRoleIds.length > 0) {
      const roleJoins = selectedRoleIds.map((roleId) => ({
        user_id: userId,
        parent_type: 'reflection',
        parent_id: reflection.id,
        role_id: roleId,
      }));

      const { error: roleError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert(roleJoins);

      if (roleError) throw roleError;
    }

    // Insert domain associations
    if (selectedDomainIds.length > 0) {
      const domainJoins = selectedDomainIds.map((domainId) => ({
        user_id: userId,
        parent_type: 'reflection',
        parent_id: reflection.id,
        domain_id: domainId,
      }));

      const { error: domainError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert(domainJoins);

      if (domainError) throw domainError;
    }

    // Insert key relationship associations
    if (selectedKeyRelationshipIds.length > 0) {
      const krJoins = selectedKeyRelationshipIds.map((krId) => ({
        user_id: userId,
        parent_type: 'reflection',
        parent_id: reflection.id,
        key_relationship_id: krId,
      }));

      const { error: krError } = await supabase
        .from('0008-ap-universal-key-relationships-join')
        .insert(krJoins);

      if (krError) throw krError;
    }

    // Generate AI title asynchronously (non-blocking)
    if (reflection.id && content) {
      generateReflectionTitle(reflection.id, content).catch((error) => {
        console.error('Background title generation failed:', error);
      });
    }

    return reflection.id;
  } catch (error) {
    console.error('Error saving reflection:', error);
    return null;
  }
}

/**
 * Updates an existing reflection
 * Also keeps 0008-ap-universal-follow-up-join in sync.
 */
export async function updateReflection(
  reflectionId: string,
  userId: string,
  content: string,
  selectedRoleIds: string[],
  selectedDomainIds: string[],
  selectedKeyRelationshipIds: string[],
  followUp: boolean = false,
  followUpDate?: string,
  imagePaths?: string[]
): Promise<boolean> {
  try {
    // Update reflection
    const { error: reflectionError } = await supabase
      .from('0008-ap-reflections')
      .update({
        content,
        follow_up: followUp,
        follow_up_date: followUpDate || null,
        reflection_image: imagePaths ? JSON.stringify(imagePaths) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reflectionId)
      .eq('user_id', userId);

    if (reflectionError) throw reflectionError;

    // Keep universal follow-up join in sync
    await supabase
      .from('0008-ap-universal-follow-up-join')
      .delete()
      .eq('parent_type', 'reflection')
      .eq('parent_id', reflectionId);

    if (followUp && followUpDate) {
      const { error: followUpError } = await supabase
        .from('0008-ap-universal-follow-up-join')
        .insert({
          user_id: userId,
          parent_type: 'reflection',
          parent_id: reflectionId,
          follow_up_date: followUpDate,
          status: 'pending',
          reason_type: 'review', // or null if you prefer
          reason: null,
        });

      if (followUpError) throw followUpError;
    }

    // Delete existing associations
    await Promise.all([
      supabase
        .from('0008-ap-universal-roles-join')
        .delete()
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId),
      supabase
        .from('0008-ap-universal-domains-join')
        .delete()
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId),
      supabase
        .from('0008-ap-universal-key-relationships-join')
        .delete()
        .eq('parent_type', 'reflection')
        .eq('parent_id', reflectionId),
    ]);

    // Insert new role associations
    if (selectedRoleIds.length > 0) {
      const roleJoins = selectedRoleIds.map((roleId) => ({
        user_id: userId,
        parent_type: 'reflection',
        parent_id: reflectionId,
        role_id: roleId,
      }));

      const { error: roleError } = await supabase
        .from('0008-ap-universal-roles-join')
        .insert(roleJoins);

      if (roleError) throw roleError;
    }

    // Insert new domain associations
    if (selectedDomainIds.length > 0) {
      const domainJoins = selectedDomainIds.map((domainId) => ({
        user_id: userId,
        parent_type: 'reflection',
        parent_id: reflectionId,
        domain_id: domainId,
      }));

      const { error: domainError } = await supabase
        .from('0008-ap-universal-domains-join')
        .insert(domainJoins);

      if (domainError) throw domainError;
    }

    // Insert new key relationship associations
    if (selectedKeyRelationshipIds.length > 0) {
      const krJoins = selectedKeyRelationshipIds.map((krId) => ({
        user_id: userId,
        parent_type: 'reflection',
        parent_id: reflectionId,
        key_relationship_id: krId,
      }));

      const { error: krError } = await supabase
        .from('0008-ap-universal-key-relationships-join')
        .insert(krJoins);

      if (krError) throw krError;
    }

    return true;
  } catch (error) {
    console.error('Error updating reflection:', error);
    return false;
  }
}

/**
 * Archives (soft deletes) a reflection
 */
export async function archiveReflection(
  reflectionId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('0008-ap-reflections')
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq('id', reflectionId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error archiving reflection:', error);
    return false;
  }
}

/**
 * Fetches attachments for a reflection
 */
export async function fetchReflectionAttachments(
  reflectionId: string
): Promise<ReflectionAttachment[]> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-reflection-attachments')
      .select('*')
      .eq('reflection_id', reflectionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    const attachmentsWithUrls = await Promise.all(
      data.map(async (attachment) => ({
        ...attachment,
        public_url: await getAttachmentSignedUrl(attachment.file_path),
      }))
    );

    return attachmentsWithUrls;
  } catch (error) {
    console.error('Error fetching reflection attachments:', error);
    return [];
  }
}

/**
 * Fetches only image attachments for a reflection
 */
export async function fetchReflectionImageAttachments(
  reflectionId: string
): Promise<ReflectionAttachment[]> {
  try {
    const attachments = await fetchReflectionAttachments(reflectionId);
    return attachments.filter((attachment) =>
      attachment.file_type.startsWith('image/')
    );
  } catch (error) {
    console.error('Error fetching reflection image attachments:', error);
    return [];
  }
}

/**
 * Generates a signed URL for an attachment stored in Supabase Storage
 * Uses authentication to access private bucket files
 */
export async function getAttachmentSignedUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from('0008-reflection-attachments')
      .createSignedUrl(filePath, 3600);

    if (error) throw error;

    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return '';
  }
}

/**
 * Generates a public URL for an attachment stored in Supabase Storage
 * @deprecated Use getAttachmentSignedUrl for authenticated access
 */
export function getAttachmentPublicUrl(filePath: string): string {
  const { data } = supabase.storage
    .from('0008-reflection-attachments')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Fetches attachments for multiple reflections in batch
 */
export async function fetchAttachmentsForReflections(
  reflectionIds: string[]
): Promise<Map<string, ReflectionAttachment[]>> {
  try {
    if (reflectionIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('0008-ap-reflection-attachments')
      .select('*')
      .in('reflection_id', reflectionIds)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return new Map();

    const attachmentMap = new Map<string, ReflectionAttachment[]>();

    await Promise.all(
      data.map(async (attachment) => {
        const reflectionId = attachment.reflection_id;
        const attachmentWithUrl = {
          ...attachment,
          public_url: await getAttachmentSignedUrl(attachment.file_path),
        };

        if (!attachmentMap.has(reflectionId)) {
          attachmentMap.set(reflectionId, []);
        }
        attachmentMap.get(reflectionId)!.push(attachmentWithUrl);
      })
    );

    return attachmentMap;
  } catch (error) {
    console.error('Error fetching attachments for reflections:', error);
    return new Map();
  }
}
