import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { fontAssets } from '@/config/fonts';
import { MotionAccessibility } from '@/config/MotionAccessibility';
import { HomeScreen } from '@/screens';
import { TokensPreviewScreen } from '@/screens/TokensPreviewScreen';

import './global.css';

/** Racine de l'application mobile. */
export function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return (
    <>
      <MotionAccessibility />
      {__DEV__ ? <TokensPreviewScreen /> : <HomeScreen />}
      <StatusBar style="light" />
    </>
  );
}
