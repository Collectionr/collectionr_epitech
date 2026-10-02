import { BcryptPasswordHasher } from './BcryptPasswordHasher';

// Same "foreign" hash LoginUserUseCase compares against for an unknown account
// (LoginUserUseCase.ts) — verify() must accept it without throwing (anti-timing-attack fix).
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password to a value verify() accepts back', async () => {
    const passwordHash = await hasher.hash('Str0ngPassw0rd!');

    await expect(hasher.verify('Str0ngPassw0rd!', passwordHash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await hasher.hash('Str0ngPassw0rd!');

    await expect(hasher.verify('WrongPassword!', passwordHash)).resolves.toBe(false);
  });

  it('produces a distinct hash for the same password (random salt)', async () => {
    const first = await hasher.hash('Str0ngPassw0rd!');
    const second = await hasher.hash('Str0ngPassw0rd!');

    expect(first).not.toBe(second);
  });

  it('accepts the syntactically valid dummy hash used by LoginUserUseCase without throwing', async () => {
    await expect(hasher.verify('anything', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
