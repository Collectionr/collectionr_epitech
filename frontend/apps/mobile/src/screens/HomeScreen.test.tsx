import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { APP_NAME } from '@shared/constants';

import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it("affiche le nom de l'application", async () => {
    await render(<HomeScreen />);

    expect(screen.getByText(APP_NAME)).toBeTruthy();
  });
});
