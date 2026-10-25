import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Migration tests that need no database: they pin the interface contract of the catalogue tables
// (ADR-015) in the SQL that `prisma migrate deploy` runs. The TCG microservice relies on these
// unique keys for its UPSERTs, so dropping one must fail here. The migration itself is applied
// against a real PostgreSQL when the ticket is validated (see .claude/contexts/project_state.md).

const MIGRATIONS_DIRECTORY = join(__dirname, '..', 'migrations');
const MIGRATION_NAME = '20261025120000_add_card_catalogue';

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIRECTORY, name, 'migration.sql'), 'utf-8');
}

function tableDefinition(sql: string, table: string): string {
  const match = new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!match) {
    throw new Error(`CREATE TABLE "${table}" not found`);
  }
  return match[1];
}

function columns(sql: string, table: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of tableDefinition(sql, table).split('\n')) {
    const match = /^\s+"(\w+)" (.+?),?$/.exec(line);
    if (match) {
      result.set(match[1], match[2]);
    }
  }
  return result;
}

describe('add_card_catalogue migration', () => {
  const sql = readMigration(MIGRATION_NAME);

  it('is the newest migration, so it runs after the existing ones', () => {
    const names = readdirSync(MIGRATIONS_DIRECTORY)
      .filter((name) => /^\d{14}_/.test(name))
      .sort();

    expect(names[names.length - 1]).toBe(MIGRATION_NAME);
    expect(names).toContain('20260924132529_add_roles_permissions');
  });

  it('creates the licences_tcg, sets, cards and variants tables and nothing else', () => {
    expect([...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1])).toEqual([
      'licences_tcg',
      'sets',
      'cards',
      'variants',
    ]);
    expect(sql).not.toMatch(
      /\b(DROP|ALTER TABLE "(roles|permissions|role_permissions|audit_logs)")/,
    );
  });

  describe('upsert keys', () => {
    it.each([
      ['licences_tcg_slug_key', 'licences_tcg', 'slug'],
      ['sets_tcgdexId_key', 'sets', 'tcgdexId'],
      ['cards_tcgdexId_key', 'cards', 'tcgdexId'],
    ])('has the unique index %s on %s(%s)', (index, table, column) => {
      expect(sql).toContain(`CREATE UNIQUE INDEX "${index}" ON "${table}"("${column}");`);
    });

    it('identifies a printing by its card and its TCGdex variantId together, never by the variantId alone', () => {
      expect(sql).toContain(
        'CREATE UNIQUE INDEX "variants_cardId_tcgdexVariantId_key" ON "variants"("cardId", "tcgdexVariantId");',
      );
      expect(sql).not.toMatch(/UNIQUE INDEX "variants_tcgdexVariantId_key"/);
      expect(columns(sql, 'variants').get('tcgdexVariantId')).toBe('TEXT NOT NULL');
    });

    it('generates the primary keys in the database, so a raw INSERT does not have to supply one', () => {
      for (const table of ['licences_tcg', 'sets', 'cards', 'variants']) {
        expect(columns(sql, table).get('id')).toBe('UUID NOT NULL DEFAULT gen_random_uuid()');
      }
    });

    it('makes the keys mandatory', () => {
      expect(columns(sql, 'licences_tcg').get('slug')).toBe('TEXT NOT NULL');
      expect(columns(sql, 'sets').get('tcgdexId')).toBe('TEXT NOT NULL');
      expect(columns(sql, 'cards').get('tcgdexId')).toBe('TEXT NOT NULL');
    });
  });

  describe('relations', () => {
    it('links sets to licences and cards to sets, and refuses to delete a parent that has children', () => {
      expect(sql).toContain(
        'ADD CONSTRAINT "sets_licenceTCGId_fkey" FOREIGN KEY ("licenceTCGId") REFERENCES "licences_tcg"("id") ON DELETE RESTRICT',
      );
      expect(sql).toContain(
        'ADD CONSTRAINT "cards_setId_fkey" FOREIGN KEY ("setId") REFERENCES "sets"("id") ON DELETE RESTRICT',
      );
    });

    it('links printings to cards', () => {
      expect(sql).toContain(
        'ADD CONSTRAINT "variants_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT',
      );
    });

    it('indexes the foreign keys', () => {
      expect(sql).toContain('CREATE INDEX "sets_licenceTCGId_idx" ON "sets"("licenceTCGId");');
      expect(sql).toContain('CREATE INDEX "cards_setId_idx" ON "cards"("setId");');
    });
  });

  describe('French and English columns', () => {
    it('requires English and keeps French optional', () => {
      const sets = columns(sql, 'sets');
      expect(sets.get('nameEn')).toBe('TEXT NOT NULL');
      expect(sets.get('nameFr')).toBe('TEXT');

      const cards = columns(sql, 'cards');
      expect(cards.get('nameEn')).toBe('TEXT NOT NULL');
      expect(cards.get('nameFr')).toBe('TEXT');
      expect(cards.get('categoryEn')).toBe('TEXT NOT NULL');
      expect(cards.get('categoryFr')).toBe('TEXT');
      expect(cards.get('rarityEn')).toBe('TEXT');
      expect(cards.get('rarityFr')).toBe('TEXT');
    });

    it('defaults the type lists to empty so a raw INSERT may leave them out', () => {
      const cards = columns(sql, 'cards');
      expect(cards.get('typesEn')).toBe('TEXT[] DEFAULT ARRAY[]::TEXT[]');
      expect(cards.get('typesFr')).toBe('TEXT[] DEFAULT ARRAY[]::TEXT[]');
    });

    it('keeps French optional on every translated card column', () => {
      const cards = columns(sql, 'cards');
      for (const column of ['evolveFrom', 'stage', 'trainerType', 'energyType']) {
        expect(cards.get(`${column}En`)).toBe('TEXT');
        expect(cards.get(`${column}Fr`)).toBe('TEXT');
      }
      const sets = columns(sql, 'sets');
      expect(sets.get('serieNameEn')).toBe('TEXT');
      expect(sets.get('serieNameFr')).toBe('TEXT');
      expect(sets.get('abbreviationFr')).toBe('TEXT');
    });

    it('stores the card number as text to keep leading zeros', () => {
      expect(columns(sql, 'cards').get('number')).toBe('TEXT NOT NULL');
    });
  });

  describe('additional TCGdex information', () => {
    it('keeps the card details that are not text', () => {
      const cards = columns(sql, 'cards');
      expect(cards.get('dexIds')).toBe('INTEGER[] DEFAULT ARRAY[]::INTEGER[]');
      expect(cards.get('illustrator')).toBe('TEXT');
      expect(cards.get('suffix')).toBe('TEXT');
      expect(cards.get('tcgdexUpdatedAt')).toBe('TIMESTAMPTZ(6)');
    });

    it('keeps the logo of the licence', () => {
      expect(columns(sql, 'licences_tcg').get('logoUrl')).toBe('TEXT');
    });

    it('does not duplicate the kinds of printing on the card: they come from variants', () => {
      expect(sql).not.toMatch(/"has(Normal|Reverse|Holo|FirstEdition|WPromo)"/);
    });

    it('does not store the tournament legality and the regulation mark, useless to a collector', () => {
      expect(sql).not.toMatch(/"(legalStandard|legalExpanded|regulationMark)"/);
    });

    it('keeps the series, the codes and the printing counts of a set', () => {
      const sets = columns(sql, 'sets');
      expect(sets.get('serieTcgdexId')).toBe('TEXT');
      expect(sets.get('abbreviationOfficial')).toBe('TEXT');
      expect(sets.get('tcgOnlineCode')).toBe('TEXT');
      for (const count of ['normal', 'reverse', 'holo', 'firstEdition']) {
        expect(sets.get(`${count}CardCount`)).toBe('INTEGER');
      }
    });

    it('describes a printing with codes and the product ids of the price sources', () => {
      const variants = columns(sql, 'variants');
      expect(variants.get('type')).toBe('TEXT NOT NULL');
      expect(variants.get('size')).toBe('TEXT NOT NULL');
      expect(variants.get('subtype')).toBe('TEXT');
      expect(variants.get('foil')).toBe('TEXT');
      expect(variants.get('stamps')).toBe('TEXT[] DEFAULT ARRAY[]::TEXT[]');
      for (const source of ['cardmarket', 'tcgplayer', 'cardtrader']) {
        expect(variants.get(`${source}ProductId`)).toBe('INTEGER');
      }
    });

    it('does not store the gameplay details left out on purpose', () => {
      expect(sql).not.toMatch(/attack|abilit|weakness|resistance|retreat/i);
    });
  });

  describe('scope', () => {
    it('stores image URLs only, never image content', () => {
      const cards = columns(sql, 'cards');
      expect(cards.get('imageUrlEn')).toBe('TEXT');
      expect(cards.get('imageUrlFr')).toBe('TEXT');
      expect(sql).not.toMatch(/BYTEA|OID/i);
    });

    it('has no price column: prices are not covered by this contract', () => {
      expect(sql).not.toMatch(/price/i);
    });

    it('lets a raw UPSERT leave the timestamps out', () => {
      for (const table of ['licences_tcg', 'sets', 'cards', 'variants']) {
        const definition = columns(sql, table);
        expect(definition.get('createdAt')).toBe(
          'TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
        expect(definition.get('updatedAt')).toBe(
          'TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
      }
    });
  });
});
