import { isSensitiveFieldName } from './SensitiveFields';

describe('isSensitiveFieldName', () => {
  it.each([
    'password',
    'newPassword',
    'passwd',
    'passwordHash',
    'accessToken',
    'refresh_token',
    'clientSecret',
    'Authorization',
    'cookie',
    'jwt',
    'otp',
    'apiKey',
    'api_key',
    'pin',
    'cvv',
    'ssn',
    'iban',
  ])('flags "%s" as sensitive', (fieldName) => {
    expect(isSensitiveFieldName(fieldName)).toBe(true);
  });

  it.each(['name', 'email', 'collectionId', 'language', 'quantity', 'pinnedCard', 'primaryKey'])(
    'does not flag "%s"',
    (fieldName) => {
      expect(isSensitiveFieldName(fieldName)).toBe(false);
    },
  );
});
