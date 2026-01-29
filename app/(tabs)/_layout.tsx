import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { useHeaderColor, TAB_COLORS } from '@/contexts/HeaderColorContext';
import { NorthStarIcon, WellnessIcon, GoalIcon, RoleIcon } from '@/components/icons/CustomIcons';

export default function TabLayout() {
  const { colors } = useTheme();
  const { resetTab } = useTabReset();
  const { setActiveTab } = useHeaderColor();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 85,
          paddingBottom: 25,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
      screenListeners={{
        tabPress: (e) => {
          const tabName = e.target?.split('-')[0];
          console.log('[TabLayout] Tab pressed:', tabName, 'Full target:', e.target);
          if (tabName) {
            resetTab(tabName);
            setActiveTab(tabName);
          }
        },
        focus: (e) => {
          const routeName = e.target?.split('-')[0];
          if (routeName) {
            setActiveTab(routeName);
          }
        },
      }}>
      
      {/* North Star - First tab */}
      <Tabs.Screen
        name="north-star"
        options={{
          title: 'North',
          tabBarActiveTintColor: TAB_COLORS['north-star'],
          tabBarIcon: ({ size, color }) => (
            <NorthStarIcon size={size} color={color} />
          ),
        }}
      />

      {/* Role Bank */}
      <Tabs.Screen
        name="roles"
        options={{
          title: 'Roles',
          tabBarActiveTintColor: TAB_COLORS['roles'],
          tabBarIcon: ({ size, color }) => (
            <RoleIcon size={size} color={color} />
          ),
        }}
      />

      {/* Wellness Bank */}
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          tabBarActiveTintColor: TAB_COLORS['wellness'],
          tabBarIcon: ({ size, color }) => (
            <WellnessIcon size={size} color={color} />
          ),
        }}
      />

      {/* Goal Bank */}
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarActiveTintColor: TAB_COLORS['goals'],
          tabBarIcon: ({ size, color }) => (
            <GoalIcon size={size} color={color} />
          ),
        }}
      />

      {/* Dashboard - Hidden from tab bar but still accessible via header compass */}
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null,
        }}
      />

      {/* Index redirect - Hidden */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}