import { Tabs, usePathname, useRouter } from 'expo-router';
import { ChartBar as BarChart3, Heart, Target, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { colors, isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

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
        tabBarItemStyle: {
          backgroundColor: 'transparent',
        },
        tabBarPressColor: 'transparent',
        tabBarPressOpacity: 1,
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Actions & Ideas',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Always navigate to dashboard, even if already on the tab
            e.preventDefault();
            router.push('/(tabs)/dashboard');
          },
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
        listeners={{
          tabPress: (e) => {
            // Always navigate to roles, even if already on the tab
            e.preventDefault();
            router.push('/(tabs)/roles');
          },
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
        listeners={{
          tabPress: (e) => {
            // Always navigate to wellness, even if already on the tab
            e.preventDefault();
            router.push('/(tabs)/wellness');
          },
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
        listeners={{
          tabPress: (e) => {
            // Always navigate to goals, even if already on the tab
            e.preventDefault();
            router.push('/(tabs)/goals');
          },
        }}
      />
    </Tabs>
  );
}