export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/** Application port: the hashing algorithm (bcrypt, per docs/security/S04-rgpd-conformite.md) is an infrastructure concern. */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}
