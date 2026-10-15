import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, I18nManager, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FamilyProvider, useFamily } from '../family';
import { C } from '../theme';
import { T } from '../ui';

// Layout is mirrored by hand (row-reverse + right alignment); stop the OS from flipping it again.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

function Gate() {
  const { status } = useFamily();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <T w="bold" size={34} color="#fff" align="center">مصاريفي</T>
        <ActivityIndicator color={C.oasisLight} />
      </View>
    );
  }
  const signedIn = status === 'ready';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_left' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings/family" />
        <Stack.Screen name="settings/budgets" />
        <Stack.Screen name="settings/categories" />
        <Stack.Screen name="settings/category/[id]" />
        <Stack.Screen name="settings/fixed" />
        <Stack.Screen name="settings/account" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Plex400: IBMPlexSansArabic_400Regular,
    Plex500: IBMPlexSansArabic_500Medium,
    Plex600: IBMPlexSansArabic_600SemiBold,
    Plex700: IBMPlexSansArabic_700Bold,
    ...MaterialCommunityIcons.font,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return (
    <SafeAreaProvider>
      <FamilyProvider>
        <StatusBar style="auto" />
        <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' } : { flex: 1 }}>
          <Gate />
        </View>
      </FamilyProvider>
    </SafeAreaProvider>
  );
}
