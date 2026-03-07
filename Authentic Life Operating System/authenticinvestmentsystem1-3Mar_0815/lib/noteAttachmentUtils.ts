import { getSupabaseClient } from './supabase';

export interface NoteAttachment {
  id: string;
  note_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  public_url?: string;
}

/**
 * Uploads a file to note attachments storage
 */
export async function uploadNoteAttachment(
  file: File | Blob,
  fileName: string,
  fileType: string,
  userId: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileExt = fileName.split('.').pop() || '';
    const sanitizedFileName = `${timestamp}_${randomStr}.${fileExt}`;
    const filePath = `${userId}/${sanitizedFileName}`;

    console.log('[uploadNoteAttachment] Starting upload:', {
      fileName,
      fileType,
      filePath,
      fileSize: file.size,
      bucket: '0008-note-attachments'
    });

    const { data, error } = await supabase.storage
      .from('0008-note-attachments')
      .upload(filePath, file, {
        contentType: fileType,
        upsert: false,
      });

    if (error) {
      console.error('[uploadNoteAttachment] Upload error:', error);
      return null;
    }

    console.log('[uploadNoteAttachment] Upload successful:', data.path);
    return data.path;
  } catch (error) {
    console.error('[uploadNoteAttachment] Exception:', error);
    return null;
  }
}

/**
 * Saves note attachment metadata to the database
 */
export async function saveNoteAttachmentMetadata(
  noteId: string,
  userId: string,
  fileName: string,
  filePath: string,
  fileType: string,
  fileSize: number
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    console.log('[saveNoteAttachmentMetadata] Saving metadata:', {
      noteId,
      userId,
      fileName,
      filePath,
      fileType,
      fileSize
    });

    const { data, error } = await supabase
      .from('0008-ap-note-attachments')
      .insert({
        note_id: noteId,
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_type: fileType,
        file_size: fileSize,
      })
      .select()
      .single();

    if (error) {
      console.error('[saveNoteAttachmentMetadata] Insert error:', error);
      return null;
    }

    console.log('[saveNoteAttachmentMetadata] Metadata saved successfully, id:', data.id);
    return data.id;
  } catch (error) {
    console.error('[saveNoteAttachmentMetadata] Exception:', error);
    return null;
  }
}

/**
 * Fetches all attachments for a specific note
 */
export async function fetchNoteAttachments(
  noteId: string
): Promise<NoteAttachment[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('0008-ap-note-attachments')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    const attachmentsWithUrls = await Promise.all(
      data.map(async (attachment) => ({
        ...attachment,
        public_url: await getNoteAttachmentSignedUrl(attachment.file_path),
      }))
    );

    return attachmentsWithUrls;
  } catch (error) {
    console.error('Error fetching note attachments:', error);
    return [];
  }
}

/**
 * Fetches only image attachments for a note
 */
export async function fetchNoteImageAttachments(
  noteId: string
): Promise<NoteAttachment[]> {
  try {
    const attachments = await fetchNoteAttachments(noteId);
    return attachments.filter((attachment) =>
      attachment.file_type.startsWith('image/')
    );
  } catch (error) {
    console.error('Error fetching note image attachments:', error);
    return [];
  }
}

/**
 * Generates a signed URL for a note attachment stored in Supabase Storage
 * Uses authentication to access private bucket files
 */
export async function getNoteAttachmentSignedUrl(filePath: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from('0008-note-attachments')
      .createSignedUrl(filePath, 3600);

    if (error) throw error;

    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return '';
  }
}

/**
 * Generates a public URL for a note attachment stored in Supabase Storage
 * @deprecated Use getNoteAttachmentSignedUrl for authenticated access
 */
export function getNoteAttachmentPublicUrl(filePath: string): string {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage
    .from('0008-note-attachments')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Deletes a note attachment from both storage and database
 */
export async function deleteNoteAttachment(
  attachmentId: string,
  filePath: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('0008-note-attachments')
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
      throw storageError;
    }

    // Delete metadata from database
    const { error: dbError } = await supabase
      .from('0008-ap-note-attachments')
      .delete()
      .eq('id', attachmentId);

    if (dbError) {
      console.error('Error deleting from database:', dbError);
      throw dbError;
    }

    return true;
  } catch (error) {
    console.error('Error deleting note attachment:', error);
    return false;
  }
}

/**
 * Fetches note attachments for parent items (tasks, events, deposit ideas).
 * Returns a map of parent_id -> NoteAttachment[] for items that have notes with attachments.
 */
export async function fetchAttachmentsForParents(
  parentIds: string[],
  userId: string
): Promise<Map<string, NoteAttachment[]>> {
  try {
    if (parentIds.length === 0) return new Map();

    const supabase = getSupabaseClient();
    const { data: joinData, error: joinError } = await supabase
      .from('0008-ap-universal-notes-join')
      .select('parent_id, note_id')
      .in('parent_id', parentIds)
      .eq('user_id', userId);

    if (joinError) throw joinError;
    if (!joinData || joinData.length === 0) return new Map();

    const noteIds = [...new Set(joinData.map((j: { note_id: string }) => j.note_id))];
    const attachmentsByNote = await fetchAttachmentsForNotes(noteIds);

    const attachmentsByParent = new Map<string, NoteAttachment[]>();
    for (const join of joinData) {
      const noteAttachments = attachmentsByNote.get(join.note_id) || [];
      if (noteAttachments.length > 0) {
        const existing = attachmentsByParent.get(join.parent_id) || [];
        attachmentsByParent.set(join.parent_id, [...existing, ...noteAttachments]);
      }
    }

    return attachmentsByParent;
  } catch (error) {
    console.error('Error fetching attachments for parents:', error);
    return new Map();
  }
}

/**
 * Fetches attachments for multiple notes in batch
 */
export async function fetchAttachmentsForNotes(
  noteIds: string[]
): Promise<Map<string, NoteAttachment[]>> {
  try {
    if (noteIds.length === 0) return new Map();

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('0008-ap-note-attachments')
      .select('*')
      .in('note_id', noteIds)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return new Map();

    const attachmentMap = new Map<string, NoteAttachment[]>();

    await Promise.all(
      data.map(async (attachment) => {
        const noteId = attachment.note_id;
        const attachmentWithUrl = {
          ...attachment,
          public_url: await getNoteAttachmentSignedUrl(attachment.file_path),
        };

        if (!attachmentMap.has(noteId)) {
          attachmentMap.set(noteId, []);
        }
        attachmentMap.get(noteId)!.push(attachmentWithUrl);
      })
    );

    return attachmentMap;
  } catch (error) {
    console.error('Error fetching attachments for notes:', error);
    return new Map();
  }
}

/**
 * Deletes all attachments for a specific note
 * Useful when deleting a note entirely
 */
export async function deleteAllNoteAttachments(noteId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    // First, get all attachments for the note
    const attachments = await fetchNoteAttachments(noteId);

    if (attachments.length === 0) return true;

    // Delete all files from storage
    const filePaths = attachments.map(att => att.file_path);
    const { error: storageError } = await supabase.storage
      .from('0008-note-attachments')
      .remove(filePaths);

    if (storageError) {
      console.error('Error deleting files from storage:', storageError);
      throw storageError;
    }

    // Delete all metadata from database
    const { error: dbError } = await supabase
      .from('0008-ap-note-attachments')
      .delete()
      .eq('note_id', noteId);

    if (dbError) {
      console.error('Error deleting attachment metadata:', dbError);
      throw dbError;
    }

    return true;
  } catch (error) {
    console.error('Error deleting all note attachments:', error);
    return false;
  }
}
