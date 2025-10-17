import { Tabs } from 'expo-router';
import { ChartBar as BarChart3, Heart, Target, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabReset } from '@/contexts/TabResetContext';

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
          title: 'Actions & Ideas',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="roles"
        options={{
          title: 'Role Bank',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness Bank',
          tabBarIcon: ({ size, color }) => (
            <Heart size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goal Bank',
          tabBarIcon: ({ size, color }) => (
            <Target size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="goalsReducer"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
