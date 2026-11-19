import { useEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { motion } from '@shared/tokens';

import { Button } from '../Button';

import { Counter } from './Counter';

const meta = {
  title: 'Counter',
  component: Counter,
  args: { ready: 2, total: 3 },
  argTypes: { retryAction: { control: false } },
} satisfies Meta<typeof Counter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Lot en cours : aucune durée, aucun spinner. */
export const EnCours: Story = {
  name: 'En cours',
};

/** Lot terminé : durée totale du traitement. */
export const Resolu: Story = {
  name: 'Résolu',
  args: { ready: 3, total: 3, durationMs: 1200 },
};

/** Échec partiel : glyphe, texte Alerte et reprise fournie par le parent. */
export const EchecPartiel: Story = {
  name: 'Échec partiel',
  args: {
    ready: 2,
    total: 3,
    failed: 1,
    retryAction: <Button variant="ghost">Réessayer</Button>,
  },
};

const TOTAL = 12;
/** Une carte prête par séquence de balayage (token `sequence`). */
const CARD_MS = motion.duration.sequence;

function ScanDemo() {
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(0);
  const isDone = ready + failed === TOTAL;

  useEffect(() => {
    if (isDone) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      // La 7ᵉ carte échoue, pour montrer l'échec partiel.
      if (ready + failed === 6) {
        setFailed((value) => value + 1);
      } else {
        setReady((value) => value + 1);
      }
    }, CARD_MS);
    return () => window.clearTimeout(timer);
  }, [ready, failed, isDone]);

  function handleRetry() {
    setFailed(0);
  }

  return (
    <div className="space-y-space-16">
      <Counter
        ready={ready}
        total={TOTAL}
        durationMs={TOTAL * CARD_MS}
        failed={failed}
        retryAction={
          <Button variant="ghost" onClick={handleRetry}>
            Réessayer
          </Button>
        }
      />
      <Button
        variant="secondary"
        onClick={() => {
          setReady(0);
          setFailed(0);
        }}
      >
        Relancer le balayage
      </Button>
    </div>
  );
}

/**
 * Balayage simulé de 12 cartes : la largeur ne bouge pas pendant l'incrément (chiffres
 * tabulaires et espace de chiffre), une carte échoue puis se reprend avec « Réessayer ».
 */
export const Balayage: Story = {
  args: { ready: 0, total: TOTAL },
  render: () => <ScanDemo />,
};
