import { Stack } from 'expo-router';
import { TouchableOpacity, Platform } from 'react-native';
import { Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
export default function NorthStarLayout() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ed1c24' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'North Star',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (typeof navigation.openDrawer === 'function') {
                  navigation.openDrawer();
                }
              }}
              style={{
                marginLeft: Platform.OS === 'web' ? 16 : 8,
                padding: 8,
              }}
            >
              <Menu size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="spark-library"
        options={{ title: 'Spark Library' }}
      />
    </Stack>
  );
}