import { Star, Users, Heart, Target, Calendar, FileText, Lightbulb, CheckSquare, CalendarClock, Flower2, AlertTriangle } from 'lucide-react-native';

export interface CompassWaypoint {
  id: string;
  angle: number;
  label: string;
  icon?: any;
  color: string;
  size: 'large' | 'small';
  type: 'navigation' | 'modal' | 'decorative';
  action?: 'navigate' | 'task-form' | 'journal-form';
  route?: string;
  routeParams?: Record<string, any>;
  formType?: 'task' | 'event' | 'depositIdea' | 'rose' | 'thorn' | 'reflection';
  labelPosition?: 'top' | 'right' | 'bottom' | 'left';
  radius?: number;
  showDot?: boolean;
}

export const COMPASS_WAYPOINTS: CompassWaypoint[] = [
  {
    id: 'aspirations',
    angle: 0,
    label: 'Aspirations',
    icon: Star,
    color: '#333333',
    size: 'large',
    type: 'navigation',
    action: 'navigate',
    route: '/(tabs)/dashboard',
    labelPosition: 'top',
    radius: 115,
    showDot: false,
  },
  {
    id: 'events',
    angle: 15,
    label: 'Events',
    icon: CalendarClock,
    color: '#8dc63f',
    size: 'small',
    type: 'modal',
    action: 'task-form',
    formType: 'event',
    radius: 118,
    showDot: true,
  },
  {
    id: 'deposit-ideas',
    angle: 30,
    label: 'Ideas',
    icon: Lightbulb,
    color: '#fbb040',
    size: 'small',
    type: 'modal',
    action: 'task-form',
    formType: 'depositIdea',
    radius: 118,
    showDot: true,
  },
  {
    id: 'reflection-library',
    angle: 45,
    label: 'History',
    icon: FileText,
    color: '#666666',
    size: 'small',
    type: 'navigation',
    action: 'navigate',
    route: '/reflections',
    routeParams: { tab: 'reflectionHistory' },
    radius: 118,
    showDot: true,
  },
  {
    id: 'reflections',
    angle: 60,
    label: 'Reflect',
    icon: FileText,
    color: '#bd5ca3',
    size: 'small',
    type: 'modal',
    action: 'journal-form',
    formType: 'reflection',
    radius: 118,
    showDot: true,
  },
  {
    id: 'wellness',
    angle: 90,
    label: 'Wellness\nBank',
    icon: Heart,
    color: '#333333',
    size: 'large',
    type: 'navigation',
    action: 'navigate',
    route: '/(tabs)/wellness',
    labelPosition: 'right',
    radius: 115,
    showDot: false,
  },
  {
    id: 'goals',
    angle: 180,
    label: 'Goal\nBank',
    icon: Target,
    color: '#333333',
    size: 'large',
    type: 'navigation',
    action: 'navigate',
    route: '/(tabs)/goals',
    labelPosition: 'bottom',
    radius: 115,
    showDot: false,
  },
  {
    id: 'roles',
    angle: 270,
    label: 'Role\nBank',
    icon: Users,
    color: '#333333',
    size: 'large',
    type: 'navigation',
    action: 'navigate',
    route: '/(tabs)/roles',
    labelPosition: 'left',
    radius: 115,
    showDot: false,
  },
  {
    id: 'thorns',
    angle: 300,
    label: 'Thorns',
    icon: AlertTriangle,
    color: '#c49a6c',
    size: 'small',
    type: 'modal',
    action: 'journal-form',
    formType: 'thorn',
    radius: 118,
    showDot: true,
  },
  {
    id: 'calendar',
    angle: 315,
    label: 'Calendar',
    icon: Calendar,
    color: '#666666',
    size: 'small',
    type: 'navigation',
    action: 'navigate',
    route: '/calendar',
    radius: 118,
    showDot: true,
  },
  {
    id: 'roses',
    angle: 330,
    label: 'Roses',
    icon: Flower2,
    color: '#00aeef',
    size: 'small',
    type: 'modal',
    action: 'journal-form',
    formType: 'rose',
    radius: 118,
    showDot: true,
  },
  {
    id: 'tasks',
    angle: 345,
    label: 'Tasks',
    icon: CheckSquare,
    color: '#009444',
    size: 'small',
    type: 'modal',
    action: 'task-form',
    formType: 'task',
    radius: 118,
    showDot: true,
  },
];

export const DECORATIVE_WAYPOINTS: CompassWaypoint[] = [
  {
    id: 'decorative-1',
    angle: 135,
    label: '',
    color: '#cccccc',
    size: 'small',
    type: 'decorative',
    radius: 106,
    showDot: true,
  },
  {
    id: 'decorative-2',
    angle: 225,
    label: '',
    color: '#cccccc',
    size: 'small',
    type: 'decorative',
    radius: 106,
    showDot: true,
  },
];

export const ALL_WAYPOINTS = [...COMPASS_WAYPOINTS, ...DECORATIVE_WAYPOINTS];

export const WAYPOINT_TOLERANCE = 20;
export const COMPASS_CENTER = { x: 144, y: 144 };
export const MIN_DRAG_DISTANCE = 20;
