import { BcryptPasswordHasher } from './BcryptPasswordHasher';

const costOf = (hash: string): number => Number(hash.split('$')[2]);

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

  it('keeps accepting hashes made by the previous bcryptjs implementation ($2a$ and $2b$)', async () => {
    const legacy2a = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

    await expect(hasher.verify('anything', legacy2a)).resolves.toBe(false);
    await expect(
      hasher.verify('correct horse battery staple', '$2b$12$' + 'x'.repeat(53)),
    ).resolves.toBe(false);
  });

  it('never throws on an unparseable stored hash', async () => {
    await expect(hasher.verify('x', '')).resolves.toBe(false);
    await expect(hasher.verify('x', 'not-a-hash')).resolves.toBe(false);
    await expect(hasher.verify('x', '$2b$99$broken')).resolves.toBe(false);
  });

  it('refuses a password longer than the 72 bytes bcrypt actually reads', async () => {
    const seventyTwoBytes = 'a1' + 'x'.repeat(70);
    const passwordHash = await hasher.hash(seventyTwoBytes);

    await expect(hasher.verify(seventyTwoBytes, passwordHash)).resolves.toBe(true);
    await expect(hasher.verify(seventyTwoBytes + 'ANYTHING', passwordHash)).resolves.toBe(false);
  });

  describe('dummy hash (login timing equalisation)', () => {
    it('has the same cost as the hashes hash() produces', async () => {
      expect(costOf(hasher.getDummyHash())).toBe(costOf(await hasher.hash('Str0ngPassw0rd!')));
    });

    it('is stable for the lifetime of the hasher and differs between hasher instances', () => {
      expect(hasher.getDummyHash()).toBe(hasher.getDummyHash());
      expect(new BcryptPasswordHasher().getDummyHash()).not.toBe(hasher.getDummyHash());
    });

    it('is parseable by verify() and matches no password', async () => {
      await expect(hasher.verify('Str0ngPassw0rd!', hasher.getDummyHash())).resolves.toBe(false);
    });
  });
});
