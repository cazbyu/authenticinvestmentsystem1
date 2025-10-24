import { supabase } from './supabase';
import { formatLocalDate, getWeekStart, getWeekEnd } from './dateUtils';

export interface ReflectionWithRelations {
  id: string;
  user_id: string;
  reflection_type: 'daily' | 'weekly';
  date: string;
  content: string;
  reflection_image?: string;
  follow_up: boolean;
  follow_up_date?: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
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
        const [rolesData, domainsData, keyRelsData] = await Promise.all([
          fetchReflectionRoles(reflection.id),
          fetchReflectionDomains(reflection.id),
          fetchReflectionKeyRelationships(reflection.id),
        ]);

        return {
          ...reflection,
          roles: rolesData,
          domains: domainsData,
          keyRelationships: keyRelsData,
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

    const [rolesData, domainsData, keyRelsData] = await Promise.all([
      fetchReflectionRoles(reflection.id),
      fetchReflectionDomains(reflection.id),
      fetchReflectionKeyRelationships(reflection.id),
    ]);

    return {
      ...reflection,
      roles: rolesData,
      domains: domainsData,
      keyRelationships: keyRelsData,
    };
  } catch (error) {
    console.error('Error fetching reflection by ID:', error);
    return null;
  }
}

/**
 * Fetches all follow-up reflections for a user
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
        const [rolesData, domainsData, keyRelsData] = await Promise.all([
          fetchReflectionRoles(reflection.id),
          fetchReflectionDomains(reflection.id),
          fetchReflectionKeyRelationships(reflection.id),
        ]);

        return {
          ...reflection,
          roles: rolesData,
          domains: domainsData,
          keyRelationships: keyRelsData,
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
      .select('domain_id, 0008-ap-domains(id, name, color)')
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
      .from('0008-ap-reflection_images')
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
      .from('0008-ap-reflection_images')
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
  const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
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
 * Saves a reflection with its associations
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

    // For daily reflections, check if one exists for today and update it
    // For weekly reflections, calculate week_start_date
    let reflection: any;
    let reflectionError: any;

    if (reflectionType === 'daily') {
      // Check if a daily reflection exists for today
      const { data: existingReflection, error: checkError } = await supabase
        .from('0008-ap-reflections')
        .select('id')
        .eq('user_id', userId)
        .eq('date', currentDate)
        .eq('reflection_type', 'daily')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingReflection) {
        // Update existing reflection
        const { data: updatedReflection, error: updateError } = await supabase
          .from('0008-ap-reflections')
          .update({
            content,
            follow_up: followUp,
            follow_up_date: followUpDate || null,
            reflection_image: imagePaths ? JSON.stringify(imagePaths) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReflection.id)
          .select()
          .single();

        reflection = updatedReflection;
        reflectionError = updateError;

        // Delete existing associations before adding new ones
        if (!updateError && reflection) {
          await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .delete()
              .eq('parent_type', 'reflection')
              .eq('parent_id', reflection.id),
            supabase
              .from('0008-ap-universal-domains-join')
              .delete()
              .eq('parent_type', 'reflection')
              .eq('parent_id', reflection.id),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .delete()
              .eq('parent_type', 'reflection')
              .eq('parent_id', reflection.id),
          ]);
        }
      } else {
        // Insert new reflection
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

        reflection = newReflection;
        reflectionError = insertError;
      }
    } else {
      // For weekly reflections, use the original insert logic
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

      reflection = newReflection;
      reflectionError = insertError;
    }

    if (reflectionError) throw reflectionError;
    if (!reflection) throw new Error('Failed to create reflection');

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

    return reflection.id;
  } catch (error) {
    console.error('Error saving reflection:', error);
    return null;
  }
}

/**
 * Updates an existing reflection
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
