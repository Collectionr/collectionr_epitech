export type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | readonly AuditMetadataValue[]
  | { readonly [key: string]: AuditMetadataValue };

export type AuditMetadata = { readonly [key: string]: AuditMetadataValue };

export interface NewAuditEntryProps {
  readonly userId: string | null;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly metadata: AuditMetadata | null;
  readonly occurredAt: Date;
  readonly retentionDays: number;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** `domain.verb`, lowercase, dot-separated (e.g. collection.create, auth.login.failed). */
const ACTION_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export class AuditEntry {
  private constructor(
    public readonly userId: string | null,
    public readonly action: string,
    public readonly targetType: string | null,
    public readonly targetId: string | null,
    public readonly metadata: AuditMetadata | null,
    public readonly timestamp: Date,
    public readonly expiresAt: Date,
  ) {}

  static isValidAction(action: string): boolean {
    return ACTION_PATTERN.test(action);
  }

  /** Builds an entry whose expiry is derived from the retention policy (S04: 90 days by default). */
  static record(props: NewAuditEntryProps): AuditEntry {
    if (!AuditEntry.isValidAction(props.action)) {
      throw new Error(`Invalid audit action "${props.action}": expected the "domain.verb" format`);
    }
    if (!Number.isInteger(props.retentionDays) || props.retentionDays < 1) {
      throw new Error('Audit retention must be a whole number of days, at least 1');
    }

    return new AuditEntry(
      props.userId,
      props.action,
      props.targetType,
      props.targetId,
      props.metadata,
      props.occurredAt,
      new Date(props.occurredAt.getTime() + props.retentionDays * MILLISECONDS_PER_DAY),
    );
  }
}
