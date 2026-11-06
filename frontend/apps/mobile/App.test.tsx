import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { App } from './App';

jest.mock('./global.css', () => ({}));
jest.mock('@/config/fonts', () => ({ fontAssets: {} }));
jest.mock('@/config/MotionAccessibility', () => ({ MotionAccessibility: () => null }));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  hideAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

describe('démarrage mobile et chargement des fontes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('garde le splash pendant le chargement des fontes', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    const view = await render(<App />);
    expect(view.toJSON()).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('ouvre l’accueil habituel après chargement, sans démonstration par défaut', async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<App />);
    expect(screen.getByText('Collectionr')).toBeTruthy();
    expect(screen.queryByText('Vérification des tokens')).toBeNull();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalled());
  });

  it('affiche une erreur lisible sans fonte personnalisée ni crash', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('Chargement impossible')]);
    await render(<App />);
    const message = screen.getByRole('alert');
    expect(message.props.children).toContain('Impossible de charger les polices');
    expect(message.props.className).toBe('text-archive');
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalled());
  });
});
