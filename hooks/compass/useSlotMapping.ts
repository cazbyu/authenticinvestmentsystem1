import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export interface SlotMapping {
  id: string;
  user_id: string;
  slot_code: string;
  mapped_entity_type: string;
  mapped_entity_id: string;
  mapped_entity_label: string;
  priority_level: number;
  coach_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotLookupResult {
  entity_type: string;
  entity_id: string;
  entity_label: string;
  priority_level: number;
}

interface UseSlotMappingReturn {
  mappings: SlotMapping[];
  roleMappings: SlotMapping[];
  wellnessMappings: SlotMapping[];
  goalMappings: SlotMapping[];
  getSlotMapping: (slotCode: string) => SlotLookupResult | null;
  getSlotLabel: (slotCode: string) => string | null;
  getSlotsByType: (entityType: string) => SlotMapping[];
  loading: boolean;
  error: string | null;
  refreshMappings: () => Promise<void>;
  regenerateMappings: () => Promise<{ success: boolean; counts?: any; error?: string }>;
}

// ============================================
// HOOK
// ============================================

export function useSlotMapping(): UseSlotMappingReturn {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [mappings, setMappings] = useState<SlotMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  // Fetch mappings from database
  const fetchMappings = useCallback(async () => {
    if (!user?.id) {
      setMappings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from('0008-ap-user-slot-mappings')
        .select('*')
        .eq('user_id', user.id)
        .order('slot_code');

      if (fetchError) throw fetchError;

      setMappings(data || []);
    } catch (err: any) {
      console.error('Error fetching slot mappings:', err);
      setError(err.message || 'Failed to fetch slot mappings');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch when user loads
  useEffect(() => {
    if (user?.id) {
      fetchMappings();
    }
  }, [user?.id, fetchMappings]);

  // Filtered mappings by type
  const roleMappings = mappings.filter(m => m.mapped_entity_type === 'role');
  const wellnessMappings = mappings.filter(m => m.mapped_entity_type === 'wellness_domain');
  const goalMappings = mappings.filter(m => 
    m.mapped_entity_type === 'twelve_wk_goal' || 
    m.mapped_entity_type === 'custom_goal'
  );

  // Lookup: Get full mapping by slot code
  const getSlotMapping = useCallback((slotCode: string): SlotLookupResult | null => {
    const mapping = mappings.find(m => m.slot_code === slotCode);
    if (!mapping) return null;

    return {
      entity_type: mapping.mapped_entity_type,
      entity_id: mapping.mapped_entity_id,
      entity_label: mapping.mapped_entity_label,
      priority_level: mapping.priority_level,
    };
  }, [mappings]);

  // Lookup: Get just the label by slot code
  const getSlotLabel = useCallback((slotCode: string): string | null => {
    const mapping = mappings.find(m => m.slot_code === slotCode);
    return mapping?.mapped_entity_label || null;
  }, [mappings]);

  // Get all slots for a specific entity type
  const getSlotsByType = useCallback((entityType: string): SlotMapping[] => {
    return mappings.filter(m => m.mapped_entity_type === entityType);
  }, [mappings]);

  // Refresh mappings (re-fetch from DB)
  const refreshMappings = useCallback(async () => {
    await fetchMappings();
  }, [fetchMappings]);

  // Regenerate mappings (call database function)
  const regenerateMappings = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data, error: rpcError } = await supabase
        .rpc('auto_generate_slot_mappings', { p_user_id: user.id });

      if (rpcError) throw rpcError;

      await fetchMappings();

      return { 
        success: true, 
        counts: data?.[0] || null 
      };
    } catch (err: any) {
      console.error('Error regenerating slot mappings:', err);
      setError(err.message || 'Failed to regenerate slot mappings');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchMappings]);

  return {
    mappings,
    roleMappings,
    wellnessMappings,
    goalMappings,
    getSlotMapping,
    getSlotLabel,
    getSlotsByType,
    loading,
    error,
    refreshMappings,
    regenerateMappings,
  };
}

// Convenience hook: Single slot lookup
export function useSlotLabel(slotCode: string): {
  label: string | null;
  loading: boolean;
} {
  const { getSlotLabel, loading } = useSlotMapping();
  return {
    label: getSlotLabel(slotCode),
    loading,
  };
}