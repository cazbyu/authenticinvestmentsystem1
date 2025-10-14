import { Tabs, usePathname, useRouter } from 'expo-router';
import { ChartBar as BarChart3, Heart, Target, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { colors, isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const handleTabPress = (tabRoute: string) => {
    // Check if we're already on this tab
    const isOnThisTab = pathname.startsWith(tabRoute);

    if (isOnThisTab) {
      // If already on this tab, use replace to force navigation and trigger focus events
      router.replace(tabRoute);
    } else {
      // If on a different tab, navigate normally
      router.push(tabRoute);
    }
  };

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
            e.preventDefault();
            handleTabPress('/(tabs)/dashboard');
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
            e.preventDefault();
            handleTabPress('/(tabs)/roles');
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
            e.preventDefault();
            handleTabPress('/(tabs)/wellness');
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
            e.preventDefault();
            handleTabPress('/(tabs)/goals');
          },
        }}
      />
    </Tabs>
  );
}