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

  it('falls back to the actor a handler declared (login/register: nobody is authenticated yet)', () => {
    expect(readActorId({ auditSubject: { actorId: UUID } })).toBe(UUID);
  });

  it('prefers the authenticated user over a declared actor', () => {
    const other = '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e';

    expect(readActorId({ user: { id: UUID }, auditSubject: { actorId: other } })).toBe(UUID);
  });

  it('ignores a declared actor that is not a UUID', () => {
    expect(readActorId({ auditSubject: { actorId: 'not-a-uuid' } })).toBeNull();
  });
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

describe('readTargetId — declared by the handler', () => {
  it('uses the target a handler declared when the route has no id parameter', () => {
    expect(readTargetId({ auditSubject: { targetId: UUID } }, { action: 'a.b' })).toBe(UUID);
  });

  it('ignores a declared target that is not a UUID', () => {
    expect(readTargetId({ auditSubject: { targetId: 'x' } }, { action: 'a.b' })).toBeNull();
  });
});

describe('buildMetadata — declared by the handler', () => {
  it('merges the metadata a handler declared', () => {
    expect(
      buildMetadata(
        { id: 'req-1', auditSubject: { metadata: { email: 'a@example.com' } } },
        { action: 'a.b' },
      ),
    ).toEqual({ requestId: 'req-1', email: 'a@example.com' });
  });

  it('redacts a declared value shaped like a token or a hash, like any other value', () => {
    const metadata = buildMetadata(
      {
        auditSubject: {
          metadata: { note: '$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz0123' },
        },
      },
      { action: 'a.b' },
    );

    expect(metadata).toEqual({ note: '[redacted]' });
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
