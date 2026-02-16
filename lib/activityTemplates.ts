// Template type constants for activity log detail tracking
export const TEMPLATE_TYPES = ['workout', 'financial', 'measurement', 'journal', 'checklist'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export interface TemplateFieldDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean';
  required?: boolean;
  placeholder?: string;
  options?: string[];       // For 'select' type — overridden by data_schema categories when categoryField matches
  unit?: string;            // Display unit label (e.g., '$', 'lbs')
  defaultValue?: any;
}

export interface TemplateConfig {
  type: TemplateType;
  label: string;
  icon: string;             // lucide icon name
  description: string;
  fields: TemplateFieldDef[];
  categoryField?: string;   // Which field key uses data_schema.categories
  extractPrimaryMetric: (details: Record<string, any>) => number | null;
}

export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  workout: {
    type: 'workout',
    label: 'Workout',
    icon: 'Dumbbell',
    description: 'Track sets, reps, and weight by muscle group',
    fields: [
      { key: 'category', label: 'Category', type: 'select', required: true, options: [] },
      { key: 'sets', label: 'Sets', type: 'number', required: true, placeholder: '3' },
      { key: 'reps', label: 'Reps', type: 'number', required: true, placeholder: '10' },
      { key: 'weight', label: 'Weight', type: 'number', placeholder: '135' },
      { key: 'weight_unit', label: 'Unit', type: 'select', options: ['lbs', 'kg'], defaultValue: 'lbs' },
    ],
    categoryField: 'category',
    extractPrimaryMetric: (d) => {
      const sets = Number(d.sets) || 0;
      const reps = Number(d.reps) || 0;
      const weight = Number(d.weight) || 1;
      return sets * reps * weight;
    },
  },
  financial: {
    type: 'financial',
    label: 'Financial',
    icon: 'DollarSign',
    description: 'Track monetary amounts and transactions',
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00', unit: '$' },
      { key: 'category', label: 'Category', type: 'select', options: [] },
    ],
    categoryField: 'category',
    extractPrimaryMetric: (d) => Number(d.amount) || 0,
  },
  measurement: {
    type: 'measurement',
    label: 'Measurement',
    icon: 'Ruler',
    description: 'Track a single numeric measurement',
    fields: [
      { key: 'value', label: 'Value', type: 'number', required: true, placeholder: '0' },
      { key: 'unit', label: 'Unit', type: 'text', placeholder: 'lbs, miles, etc.' },
    ],
    extractPrimaryMetric: (d) => Number(d.value) || 0,
  },
  journal: {
    type: 'journal',
    label: 'Journal',
    icon: 'BookOpen',
    description: 'Free-form text entry',
    fields: [
      { key: 'entry', label: 'Entry', type: 'text', required: true, placeholder: 'Write your thoughts...' },
    ],
    extractPrimaryMetric: () => 1,
  },
  checklist: {
    type: 'checklist',
    label: 'Checklist',
    icon: 'ListChecks',
    description: 'Track sub-items with checkboxes',
    fields: [],
    extractPrimaryMetric: (d) => {
      const items = d.items || [];
      return items.filter((item: any) => item.done).length;
    },
  },
};

/** Get resolved fields for a template, merging data_schema categories into select options */
export function getResolvedFields(
  templateType: TemplateType,
  dataSchema?: { categories?: string[]; checklist_items?: string[] } | null
): TemplateFieldDef[] {
  const config = TEMPLATE_CONFIGS[templateType];
  if (!config) return [];

  if (templateType === 'checklist') {
    // Support both checklist_items (correct) and categories (legacy save bug)
    const items = dataSchema?.checklist_items || dataSchema?.categories || [];
    return items.map((item) => ({
      key: `item_${item}`,
      label: item,
      type: 'boolean' as const,
      defaultValue: false,
    }));
  }

  return config.fields.map((field) => {
    if (config.categoryField && field.key === config.categoryField && dataSchema?.categories?.length) {
      return { ...field, options: dataSchema.categories };
    }
    return field;
  });
}

/** Build details object for checklist template from form values */
export function buildChecklistDetails(
  formValues: Record<string, any>,
  checklistItems: string[]
): { items: Array<{ label: string; done: boolean }> } {
  return {
    items: checklistItems.map((item) => ({
      label: item,
      done: !!formValues[`item_${item}`],
    })),
  };
}
