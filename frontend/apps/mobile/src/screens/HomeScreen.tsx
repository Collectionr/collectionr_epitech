import { Text, View } from 'react-native';

import { APP_NAME } from '@shared/constants';

/** Écran d'accueil de l'application mobile. */
export function HomeScreen() {
  return (
    <View>
      <Text>{APP_NAME}</Text>
    </View>
  );
}
