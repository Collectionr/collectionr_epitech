import type { CatalogueLanguage } from './CatalogueLanguage';

/**
 * A text TCGdex gives in English (always) and in French (about 95 % of the time), such as the name
 * of a card or of a set. English is the reference: a missing translation falls back on it.
 */
export class LocalizedText {
  private constructor(
    public readonly en: string,
    public readonly fr: string | null,
  ) {}

  /** Builds the text from stored data: like the other restore methods, it does not re-validate. */
  static of(en: string, fr: string | null): LocalizedText {
    return new LocalizedText(en, fr);
  }

  /** The text in the requested language, or the English one when it is not translated. */
  in(language: CatalogueLanguage): string {
    return language === 'fr' ? (this.fr ?? this.en) : this.en;
  }
}
