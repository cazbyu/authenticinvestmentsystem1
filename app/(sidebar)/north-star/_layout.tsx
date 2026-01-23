import { Stack } from 'expo-router';

export default function NorthStarLayout() {
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
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="spark-library"
        options={{ title: 'Spark Library' }}
      />
    </Stack>
  );
}
