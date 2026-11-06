import { CardVariant, type CardVariantProps } from './CardVariant';

function buildVariant(overrides: Partial<CardVariantProps> = {}): CardVariant {
  return CardVariant.restore({
    id: '9a1f1e8e-2d1a-4d0c-9d0b-0f7e5b7a6c10',
    tcgdexVariantId: 'mtltux8qtgdu4exu903oasum21juxbvx6lx',
    type: 'holo',
    subtype: 'shadowless',
    size: 'standard',
    stamps: ['1st-edition'],
    foil: null,
    cardmarketProductId: 660224,
    tcgplayerProductId: 106999,
    cardtraderProductId: null,
    ...overrides,
  });
}

describe('CardVariant', () => {
  it('restores a printing with its codes and its product ids', () => {
    expect(buildVariant()).toMatchObject({
      type: 'holo',
      subtype: 'shadowless',
      size: 'standard',
      cardmarketProductId: 660224,
      tcgplayerProductId: 106999,
      cardtraderProductId: null,
    });
  });
});
