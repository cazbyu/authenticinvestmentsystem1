import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TYPES
// ============================================

export interface SlotMapping {
  id: string;
  user_id: string;
  slot_code: string;           // R1, R2, WZ1, WZ3, G5, etc.
  mapped_entity_type: string;  // 'role', 'wellness_domain', 'twelve_wk_goal', 'custom_goal'
  mapped_entity_id: string;    // UUID of the actual entity
  mapped_entity_label: string; // "Father", "Physical", "Run Marathon"
  priority_level: number;      // 1, 2, 3... (lower = higher priority)
  coach_id?: string | null;    // If coach assigned this mapping
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
  // All mappings
  mappings: SlotMapping[];
  
  // Filtered by type
  roleMappings: SlotMapping[];
  wellnessMappings: SlotMapping[];
  goalMappings: SlotMapping[];
  
  // Lookup functions
  getSlotMapping: (slotCode: string) => SlotLookupResult | null;
  getSlotLabel: (slotCode: string) => string | null;
  getSlotsByType: (entityType: string) => SlotMapping[];
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshMappings: () => Promise<void>;
  regenerateMappings: () => Promise<{ success: boolean; counts?: any; error?: string }>;
}

// ============================================
// HOOK
// ============================================

export function useSlotMapping(): UseSlotMappingReturn {
  const { user } = useAuth();
  const [mappings, setMappings] = useState<SlotMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------
  // Fetch mappings from database
  // ----------------------------------------
  const fetchMappings = useCallback(async () => {
    if (!user?.id) {
      setMappings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

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

  // ----------------------------------------
  // Initial fetch on mount
  // ----------------------------------------
  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  // ----------------------------------------
  // Filtered mappings by type
  // ----------------------------------------
  const roleMappings = mappings.filter(m => m.mapped_entity_type === 'role');
  const wellnessMappings = mappings.filter(m => m.mapped_entity_type === 'wellness_domain');
  const goalMappings = mappings.filter(m => 
    m.mapped_entity_type === 'twelve_wk_goal' || 
    m.mapped_entity_type === 'custom_goal'
  );

  // ----------------------------------------
  // Lookup: Get full mapping by slot code
  // ----------------------------------------
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

  // ----------------------------------------
  // Lookup: Get just the label by slot code
  // ----------------------------------------
  const getSlotLabel = useCallback((slotCode: string): string | null => {
    const mapping = mappings.find(m => m.slot_code === slotCode);
    return mapping?.mapped_entity_label || null;
  }, [mappings]);

  // ----------------------------------------
  // Get all slots for a specific entity type
  // ----------------------------------------
  const getSlotsByType = useCallback((entityType: string): SlotMapping[] => {
    return mappings.filter(m => m.mapped_entity_type === entityType);
  }, [mappings]);

  // ----------------------------------------
  // Refresh mappings (re-fetch from DB)
  // ----------------------------------------
  const refreshMappings = useCallback(async () => {
    await fetchMappings();
  }, [fetchMappings]);

  // ----------------------------------------
  // Regenerate mappings (call database function)
  // ----------------------------------------
  const regenerateMappings = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('auto_generate_slot_mappings', { p_user_id: user.id });

      if (rpcError) throw rpcError;

      // Refresh local state after regeneration
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

  // ----------------------------------------
  // Return
  // ----------------------------------------
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

// ============================================
// CONVENIENCE HOOK: Single slot lookup
// ============================================

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