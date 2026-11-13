import type { Meta, StoryObj } from '@storybook/react-vite';

import { colors } from '@shared/tokens';

import { Text } from '../Text';

import { Avatar } from './Avatar';
import type { AvatarSize } from './Avatar';

// Photo de démonstration générée localement, aux couleurs des tokens : aucune requête externe.
const PHOTO = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${colors.signal}"/><circle cx="24" cy="19" r="8" fill="${colors.archive}"/><rect x="10" y="31" width="28" height="17" fill="${colors.archive}"/></svg>`,
)}`;

const meta = {
  title: 'Avatar',
  component: Avatar,
  args: { name: 'ash_ketchum' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Initiale, taille md : le cas de la Topbar. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const SIZES: { size: AvatarSize; label: string }[] = [
  { size: 'sm', label: 'sm · 24 px' },
  { size: 'md', label: 'md · 32 px' },
  { size: 'lg', label: 'lg · 48 px' },
];

/** Les 3 tailles, avec l'initiale. */
export const Tailles: Story = {
  render: () => (
    <div className="flex items-end gap-space-24">
      {SIZES.map(({ size, label }) => (
        <div key={size} className="space-y-space-8">
          <Avatar name="ash_ketchum" size={size} />
          <Text variant="caption" color="acier-texte">
            {label}
          </Text>
        </div>
      ))}
    </div>
  ),
};

/** Avec photo, aux 3 tailles. */
export const AvecPhoto: Story = {
  name: 'Avec photo',
  render: () => (
    <div className="flex items-end gap-space-24">
      {SIZES.map(({ size }) => (
        <Avatar key={size} name="ash_ketchum" src={PHOTO} size={size} />
      ))}
    </div>
  ),
};

/** Photo introuvable : l'initiale reste affichée, sans image cassée. */
export const PhotoEnErreur: Story = {
  name: 'Photo en erreur (repli)',
  render: () => (
    <div className="flex items-end gap-space-24">
      {SIZES.map(({ size }) => (
        <Avatar key={size} name="ash_ketchum" src="/photo-introuvable.png" size={size} />
      ))}
    </div>
  ),
};
