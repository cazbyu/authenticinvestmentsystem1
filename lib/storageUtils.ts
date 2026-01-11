import { getSupabaseClient } from './supabase';

export interface StorageBreakdown {
  category: string;
  bucket: string;
  size: number;
  fileCount: number;
}

export interface StorageUsage {
  totalSize: number;
  breakdown: StorageBreakdown[];
  lastUpdated: string;
}

const STORAGE_BUCKETS = [
  { name: '0008-ap-profile-images', category: 'Profile Images' },
  { name: '0008-role-images', category: 'Role Images' },
  { name: '0008-key-relationship-images', category: 'Key Relationship Images' },
  { name: '0008-note-attachments', category: 'Note Attachments' },
  { name: '0008-reflection-attachments', category: 'Reflection Attachments' },
];

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function calculateStorageUsage(userId: string): Promise<StorageUsage> {
  const supabase = getSupabaseClient();
  const breakdown: StorageBreakdown[] = [];
  let totalSize = 0;

  for (const bucket of STORAGE_BUCKETS) {
    try {
      const { data: files, error } = await supabase.storage
        .from(bucket.name)
        .list(userId, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error(`Error listing files in ${bucket.name}:`, error);
        continue;
      }

      let bucketSize = 0;
      let fileCount = 0;

      if (files) {
        for (const file of files) {
          const metadata = file.metadata as any;
          const size = metadata?.size || 0;
          bucketSize += size;
          fileCount++;
        }
      }

      totalSize += bucketSize;
      breakdown.push({
        category: bucket.category,
        bucket: bucket.name,
        size: bucketSize,
        fileCount
      });
    } catch (error) {
      console.error(`Error calculating storage for ${bucket.name}:`, error);
    }
  }

  return {
    totalSize,
    breakdown: breakdown.sort((a, b) => b.size - a.size),
    lastUpdated: new Date().toISOString()
  };
}

export function getStoragePercentage(usedBytes: number, limitBytes: number = 1073741824): number {
  return Math.min((usedBytes / limitBytes) * 100, 100);
}
