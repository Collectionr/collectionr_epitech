import { Reflector } from '@nestjs/core';
import { Audit, AUDIT_METADATA_KEY } from './Audit';
import type { AuditOptions } from './Audit';

describe('@Audit', () => {
  it('stores the options on the handler', () => {
    class Probe {
      @Audit({ action: 'collection.create', targetType: 'collection', bodyFields: ['name'] })
      handler(this: void): void {}
    }

    const options = new Reflector().get<AuditOptions>(AUDIT_METADATA_KEY, Probe.prototype.handler);

    expect(options).toEqual({
      action: 'collection.create',
      targetType: 'collection',
      bodyFields: ['name'],
    });
  });

  it('rejects an action that does not follow the domain.verb format', () => {
    expect(() => Audit({ action: 'createCollection' })).toThrow(/invalid action/);
  });

  it.each(['password', 'newPassword', 'accessToken', 'apiSecret'])(
    'refuses to audit the sensitive body field "%s"',
    (field) => {
      expect(() => Audit({ action: 'user.update', bodyFields: ['name', field] })).toThrow(
        new RegExp(`"${field}" is sensitive`),
      );
    },
  );
});
