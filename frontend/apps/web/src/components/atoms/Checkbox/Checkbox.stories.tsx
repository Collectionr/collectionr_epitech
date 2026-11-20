import { useState } from 'react';
import type { ChangeEvent } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../Button';
import { Text } from '../Text';

import { Checkbox } from './Checkbox';

const CGU_LABEL = 'J’accepte les Conditions Générales d’Utilisation';

/** Message d'exemple : en production, il vient toujours du formulaire. */
const CGU_ERROR = 'Acceptez les Conditions Générales d’Utilisation pour continuer.';

const meta = {
  title: 'Checkbox',
  component: Checkbox,
  args: { id: 'checkbox-par-defaut', label: CGU_LABEL },
  argTypes: { label: { control: 'text' } },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

/**
 * Tous les états. Survol et focus se vérifient à la souris et au clavier (Tab, puis Espace) :
 * bordure renforcée au survol (liséré 90 %), contour Signal sur la case au focus clavier,
 * coche tracée au cochage (snap), effacée au décochage (instant).
 */
export const Etats: Story = {
  name: 'États',
  render: () => (
    <div className="space-y-space-16">
      <Checkbox id="etat-non-cochee" label="Non cochée · survol · Tab" />
      <Checkbox id="etat-cochee" label="Cochée" defaultChecked />
      <Checkbox id="etat-erreur" label="Erreur" error={CGU_ERROR} />
      <Checkbox id="etat-desactivee" label="Désactivée" disabled />
      <Checkbox id="etat-desactivee-cochee" label="Désactivée et cochée" disabled defaultChecked />
    </div>
  ),
};

/** Un clic sur le lien l'ouvre sans cocher la case ; un clic sur le reste du libellé la coche. */
export const LibelleAvecLien: Story = {
  name: 'Libellé avec lien',
  render: () => (
    <Checkbox
      id="libelle-avec-lien"
      label={
        <>
          J’accepte les{' '}
          <a href="#cgu" className="underline">
            Conditions Générales d’Utilisation
          </a>
        </>
      }
    />
  ),
};

/** La case reste centrée sur la première ligne quand le libellé passe à la ligne. */
export const LibelleLong: Story = {
  name: 'Libellé sur plusieurs lignes',
  render: () => (
    <div className="w-1/4">
      <Checkbox
        id="libelle-long"
        label="Libellé volontairement long, qui passe sur plusieurs lignes : la case reste alignée sur la première ligne du texte."
      />
    </div>
  ),
};

function SoumissionDemo() {
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState<string>();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setIsChecked(event.target.checked);
    if (event.target.checked) {
      setError(undefined);
    }
  }

  function handleSubmit() {
    setError(isChecked ? undefined : CGU_ERROR);
  }

  return (
    <div className="space-y-space-16">
      <Checkbox
        id="cgu-soumission"
        label={CGU_LABEL}
        required
        checked={isChecked}
        error={error}
        onChange={handleChange}
      />
      <Button variant="primary" onClick={handleSubmit}>
        Créer mon compte
      </Button>
      <Text variant="body" color="acier-texte">
        Le bouton ne bouge pas quand le message apparaît : sa place est réservée.
      </Text>
    </div>
  );
}

/**
 * Exemple de formulaire : soumettre sans cocher affiche l'erreur en fondu ; cocher la case l'efface.
 * Checkbox ne valide rien : c'est la story qui joue le rôle du formulaire.
 */
export const SoumissionSansCocher: Story = {
  name: 'Soumission sans cocher (exemple de formulaire)',
  render: () => <SoumissionDemo />,
};
