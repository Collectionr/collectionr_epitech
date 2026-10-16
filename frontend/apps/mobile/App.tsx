import { StatusBar } from 'expo-status-bar';

import { HomeScreen } from '@/screens';

import './global.css';

/** Racine de l'application mobile. */
export function App() {
  return (
    <>
      <HomeScreen />
      <StatusBar style="auto" />
    </>
  );
}
