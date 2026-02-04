// Activity Configuration for Speed Dial FAB
// Each activity defines its appearance and form defaults

import { ImageSourcePropType } from 'react-native';

export type ActivityType = 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection';

export interface ActivityConfig {
  key: ActivityType;
  label: string;
  color: string;
  description: string;
  // Icon can be either a Lucide icon name or an image source
  iconType: 'lucide' | 'image';
  iconName?: string; // For Lucide icons
  imageSource?: ImageSourcePropType; // For PNG images
  formDefaults: {
    type: 'task' | 'event' | 'reflection' | 'depositIdea';
    reflectionMode?: 'rose' | 'thorn' | 'reflection';
    isAnytime?: boolean;
    // Add other defaults as needed
  };
}

// Image imports - update these paths to match your project structure
const IMAGES = {
  rose: require('@/assets/images/rose.png'),
  thorn: require('@/assets/images/thorn.png'),
  depositIdea: require('@/assets/images/deposit-idea.png'),
  reflection: require('@/assets/images/reflections-72.png'),
};

export const ACTIVITY_CONFIGS: Record<ActivityType, ActivityConfig> = {
  task: {
    key: 'task',
    label: 'Task',
    color: '#3b82f6', // Blue
    description: 'Create an action item to complete',
    iconType: 'lucide',
    iconName: 'CheckSquare',
    formDefaults: {
      type: 'task',
    },
  },
  event: {
    key: 'event',
    label: 'Event',
    color: '#22c55e', // Green
    description: 'Schedule a time-based activity',
    iconType: 'lucide',
    iconName: 'Calendar',
    formDefaults: {
      type: 'event',
    },
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    color: '#ec4899', // Pink
    description: 'Celebrate a small win or positive moment from today',
    iconType: 'image',
    imageSource: IMAGES.rose,
    formDefaults: {
      type: 'reflection',
      reflectionMode: 'rose',
      isAnytime: true,
    },
  },
  thorn: {
    key: 'thorn',
    label: 'Thorn',
    color: '#ef4444', // Red
    description: 'Acknowledge a challenge or difficulty you faced',
    iconType: 'image',
    imageSource: IMAGES.thorn,
    formDefaults: {
      type: 'reflection',
      reflectionMode: 'thorn',
      isAnytime: true,
    },
  },
  depositIdea: {
    key: 'depositIdea',
    label: 'Deposit Idea',
    color: '#f59e0b', // Yellow/Amber
    description: 'Capture an idea to explore later',
    iconType: 'image',
    imageSource: IMAGES.depositIdea,
    formDefaults: {
      type: 'depositIdea',
    },
  },
  reflection: {
    key: 'reflection',
    label: 'Reflection',
    color: '#9333ea', // Purple
    description: 'Record a thought, insight, or observation',
    iconType: 'image',
    imageSource: IMAGES.reflection,
    formDefaults: {
      type: 'reflection',
      reflectionMode: 'reflection',
      isAnytime: true,
    },
  },
};

// Order for display in Speed Dial (bottom to top)
export const ACTIVITY_ORDER: ActivityType[] = [
  'task',
  'event', 
  'rose',
  'thorn',
  'depositIdea',
  'reflection',
];

// Get config by key
export const getActivityConfig = (key: ActivityType): ActivityConfig => {
  return ACTIVITY_CONFIGS[key];
};