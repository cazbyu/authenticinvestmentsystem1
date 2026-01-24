import { Tabs } from 'expo-router';
import { Compass } from 'lucide-react-native';
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
          // Extract the tab name from the event target
          // The target format is typically "dashboard-tab-0", "roles-tab-0", etc.
          const tabName = e.target?.split('-')[0];

          console.log('[TabLayout] Tab pressed:', tabName, 'Full target:', e.target);

          // Call the reset handler for the pressed tab
          if (tabName) {
            resetTab(tabName);
          }
        },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Compass',
          tabBarIcon: ({ size, color }) => (
            <Compass size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="roles"
        options={{
          title: 'Role Bank',
          tabBarIcon: ({ size, color }) => (
            <RoleIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness Bank',
          tabBarIcon: ({ size, color }) => (
            <WellnessIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goal Bank',
          tabBarIcon: ({ size, color }) => (
            <GoalIcon size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
