export interface LicenceTCGProps {
  readonly id: string;
  /** Stable identifier of the licence (e.g. `pokemon`): the key the TCG microservice upserts on. */
  readonly slug: string;
  readonly name: string;
  /** URL of the logo. TCGdex has none, so it may stay empty until a source is chosen. */
  readonly logoUrl: string | null;
}

/**
 * A trading card game licence (Pokémon, later Magic…): the root of the catalogue. Reference data
 * written by the TCG microservice and the seed, never by the backend, hence no way to create one
 * here: the catalogue is only read.
 */
export class LicenceTCG {
  private constructor(
    public readonly id: string,
    public readonly slug: string,
    public readonly name: string,
    public readonly logoUrl: string | null,
  ) {}

  /** Rebuilds a licence from stored data. Not re-validated: the store is the source of truth. */
  static restore(props: LicenceTCGProps): LicenceTCG {
    return new LicenceTCG(props.id, props.slug, props.name, props.logoUrl);
  }
}
