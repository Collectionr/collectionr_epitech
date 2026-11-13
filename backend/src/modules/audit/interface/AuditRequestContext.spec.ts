import {
  consumeAuditContext,
  readAuditSubject,
  setAuditSubject,
  stashAuditContext,
} from './AuditRequestContext';
import type { AuditOptions } from './decorators/Audit';

const options: AuditOptions = { action: 'collection.create' };

describe('AuditRequestContext', () => {
  it('returns undefined when nothing was stashed', () => {
    expect(consumeAuditContext({})).toBeUndefined();
  });

  it('returns the stashed options exactly once', () => {
    const request = {};

    stashAuditContext(request, options);

    expect(consumeAuditContext(request)).toBe(options);
    expect(consumeAuditContext(request)).toBeUndefined();
  });
});

describe('audit subject (what a handler knows and the route cannot declare)', () => {
  it('is empty until a handler sets it', () => {
    expect(readAuditSubject({})).toEqual({});
  });

  it('keeps what was set, and successive calls add up rather than replace', () => {
    const request = {};

    setAuditSubject(request, { metadata: { email: 'a@example.com' } });
    setAuditSubject(request, { actorId: 'actor', targetId: 'target', metadata: { count: 2 } });

    expect(readAuditSubject(request)).toEqual({
      actorId: 'actor',
      targetId: 'target',
      metadata: { email: 'a@example.com', count: 2 },
    });
  });

  it('survives being read twice (unlike the stashed @Audit options, it is not consumed)', () => {
    const request = {};
    setAuditSubject(request, { actorId: 'actor' });

    readAuditSubject(request);

    expect(readAuditSubject(request)).toEqual({ actorId: 'actor' });
  });
});
