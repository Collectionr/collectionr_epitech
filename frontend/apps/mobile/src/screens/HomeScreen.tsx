import { Text, View } from 'react-native';

import { APP_NAME } from '@shared/constants';

/** Écran d'accueil de l'application mobile. */
export function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-ecrin">
      <Text className="text-body text-archive">{APP_NAME}</Text>
    </View>
  );
}
