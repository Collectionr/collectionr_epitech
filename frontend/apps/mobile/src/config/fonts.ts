import { SchibstedGrotesk_400Regular } from '@expo-google-fonts/schibsted-grotesk/400Regular';
import { SchibstedGrotesk_500Medium } from '@expo-google-fonts/schibsted-grotesk/500Medium';
import { SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk/700Bold';
import { SchibstedGrotesk_800ExtraBold } from '@expo-google-fonts/schibsted-grotesk/800ExtraBold';
import { SchibstedGrotesk_900Black } from '@expo-google-fonts/schibsted-grotesk/900Black';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';

import { fonts } from '@shared/tokens';

/** Sept fichiers embarqués uniquement, sans téléchargement de polices au démarrage. */
export const fontAssets = {
  [fonts.sans.native[400]]: SchibstedGrotesk_400Regular,
  [fonts.sans.native[500]]: SchibstedGrotesk_500Medium,
  [fonts.sans.native[700]]: SchibstedGrotesk_700Bold,
  [fonts.sans.native[800]]: SchibstedGrotesk_800ExtraBold,
  [fonts.sans.native[900]]: SchibstedGrotesk_900Black,
  [fonts.mono.native[500]]: IBMPlexMono_500Medium,
  [fonts.mono.native[600]]: IBMPlexMono_600SemiBold,
};
