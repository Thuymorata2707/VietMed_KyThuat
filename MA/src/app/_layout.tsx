import { Stack, useSegments, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { FieldColors } from '@/constants/field-theme';

function RouteGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const inAuthGroup = segments[0] === '(auth)';
  useEffect(() => {
    if (loading) return;
    if (!user && !inAuthGroup) router.replace('/(auth)/login');
    else if (user && inAuthGroup) router.replace('/(app)');
  }, [user, loading, inAuthGroup]);
  if (loading) return <View style={{ alignItems: 'center', backgroundColor: FieldColors.canvas, flex: 1, justifyContent: 'center' }}><ActivityIndicator color={FieldColors.brand} /></View>;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(auth)" />
    <Stack.Screen name="(app)" />
    <Stack.Screen name="create-ticket" />
    <Stack.Screen name="work-create" />
    <Stack.Screen name="installation-form" />
    <Stack.Screen name="demo-create" />
    <Stack.Screen name="service-ticket-create" />
    <Stack.Screen name="customer-directory" />
    <Stack.Screen name="demo-center" />
    <Stack.Screen name="profile-edit" />
  </Stack>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black });
  if (!fontsLoaded) return <View style={{ alignItems: 'center', backgroundColor: FieldColors.canvas, flex: 1, justifyContent: 'center' }}><ActivityIndicator color={FieldColors.brand} /></View>;
  return <AuthProvider><RouteGate /></AuthProvider>;
}
