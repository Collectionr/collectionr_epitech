import { LicenceTCG } from './LicenceTCG';

describe('LicenceTCG', () => {
  it('restores a licence exactly as it is stored', () => {
    const licence = LicenceTCG.restore({
      id: '5b0c6c32-86b8-4a53-8f0e-6f8a8bd9d111',
      slug: 'pokemon',
      name: 'Pokémon',
      logoUrl: null,
    });

    expect(licence).toMatchObject({ slug: 'pokemon', name: 'Pokémon', logoUrl: null });
  });

  it('keeps a logo URL when there is one', () => {
    const licence = LicenceTCG.restore({
      id: '5b0c6c32-86b8-4a53-8f0e-6f8a8bd9d111',
      slug: 'pokemon',
      name: 'Pokémon',
      logoUrl: 'https://example.test/pokemon-logo',
    });

    expect(licence.logoUrl).toBe('https://example.test/pokemon-logo');
  });
});
