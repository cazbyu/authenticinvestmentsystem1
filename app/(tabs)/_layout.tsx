import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { NorthStarIcon, WellnessIcon, GoalIcon, RoleIcon } from '@/components/icons/CustomIcons';

export default function TabLayout() {
  const { colors } = useTheme();
  const { resetTab } = useTabReset();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
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
          }
        },
      }}>
      
      {/* North Star - First tab */}
      <Tabs.Screen
        name="north-star"
        options={{
          title: 'North',
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
          tabBarIcon: ({ size, color }) => (
            <GoalIcon size={size} color={color} />
          ),
        }}
      />

      {/* Dashboard - Hidden from tab bar but still accessible via header compass */}
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null, // This hides it from the tab bar
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