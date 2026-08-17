import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'WEVSOCIAL', headerShown: false }} />
      <Stack.Screen name="mini-app/[id]" options={{ title: 'Mini App', headerShown: false }} />
    </Stack>
  );
}
