import type { Meta, StoryObj } from '@storybook/react-vite';

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
        className="border border-lisere px-space-16 py-space-8 text-button-label transition-colors duration-instant hover:border-lisere-hover"
        type="button"
      >
        Vérifier le focus
      </button>
    </section>
  ),
};
