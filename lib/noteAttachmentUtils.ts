import { supabase } from './supabase';

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
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileExt = fileName.split('.').pop() || '';
    const sanitizedFileName = `${timestamp}_${randomStr}.${fileExt}`;
    const filePath = `${userId}/${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from('0008-note-attachments')
      .upload(filePath, file, {
        contentType: fileType,
        upsert: false,
      });

    if (error) {
      console.error('Error uploading note attachment:', error);
      return null;
    }

    return data.path;
  } catch (error) {
    console.error('Error in uploadNoteAttachment:', error);
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
      console.error('Error saving note attachment metadata:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error in saveNoteAttachmentMetadata:', error);
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
 * Fetches attachments for multiple notes in batch
 */
export async function fetchAttachmentsForNotes(
  noteIds: string[]
): Promise<Map<string, NoteAttachment[]>> {
  try {
    if (noteIds.length === 0) return new Map();

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
