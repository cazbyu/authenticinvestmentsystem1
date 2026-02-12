/**
 * Chat Bubble v9 - Constants
 * Capture types, energy reasons, ritual metadata
 */

export const CAPTURE_TYPES = {
  task: {
    label: 'Task',
    icon: '✓',
    color: '#4A90D9',
    desc: 'An action to take',
    labelField: 'WHAT NEEDS TO BE DONE',
    placeholder: 'Describe the task...',
  },
  event: {
    label: 'Event',
    icon: '📅',
    color: '#E8963A',
    desc: 'An action with a date & time',
    labelField: "WHAT'S HAPPENING",
    placeholder: 'Describe the event...',
  },
  rose: {
    label: 'Rose',
    icon: '🌹',
    color: '#E91E63',
    desc: 'Something positive that happened',
    labelField: 'WHAT WENT WELL',
    placeholder: 'What went right today...',
  },
  thorn: {
    label: 'Thorn',
    icon: '🌵',
    color: '#795548',
    desc: 'A challenge or difficulty',
    labelField: 'WHAT WAS HARD',
    placeholder: 'What was difficult or frustrating...',
  },
  reflection: {
    label: 'Reflection',
    icon: '💭',
    color: '#5C6BC0',
    desc: 'A thought worth recording',
    labelField: 'YOUR REFLECTION',
    placeholder: "What's on your mind...",
  },
  deposit_idea: {
    label: 'Deposit Idea',
    icon: '💡',
    color: '#FFC107',
    desc: 'A someday intention — no deadline',
    labelField: 'YOUR IDEA',
    placeholder: 'An idea to revisit later...',
  },
  brain_dump: {
    label: 'Brain Dump',
    icon: '🧠',
    color: '#7B68AE',
    desc: 'End-of-day mental clearing',
    labelField: 'GET IT ALL OUT',
    placeholder: 'Dump everything here — no structure needed...',
  },
} as const;

export type CaptureType = keyof typeof CAPTURE_TYPES;

export const RITUAL_CAPTURE_TYPES: Record<string, CaptureType[]> = {
  weekly: ['task', 'event', 'rose', 'thorn', 'reflection', 'deposit_idea'],
  morning: ['task', 'event', 'rose', 'thorn', 'reflection', 'deposit_idea'],
  evening: [
    'task',
    'event',
    'rose',
    'thorn',
    'reflection',
    'deposit_idea',
    'brain_dump',
  ],
};

export const ENERGY_REASONS = {
  1: [
    { id: 'sick', icon: '🤒', label: 'Sick / unwell', desc: 'Body needs rest' },
    { id: 'exhausted', icon: '😩', label: 'Exhausted', desc: 'Running on fumes' },
    {
      id: 'emotional',
      icon: '💔',
      label: 'Emotionally heavy',
      desc: 'Heart is carrying a lot',
    },
    {
      id: 'slow_start',
      icon: '🐌',
      label: 'Slow start',
      desc: 'Just not feeling it yet',
    },
  ],
  2: [
    { id: 'steady', icon: '⚡', label: 'Steady', desc: 'Got enough to work with' },
    {
      id: 'distracted',
      icon: '🎯',
      label: 'Distracted',
      desc: "Energy's there, focus isn't",
    },
    {
      id: 'recovering',
      icon: '🔋',
      label: 'Recovering',
      desc: 'Getting better, not 100%',
    },
    {
      id: 'mixed',
      icon: '🌤️',
      label: 'Mixed bag',
      desc: "Some things feel good, some don't",
    },
  ],
  3: [
    { id: 'fired_up', icon: '🔥', label: 'Fired up', desc: 'Ready to move mountains' },
    {
      id: 'rested',
      icon: '😊',
      label: 'Well rested',
      desc: 'Full tank from good rest',
    },
    {
      id: 'motivated',
      icon: '🚀',
      label: 'Motivated',
      desc: 'Clear purpose today',
    },
    {
      id: 'grateful',
      icon: '🙏',
      label: 'Grateful',
      desc: 'Good energy from a full heart',
    },
  ],
} as const;

export const FUEL_LEVELS = [
  {
    level: 1,
    label: 'Low',
    icon: '🪫',
    color: '#E53935',
    colorBg: '#FFEBEE',
    colorBorder: '#EF9A9A',
    desc: 'Running low',
  },
  {
    level: 2,
    label: 'Moderate',
    icon: '⚡',
    color: '#F57F17',
    colorBg: '#FFF8E1',
    colorBorder: '#FFE082',
    desc: 'Enough to work with',
  },
  {
    level: 3,
    label: 'Full',
    icon: '🚀',
    color: '#2E7D32',
    colorBg: '#E8F5E9',
    colorBorder: '#A5D6A7',
    desc: 'Ready to go',
  },
] as const;

export const WELLNESS_ICONS: Record<string, string> = {
  Physical: '💪',
  Emotional: '❤️',
  Intellectual: '🧠',
  Social: '🤝',
  Spiritual: '🙏',
  Financial: '💰',
  Recreational: '🎮',
  Community: '🏘️',
};

export const RITUAL_META = {
  weekly: { icon: '🧭', label: 'Weekly Alignment · Step 5 of 6', color: '#4A90D9' },
  morning: { icon: '☀️', label: 'Morning Spark', color: '#E8963A' },
  evening: { icon: '🌙', label: 'Evening Review', color: '#7B68AE' },
} as const;

export type RitualType = 'weekly' | 'morning' | 'evening' | 'guide';
