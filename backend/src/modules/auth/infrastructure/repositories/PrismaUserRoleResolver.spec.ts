import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PrismaUserRoleResolver } from './PrismaUserRoleResolver';

const USER_ID = '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e';

function build(): { resolver: PrismaUserRoleResolver; findUnique: jest.Mock } {
  const findUnique = jest.fn();
  const prismaClient = { user: { findUnique } } as unknown as PrismaClient;
  return { resolver: new PrismaUserRoleResolver(prismaClient), findUnique };
}

describe('PrismaUserRoleResolver', () => {
  it('returns the name of the role the user is linked to', async () => {
    const { resolver, findUnique } = build();
    findUnique.mockResolvedValue({ role: { name: 'ADMIN' } });

    await expect(resolver.roleOf(USER_ID)).resolves.toBe('ADMIN');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { role: { select: { name: true } } },
    });
  });

  it('returns null when the user does not exist', async () => {
    const { resolver, findUnique } = build();
    findUnique.mockResolvedValue(null);

    await expect(resolver.roleOf(USER_ID)).resolves.toBeNull();
  });

  it('returns null for a stored role the code does not know (a retired role is refused, not trusted)', async () => {
    const { resolver, findUnique } = build();
    findUnique.mockResolvedValue({ role: { name: 'MODERATOR' } });

    await expect(resolver.roleOf(USER_ID)).resolves.toBeNull();
  });

  it('returns null for an id that is not a UUID, without querying (the column is a uuid)', async () => {
    const { resolver, findUnique } = build();

    await expect(resolver.roleOf('not-a-uuid')).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
