import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { fontAssets } from '@/config/fonts';
import { MotionAccessibility } from '@/config/MotionAccessibility';
import { HomeScreen } from '@/screens';
import type * as TokensPreviewModule from '@/screens/TokensPreviewScreen';

import './global.css';

void SplashScreen.preventAutoHideAsync();

// Metro élimine cette branche en production et sans activation explicite.
const EntryScreen =
  __DEV__ && process.env.EXPO_PUBLIC_TOKENS_PREVIEW === 'true'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- Import conditionnel éliminé du bundle de production par Metro.
      (require('./src/screens/TokensPreviewScreen') as typeof TokensPreviewModule)
        .TokensPreviewScreen
    : HomeScreen;

/** Racine de l'application mobile. */
export function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;

  // Ne pas afficher les variantes qui référencent des fichiers de fontes indisponibles.
  if (fontError)
    return (
      <View className="flex-1 items-center justify-center bg-ecrin p-space-24">
        <Text accessibilityRole="alert" className="text-archive">
          Impossible de charger les polices. Relancez l’application.
        </Text>
        <StatusBar style="light" />
      </View>
    );

  return (
    <>
      <MotionAccessibility />
      <EntryScreen />
      <StatusBar style="light" />
    </>
  );
}
