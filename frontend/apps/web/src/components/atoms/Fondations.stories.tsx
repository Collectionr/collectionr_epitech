import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { colors, fonts, motion, spacing, typography } from '@shared/tokens';

const meta = {
  title: 'Fondations',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Vérifie le raccordement aux styles et polices, sans créer un nouvel atome. */
export const Ecrin: Story = {
  name: 'Thème Écrin',
  render: () => (
    <section className="space-y-space-24 text-archive">
      <h1 className="text-h1">Collectionr</h1>
      <p className="text-body">Fondations partagées : couleurs, typographie et espacements.</p>
      <div className="rounded-card border border-lisere bg-ecrin-elevated p-space-24">
        <h2 className="text-h2">Écrin</h2>
        <p className="text-data">247 cartes · 1 234,56 €</p>
        <p className="text-caption text-acier-texte">Schibsted Grotesk et IBM Plex Mono</p>
      </div>
      <button
        className="border border-acier-texte px-space-16 py-space-8 text-button-label transition-colors duration-instant hover:border-lisere-hover"
        type="button"
      >
        Vérifier le focus
      </button>
    </section>
  ),
};

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

export const Palette: Story = {
  render: () => (
    <section className="space-y-space-24">
      <h1 className="text-h2">Palette Écrin</h1>
      <p className="text-body">
        Nuancier technique : les proportions ne représentent pas un écran produit.
      </p>
      <div className="flex flex-wrap gap-space-24">
        {Object.entries(colors).map(([name, value]) => (
          <div key={name} className="space-y-space-8">
            <div
              className={`h-space-64 w-space-64 border border-lisere ${colorClasses[name as keyof typeof colors]}`}
            />
            <p className="text-caption">{name}</p>
            <p className="text-data">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-body text-acier-texte">
        Métadonnées en Acier texte ; Acier reste décoratif.
      </p>
      <div className="border border-lisere bg-ecrin-elevated p-space-16">
        <p className="text-body text-archive">Texte principal sur surface élevée</p>
        <p className="text-caption text-acier-texte">Texte secondaire sur surface élevée</p>
      </div>
      <p className="text-body">
        Signal : identité et accents, 5 % maximum ; aucun texte Signal inférieur à 18 px sur Écrin.
        Blanc : print/slab uniquement.
      </p>
      <p className="text-body text-alerte">Erreur système — impossible de charger la collection.</p>
      <button
        type="button"
        className="border border-alerte px-space-16 py-space-8 text-button-label text-alerte"
      >
        Supprimer définitivement — exemple inactif
      </button>
      <div className="space-y-space-8">
        <p className="text-data text-archive">↗ +12,50 €</p>
        <p className="text-data text-acier-texte">↘ −12,50 €</p>
      </div>
    </section>
  ),
};

const typographyClasses = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  body: 'text-body',
  caption: 'text-caption',
  data: 'text-data',
  'button-label': 'text-button-label',
} satisfies Record<keyof typeof typography, string>;

export const Typographie: Story = {
  render: () => (
    <section className="space-y-space-24">
      <h1 className="text-h2">Typographie et seuil desktop</h1>
      <p className="text-body">
        Comparer un canvas de 1279 puis 1280 px : Display 48 → 96 px, H1 36 → 56 px. Utiliser le
        canvas seul pour éviter la largeur de la barre latérale.
      </p>
      {Object.entries(typography).map(([name, token]) => (
        <div key={name} className="space-y-space-8 border-b border-lisere pb-space-16">
          <p className="text-caption text-acier-texte">
            {name} · {fonts[token.family].family}
          </p>
          {name === 'button-label' ? (
            <button
              type="button"
              className="border border-acier-texte px-space-16 py-space-8 text-button-label"
            >
              Ajouter une carte
            </button>
          ) : (
            <p className={typographyClasses[name as keyof typeof typography]}>
              {name === 'data'
                ? '001 · 111,11 € · 888,88 € · 30/10/2026'
                : 'Collection précieuse — Écrin'}
            </p>
          )}
          <p className="text-data">
            {token.size} px · graisse {token.weight} · crénage {token.tracking} em
          </p>
        </div>
      ))}
      <div className="space-y-space-8">
        <p className="text-caption text-acier-texte">
          Graisse Schibsted 800 (spécimen supplémentaire)
        </p>
        <p className="text-body font-extrabold">Collection précieuse — Écrin</p>
      </div>
      <p className="text-body">
        Vérifier les fontes réellement rendues : Schibsted 400/500/700/800/900, Plex Mono 500/600,
        sans italique ni graisse synthétique. Les chiffres Data doivent rester alignés.
      </p>
      <div className="text-data">
        <p>111111 · 111,11 €</p>
        <p>888888 · 888,88 €</p>
      </div>
    </section>
  ),
};

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

export const Dimensions: Story = {
  render: () => (
    <section className="space-y-space-24">
      <h1 className="text-h2">Espacements et géométrie</h1>
      {Object.entries(spacing).map(([name, value]) => (
        <div key={name} className="flex items-center gap-space-16">
          <div
            className={`h-space-8 shrink-0 bg-archive ${spacingClasses[name as keyof typeof spacing]}`}
          />
          <p className="text-data">
            {name} · {value} px
          </p>
        </div>
      ))}
      <div className="flex flex-wrap items-start gap-space-24">
        <div className="space-y-space-8">
          <div className="aspect-card w-space-64 rounded-card border border-lisere bg-ecrin-elevated" />
          <p className="text-data">Carte : 63/88 · rayon 6 px</p>
        </div>
        <div className="space-y-space-8">
          <div className="flex h-space-64 w-space-64 items-center justify-center rounded-none border border-lisere bg-ecrin-elevated text-body">
            LF
          </div>
          <p className="text-caption">Gabarit Avatar carré</p>
        </div>
        <div className="space-y-space-8">
          <div className="flex h-space-32 w-space-32 items-center justify-center rounded-none bg-archive text-data text-ecrin">
            3
          </div>
          <p className="text-caption">Gabarit Badge carré</p>
        </div>
      </div>
      <p className="text-body">
        Ces gabarits illustrent les tokens, sans implémenter les atomes. Aucun arrondi hors carte,
        aucune ombre.
      </p>
    </section>
  ),
};

export const EtatsEtFocus: Story = {
  name: 'États et focus clavier',
  render: () => (
    <section className="space-y-space-24">
      <h1 className="text-h2">États et focus</h1>
      <div className="flex flex-wrap gap-space-24">
        {[
          ['Repos · 15 %', 'border-lisere'],
          ['Hover · 40 %', 'border-lisere-hover'],
          ['Active · 90 %', 'border-lisere-active'],
        ].map(([label, className]) => (
          <div
            key={label}
            className={`rounded-card border bg-ecrin-elevated p-space-16 ${className}`}
          >
            <p className="text-caption">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-space-24 p-space-8">
        <button
          type="button"
          className="border border-acier-texte px-space-16 py-space-8 text-button-label transition-colors duration-instant ease-lock hover:border-lisere-hover active:border-lisere-active"
        >
          Survoler puis maintenir
        </button>
        <button
          type="button"
          disabled
          className="border border-acier-texte px-space-16 py-space-8 text-button-label opacity-disabled"
        >
          Désactivé · 40 %
        </button>
        <label className="space-y-space-8 text-caption">
          Champ de démonstration
          <input
            className="block border border-acier-texte bg-ecrin-elevated p-space-8 text-body"
            placeholder="Nom de collection"
          />
        </label>
      </div>
      <p className="text-body">
        Parcourir avec Tab et Maj+Tab : focus Signal 1,5 px, offset 2 px, sans rognage. Le bouton
        désactivé est ignoré. Le focus doit rester visible sur le bouton et le champ.
      </p>
      <p className="text-body">
        Checkbox cochée : gabarit de couleurs Archive/Écrin, sans comportement d’atome.
      </p>
      <span
        aria-label="Gabarit de coche"
        className="inline-flex h-space-24 w-space-24 items-center justify-center rounded-none bg-archive text-body text-ecrin"
      >
        ✓
      </span>
    </section>
  ),
};

const durationClasses = {
  instant: 'duration-instant',
  snap: 'duration-snap',
  signature: 'duration-signature',
  sequence: 'duration-sequence',
} satisfies Record<keyof typeof motion.duration, string>;

function MotionDemo() {
  const [active, setActive] = useState(false);
  return (
    <section className="space-y-space-24">
      <h1 className="text-h2">Durées et réduction du mouvement</h1>
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setActive(!active)}
        className="border border-acier-texte px-space-16 py-space-8 text-button-label"
      >
        Basculer les quatre transitions
      </button>
      {Object.entries(motion.duration).map(([name, duration]) => (
        <div key={name} className="space-y-space-8">
          <p className="text-data">
            {name} · {duration} ms
          </p>
          <div
            className={`h-space-32 w-space-64 bg-archive transition-opacity ease-lock ${durationClasses[name as keyof typeof motion.duration]} ${active ? 'opacity-100' : 'opacity-disabled'}`}
          />
        </div>
      ))}
      <p className="text-data">Easing : {motion.easing}</p>
      <p className="text-body">
        Activer la réduction des animations dans le système ou les outils du navigateur, puis
        basculer à nouveau : les quatre changements doivent être immédiats (0 ms). Désactiver la
        préférence sans recharger et recommencer. Vérifier aussi les durées calculées ; une capture
        fixe ne prouve pas le mouvement.
      </p>
    </section>
  );
}

export const Mouvement: Story = { render: () => <MotionDemo /> };
