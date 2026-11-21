import { colors } from './colors';

/** Traits et indicateur de focus, en pixels. */
export const borders = {
  thin: 1,
  'nav-indicator': 3,
  focus: { width: 1.5, offset: 2, color: colors.signal },
} as const;
