/**
 * Replaces placeholders in coaching prompts with actual user data
 * 
 * Supported placeholders:
 * - {role_name} → Current role label from slot mappings
 * - {kr_name} → Key relationship name (random from role's relationships)
 * - {goal_name} → Current goal label from slot mappings
 * - {wellness_zone} → Current wellness zone label from slot mappings
 */

export interface InjectionContext {
  // Current slot being focused (e.g., 'R1', 'G3', 'WZ5')
  currentSlot?: string | null;
  
  // Slot mappings from useSlotMapping hook
  slotMappings?: Array<{
    slot_code: string;
    mapped_entity_type: string;
    mapped_entity_id: string | null;
    mapped_entity_label: string | null;
  }>;
  
  // Key relationships (optional, for {kr_name})
  keyRelationships?: Array<{
    id: string;
    name: string;
    role_id: string | null;
  }>;
  
  // Fallback values if no mapping found
  fallbacks?: {
    role_name?: string;
    kr_name?: string;
    goal_name?: string;
    wellness_zone?: string;
  };
}

const DEFAULT_FALLBACKS = {
  role_name: 'this role',
  kr_name: 'someone you care about',
  goal_name: 'your goal',
  wellness_zone: 'this area',
};

export function injectPromptVariables(
  template: string,
  context: InjectionContext
): string {
  const { slotMappings = [], keyRelationships = [], currentSlot, fallbacks = {} } = context;
  const mergedFallbacks = { ...DEFAULT_FALLBACKS, ...fallbacks };
  
  let result = template;
  
  // Replace {role_name}
  if (result.includes('{role_name}')) {
    const roleLabel = getRoleLabel(currentSlot, slotMappings);
    result = result.replace(/{role_name}/g, roleLabel || mergedFallbacks.role_name);
  }
  
  // Replace {kr_name}
  if (result.includes('{kr_name}')) {
    const krName = getKeyRelationshipName(currentSlot, slotMappings, keyRelationships);
    result = result.replace(/{kr_name}/g, krName || mergedFallbacks.kr_name);
  }
  
  // Replace {goal_name}
  if (result.includes('{goal_name}')) {
    const goalLabel = getGoalLabel(currentSlot, slotMappings);
    result = result.replace(/{goal_name}/g, goalLabel || mergedFallbacks.goal_name);
  }
  
  // Replace {wellness_zone}
  if (result.includes('{wellness_zone}')) {
    const zoneLabel = getWellnessZoneLabel(currentSlot, slotMappings);
    result = result.replace(/{wellness_zone}/g, zoneLabel || mergedFallbacks.wellness_zone);
  }
  
  return result;
}

/**
 * Get role label from slot mappings
 */
function getRoleLabel(
  currentSlot: string | null | undefined,
  slotMappings: InjectionContext['slotMappings']
): string | null {
  if (!slotMappings || slotMappings.length === 0) return null;
  
  // If current slot is a role slot (R1-R20), use it
  if (currentSlot?.startsWith('R')) {
    const mapping = slotMappings.find(m => m.slot_code === currentSlot);
    if (mapping?.mapped_entity_label) return mapping.mapped_entity_label;
  }
  
  // Otherwise, pick a random role from available mappings
  const roleMappings = slotMappings.filter(
    m => m.slot_code.startsWith('R') && m.mapped_entity_label
  );
  
  if (roleMappings.length > 0) {
    const randomIndex = Math.floor(Math.random() * roleMappings.length);
    return roleMappings[randomIndex].mapped_entity_label;
  }
  
  return null;
}

/**
 * Get key relationship name
 * Tries to find a relationship linked to the current role
 */
function getKeyRelationshipName(
  currentSlot: string | null | undefined,
  slotMappings: InjectionContext['slotMappings'],
  keyRelationships: InjectionContext['keyRelationships']
): string | null {
  if (!keyRelationships || keyRelationships.length === 0) return null;
  
  // If we have a current role slot, try to find relationships for that role
  if (currentSlot?.startsWith('R') && slotMappings) {
    const roleMapping = slotMappings.find(m => m.slot_code === currentSlot);
    if (roleMapping?.mapped_entity_id) {
      const roleRelationships = keyRelationships.filter(
        kr => kr.role_id === roleMapping.mapped_entity_id
      );
      if (roleRelationships.length > 0) {
        const randomIndex = Math.floor(Math.random() * roleRelationships.length);
        return roleRelationships[randomIndex].name;
      }
    }
  }
  
  // Fallback: pick any random key relationship
  const randomIndex = Math.floor(Math.random() * keyRelationships.length);
  return keyRelationships[randomIndex].name;
}

/**
 * Get goal label from slot mappings
 */
function getGoalLabel(
  currentSlot: string | null | undefined,
  slotMappings: InjectionContext['slotMappings']
): string | null {
  if (!slotMappings || slotMappings.length === 0) return null;
  
  // If current slot is a goal slot (G1-G24), use it
  if (currentSlot?.startsWith('G')) {
    const mapping = slotMappings.find(m => m.slot_code === currentSlot);
    if (mapping?.mapped_entity_label) return mapping.mapped_entity_label;
  }
  
  // Otherwise, pick a random goal from available mappings
  const goalMappings = slotMappings.filter(
    m => m.slot_code.startsWith('G') && m.mapped_entity_label
  );
  
  if (goalMappings.length > 0) {
    const randomIndex = Math.floor(Math.random() * goalMappings.length);
    return goalMappings[randomIndex].mapped_entity_label;
  }
  
  return null;
}

/**
 * Get wellness zone label from slot mappings
 */
function getWellnessZoneLabel(
  currentSlot: string | null | undefined,
  slotMappings: InjectionContext['slotMappings']
): string | null {
  if (!slotMappings || slotMappings.length === 0) return null;
  
  // If current slot is a wellness slot (WZ1-WZ8), use it
  if (currentSlot?.startsWith('WZ')) {
    const mapping = slotMappings.find(m => m.slot_code === currentSlot);
    if (mapping?.mapped_entity_label) return mapping.mapped_entity_label;
  }
  
  // Otherwise, pick a random wellness zone from available mappings
  const wellnessMappings = slotMappings.filter(
    m => m.slot_code.startsWith('WZ') && m.mapped_entity_label
  );
  
  if (wellnessMappings.length > 0) {
    const randomIndex = Math.floor(Math.random() * wellnessMappings.length);
    return wellnessMappings[randomIndex].mapped_entity_label;
  }
  
  return null;
}