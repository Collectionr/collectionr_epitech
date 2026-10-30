import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, motion, opacity, spacing, typography } from '@shared/tokens';

const colorClasses = {
  ecrin: 'bg-ecrin',
  'ecrin-elevated': 'bg-ecrin-elevated',
  archive: 'bg-archive',
  signal: 'bg-signal',
  acier: 'bg-acier',
  'acier-texte': 'bg-acier-texte',
  alerte: 'bg-alerte',
  blanc: 'bg-blanc',
  lisere: 'bg-lisere',
} satisfies Record<keyof typeof colors, string>;

const textClasses = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  body: 'text-body',
  caption: 'text-caption',
  data: 'text-data',
  'button-label': 'text-button-label',
} satisfies Record<keyof typeof typography, string>;

const spacingClasses = {
  'space-4': 'w-space-4',
  'space-8': 'w-space-8',
  'space-12': 'w-space-12',
  'space-16': 'w-space-16',
  'space-24': 'w-space-24',
  'space-32': 'w-space-32',
  'space-48': 'w-space-48',
  'space-64': 'w-space-64',
} satisfies Record<keyof typeof spacing, string>;

const durationClasses = {
  instant: 'duration-instant',
  snap: 'duration-snap',
  signature: 'duration-signature',
  sequence: 'duration-sequence',
} satisfies Record<keyof typeof motion.duration, string>;

// Conversion du token CSS commun vers l'API Reanimated, sans recopier les coefficients.
const easingCoordinates = motion.easing
  .slice(motion.easing.indexOf('(') + 1, -1)
  .split(',')
  .map(Number);
const [x1, y1, x2, y2] = easingCoordinates;
if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
  throw new Error('Le token motion.easing doit définir quatre coefficients.');
}
const nativeEasing = Easing.bezier(x1, y1, x2, y2);

/** Démonstration de Reanimated : respecte la configuration globale de MotionAccessibility. */
function ReanimatedPreview() {
  const value = useSharedValue<number>(opacity.disabled);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: value.get() }));
  const [active, setActive] = useState(false);

  return (
    <View className="gap-space-12">
      <Pressable
        accessibilityRole="button"
        className="focus-indicator border border-acier-texte p-space-12"
        onPress={() => {
          const next = !active;
          setActive(next);
          value.set(
            withTiming(next ? 1 : opacity.disabled, {
              duration: motion.duration.sequence,
              easing: nativeEasing,
            }),
          );
        }}
      >
        <Text className="text-button-label text-archive">Basculer Reanimated</Text>
      </Pressable>
      <Animated.View
        style={[
          {
            width: spacing['space-64'],
            height: spacing['space-32'],
            backgroundColor: colors.archive,
          },
          animatedStyle,
        ]}
      />
      <Text className="text-caption text-acier-texte">
        Reanimated · sequence · {motion.duration.sequence} ms
      </Text>
    </View>
  );
}

/** Banc de vérification natif, affiché uniquement en développement. Aucun atome produit. */
export function TokensPreviewScreen() {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-ecrin">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-space-32 p-space-16"
        >
          <View className="gap-space-12">
            <Text accessibilityRole="header" className="text-h2 text-archive">
              Vérification des tokens
            </Text>
            <Text className="text-body text-archive">
              COLLR-573 · écran de développement. Examiner chaque section ; aucun résultat n’est
              validé automatiquement.
            </Text>
            <Text className="text-data text-acier-texte">
              Largeur native : {Math.round(width)} dp
            </Text>
          </View>

          <View className="gap-space-16">
            <Text accessibilityRole="header" className="text-h2 text-archive">
              Palette
            </Text>
            {Object.entries(colors).map(([name, color]) => (
              <View key={name} className="flex-row items-center gap-space-12">
                <View
                  className={`h-space-48 w-space-48 border border-lisere ${colorClasses[name as keyof typeof colors]}`}
                />
                <View className="flex-1">
                  <Text className="text-caption text-archive">{name}</Text>
                  <Text className="text-data text-acier-texte">{color}</Text>
                </View>
              </View>
            ))}
            <View className="gap-space-8 border border-lisere bg-ecrin-elevated p-space-16">
              <Text className="text-body text-archive">Archive sur Écrin élevé</Text>
              <Text className="text-caption text-acier-texte">Métadonnées lisibles</Text>
            </View>
            <Text className="text-data text-archive">↗ +12,50 €</Text>
            <Text className="text-data text-acier-texte">↘ −12,50 €</Text>
            <Text className="text-body text-alerte">Exemple d’erreur système</Text>
            <Text className="text-caption text-acier-texte">
              Acier : décoration. Blanc : print/slab. Signal : accents, jamais une cote. Le liséré
              se mélange au fond.
            </Text>
          </View>

          <View className="gap-space-16">
            <Text accessibilityRole="header" className="text-h2 text-archive">
              Typographie
            </Text>
            {Object.entries(typography)
              .filter(([name]) => name !== 'button-label')
              .map(([name, token]) => (
                <View key={name} className="gap-space-8 border-b border-lisere pb-space-16">
                  <Text className="text-caption text-acier-texte">
                    {name} · graisse {token.weight}
                  </Text>
                  <Text className={`${textClasses[name as keyof typeof typography]} text-archive`}>
                    {name === 'data' ? '111,11 €\n888,88 €' : 'Écrin — Collection'}
                  </Text>
                </View>
              ))}
            <Text className="text-body text-archive" style={{ fontFamily: fonts.sans.native[800] }}>
              Schibsted 800 — Écrin
            </Text>
            <Text className="text-caption text-acier-texte">
              Display/H1 : 48/36 sous 1280 dp. Les retours à la ligne sur téléphone sont normaux.
              Plex Mono 600 est montré sur les boutons.
            </Text>
          </View>

          <View className="gap-space-16">
            <Text accessibilityRole="header" className="text-h2 text-archive">
              Dimensions
            </Text>
            {Object.entries(spacing).map(([name, size]) => (
              <View key={name} className="flex-row items-center gap-space-12">
                <View
                  className={`h-space-8 bg-archive ${spacingClasses[name as keyof typeof spacing]}`}
                />
                <Text className="text-data text-archive">{size} dp</Text>
              </View>
            ))}
            <View className="flex-row items-start gap-space-24">
              <View className="aspect-card w-space-64 rounded-card border border-lisere bg-ecrin-elevated" />
              <View className="h-space-64 w-space-64 items-center justify-center rounded-none border border-lisere">
                <Text className="text-body text-archive">LF</Text>
              </View>
              <View className="h-space-32 w-space-32 items-center justify-center rounded-none bg-archive">
                <Text className="text-data text-ecrin">3</Text>
              </View>
            </View>
            <Text className="text-caption text-acier-texte">
              Carte 63/88, rayon 6 ; gabarits Avatar/Badge carrés. Sans ombre.
            </Text>
          </View>

          <View className="gap-space-16">
            <Text accessibilityRole="header" className="text-h2 text-archive">
              États et focus
            </Text>
            {['border-lisere', 'border-lisere-hover', 'border-lisere-active'].map(
              (border, index) => (
                <View
                  key={border}
                  className={`rounded-card border bg-ecrin-elevated p-space-16 ${border}`}
                >
                  <Text className="text-caption text-archive">
                    Liséré {index === 0 ? '15' : index === 1 ? '40' : '90'} %
                  </Text>
                </View>
              ),
            )}
            <Pressable
              accessibilityRole="button"
              onPressIn={() => setPressed(true)}
              onPressOut={() => setPressed(false)}
              className="focus-indicator border border-acier-texte p-space-12 active:border-lisere-active"
            >
              <Text className="text-button-label text-archive">
                {pressed ? 'Appui maintenu' : 'Maintenir un appui'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              className="border border-acier-texte p-space-12 opacity-disabled"
            >
              <Text className="text-button-label text-archive">Désactivé · 40 %</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Champ de vérification du focus"
              placeholder="Nom de collection"
              placeholderTextColor={colors['acier-texte']}
              className="focus-indicator border border-acier-texte bg-ecrin-elevated p-space-12 text-body text-archive"
            />
            <Text className="text-caption text-acier-texte">
              Avec un clavier externe : Tab/Maj+Tab. Contrôler le focus Signal 1,5 dp, décalage 2
              dp, sans rognage. Aucun hover requis au toucher.
            </Text>
          </View>

          <View className="gap-space-16">
            <Text accessibilityRole="header" className="text-h2 text-archive">
              Mouvement
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActive(!active)}
              className="focus-indicator border border-acier-texte p-space-12"
            >
              <Text className="text-button-label text-archive">Basculer NativeWind</Text>
            </Pressable>
            {Object.entries(motion.duration).map(([name, duration]) => (
              <View key={name} className="gap-space-8">
                <Text className="text-data text-archive">
                  {name} · {duration} ms
                </Text>
                <View
                  className={`h-space-32 w-space-64 bg-archive transition-opacity ease-lock ${durationClasses[name as keyof typeof motion.duration]} ${active ? 'opacity-100' : 'opacity-disabled'}`}
                />
              </View>
            ))}
            <ReanimatedPreview />
            <Text className="text-body text-archive">
              Activer la réduction/suppression des animations dans les réglages d’accessibilité du
              téléphone. Revenir ici et essayer les deux boutons : les changements doivent être
              immédiats. Désactiver la préférence et recommencer sans recharger.
            </Text>
            <Text className="text-caption text-acier-texte">
              Consigner le téléphone, la version du système et les résultats. Cet écran ne remplace
              pas la revue du ticket.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
