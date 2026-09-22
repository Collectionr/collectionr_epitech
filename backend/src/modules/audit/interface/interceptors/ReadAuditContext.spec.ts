import { buildMetadata, readActorId, readTargetId } from './ReadAuditContext';

const UUID = '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11';

describe('readActorId', () => {
  it('returns the authenticated user id', () => {
    expect(readActorId({ user: { id: UUID } })).toBe(UUID);
  });

  it.each([{}, { user: null }, { user: { id: 42 } }, { user: { id: 'not-a-uuid' } }])(
    'returns null when there is no usable user (%j)',
    (request) => {
      expect(readActorId(request)).toBeNull();
    },
  );
});

describe('readTargetId', () => {
  it('reads the configured route parameter', () => {
    expect(readTargetId({ params: { id: UUID } }, { action: 'a.b', targetIdParam: 'id' })).toBe(
      UUID,
    );
  });

  it('returns null when no parameter is configured or the value is not a UUID', () => {
    expect(readTargetId({ params: { id: UUID } }, { action: 'a.b' })).toBeNull();
    expect(
      readTargetId({ params: { id: '12' } }, { action: 'a.b', targetIdParam: 'id' }),
    ).toBeNull();
    expect(readTargetId({}, { action: 'a.b', targetIdParam: 'id' })).toBeNull();
  });
});

describe('buildMetadata', () => {
  it('copies only the allowed body fields', () => {
    const metadata = buildMetadata(
      { body: { name: 'Base Set', password: 'hunter2', extra: 'ignored' } },
      { action: 'a.b', bodyFields: ['name'] },
    );

    expect(metadata).toEqual({ name: 'Base Set' });
    expect(JSON.stringify(metadata)).not.toContain('hunter2');
  });

  it('never copies the body when no field is allowed', () => {
    expect(buildMetadata({ body: { name: 'x' } }, { action: 'a.b' })).toBeNull();
  });

  it('adds the request id and the extra values', () => {
    expect(buildMetadata({ id: 'req-1' }, { action: 'a.b' }, { statusCode: 404 })).toEqual({
      requestId: 'req-1',
      statusCode: 404,
    });
  });

  it('keeps JSON values, drops the ones that cannot be stored', () => {
    const metadata = buildMetadata(
      {
        body: {
          tags: ['a', 1, undefined, () => 1],
          nested: { ok: true, nothing: null, skipped: undefined },
          count: Number.POSITIVE_INFINITY,
        },
      },
      { action: 'a.b', bodyFields: ['tags', 'nested', 'count'] },
    );

    expect(metadata).toEqual({ tags: ['a', 1], nested: { ok: true, nothing: null } });
  });

  it('ignores a body that is not an object', () => {
    expect(buildMetadata({ body: 'raw' }, { action: 'a.b', bodyFields: ['name'] })).toBeNull();
  });

  it('redacts a JWT-shaped value even under an innocuous field name (defense in depth)', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    const metadata = buildMetadata(
      { body: { comment: jwt } },
      { action: 'a.b', bodyFields: ['comment'] },
    );

    expect(metadata).toEqual({ comment: '[redacted]' });
  });

  it('redacts a bcrypt/argon2 hash-shaped value regardless of field name', () => {
    const metadata = buildMetadata(
      {
        body: {
          note: '$2b$10$abcdefghijklmnopqrstuv',
          detail: '$argon2id$v=19$m=65536,t=3,p=4$abc$def',
        },
      },
      { action: 'a.b', bodyFields: ['note', 'detail'] },
    );

    expect(metadata).toEqual({ note: '[redacted]', detail: '[redacted]' });
  });

  it('keeps an ordinary string that merely contains dots', () => {
    const metadata = buildMetadata(
      { body: { version: '1.2.3', name: 'Base Set' } },
      { action: 'a.b', bodyFields: ['version', 'name'] },
    );

    expect(metadata).toEqual({ version: '1.2.3', name: 'Base Set' });
  });
});
