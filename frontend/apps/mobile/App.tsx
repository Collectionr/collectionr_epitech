import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { fontAssets } from '@/config/fonts';
import { MotionAccessibility } from '@/config/MotionAccessibility';
import { HomeScreen } from '@/screens';

import './global.css';

/** Racine de l'application mobile. */
export function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return (
    <>
      <MotionAccessibility />
      <HomeScreen />
      <StatusBar style="light" />
    </>
  );
}
