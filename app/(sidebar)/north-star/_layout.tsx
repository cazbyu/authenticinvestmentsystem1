import { Stack } from 'expo-router';

export default function NorthStarLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="spark-library" />
    </Stack>
  );
}