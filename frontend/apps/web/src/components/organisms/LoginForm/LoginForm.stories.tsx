import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '@/components/atoms';

import { LoginForm } from './LoginForm';

/** Repère neutre : aucun logo de fournisseur n'est intégré (COLLR-584, hors Alpha). */
const SOCIAL_SLOT = (
  <div className="flex flex-col items-center gap-space-8 border border-dashed border-lisere-hover p-space-24">
    <Text variant="data">socialSection</Text>
    <Text variant="caption" color="acier-texte">
      Boutons de connexion sociale (COLLR-584)
    </Text>
  </div>
);

const SESSION_EXPIRED_NOTICE = (
  <div role="status">
    <Text variant="body">Votre session a expiré, reconnectez-vous.</Text>
  </div>
);

const meta = {
  title: 'LoginForm',
  component: LoginForm,
  args: {
    signupHref: '/inscription',
    forgotPasswordHref: '/mot-de-passe-oublie',
    submitting: false,
    onSubmit: () => undefined,
  },
  argTypes: {
    notice: { control: false },
    socialSection: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-form">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Formulaire vide ; « Se connecter » sans saisie montre la validation et le focus. */
export const ParDefaut: Story = { name: 'Par défaut' };

/** Connexion en cours : libellé de chargement, sans spinner. */
export const EnCours: Story = {
  name: 'Connexion en cours',
  args: { submitting: true },
};

/** Échec de connexion : message explicite au-dessus du bouton. */
export const Echec: Story = {
  name: 'Échec de connexion',
  args: { error: 'Adresse e-mail ou mot de passe incorrect.' },
};

/** Arrivée après une session expirée. */
export const SessionExpiree: Story = {
  name: 'Session expirée',
  args: { notice: SESSION_EXPIRED_NOTICE },
};

/** Emplacement de la connexion sociale, sous le séparateur « ou ». */
export const AvecConnexionSociale: Story = {
  name: 'Avec connexion sociale',
  args: { socialSection: SOCIAL_SLOT },
};
