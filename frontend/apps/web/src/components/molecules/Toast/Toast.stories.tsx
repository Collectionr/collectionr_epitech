import { useEffect } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { toast, toastStore } from '@shared/stores';

import { Button } from '../../atoms';
import { Toast } from './Toast';
import { ToastProvider } from './ToastProvider';

const meta = {
  title: 'Toast',
  component: Toast,
  args: {
    toast: { id: 1, severity: 'success', message: 'Dracaufeu ajoutée à “Classeur Base”' },
    onDismiss: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-form">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Se ferme après 4 s (en pause au survol et au focus). */
export const Succes: Story = { name: 'Succès' };

export const Info: Story = {
  args: { toast: { id: 2, severity: 'info', message: 'Votre collection est à jour.' } },
};

/** Reste affichée jusqu'à sa fermeture. */
export const Erreur: Story = {
  args: {
    toast: { id: 3, severity: 'error', message: 'La carte n’a pas pu être ajoutée. Réessayez.' },
  },
};

export const AvecAction: Story = {
  name: 'Avec action',
  args: {
    toast: {
      id: 4,
      severity: 'success',
      message: 'Dracaufeu ajoutée à “Classeur Base”',
      action: { label: 'Voir la collection', onAction: fn() },
    },
  },
};

function StackDemo() {
  useEffect(() => {
    toast.success('Dracaufeu ajoutée à “Classeur Base”');
    toast.info('Votre collection est à jour.');
    toast.error('La carte n’a pas pu être ajoutée. Réessayez.');
    return () => toastStore.getState().clear();
  }, []);

  return (
    <>
      <Button variant="secondary" onClick={() => toast.info('Nouvelle notification')}>
        Ajouter une notification
      </Button>
      <ToastProvider />
    </>
  );
}

/** Pile en bas à droite : 3 notifications au plus, les plus anciennes sortent en premier. */
export const PileDeTrois: Story = {
  name: 'Pile de 3',
  render: () => <StackDemo />,
};
