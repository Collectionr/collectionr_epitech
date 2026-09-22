import { consumeAuditContext, stashAuditContext } from './AuditRequestContext';
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
