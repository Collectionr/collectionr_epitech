import type { CatalogueLanguage } from './CatalogueLanguage';

/**
 * A TCGdex asset URL that depends on the language (card image, set logo). Only URLs are kept:
 * the assets stay on the TCGdex CDN and are never stored locally. The URL is a base without
 * extension, the caller appends the quality and the format (e.g. `/low.webp`, `/high.webp`).
 */
export class LocalizedUrl {
  private constructor(
    public readonly en: string | null,
    public readonly fr: string | null,
  ) {}

  static of(en: string | null, fr: string | null): LocalizedUrl {
    return new LocalizedUrl(en, fr);
  }

  /**
   * The URL in the requested language. When TCGdex has no asset in that language, the other
   * language is better than nothing; null only when there is none at all.
   */
  in(language: CatalogueLanguage): string | null {
    return language === 'fr' ? (this.fr ?? this.en) : (this.en ?? this.fr);
  }
}
