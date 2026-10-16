import { randomUUID } from 'node:crypto';
import { PrismaUserRepository } from '../modules/auth/infrastructure/repositories/PrismaUserRepository';
import { BcryptPasswordHasher } from '../modules/auth/infrastructure/services/BcryptPasswordHasher';
import { JwtAuthTokenService } from '../modules/auth/infrastructure/services/JwtAuthTokenService';
import {
  authTokenServiceContract,
  passwordHasherContract,
  userRepositoryContract,
} from './AuthPorts.contract';
import { createIntegrationPrisma, createTestCodec } from './IntegrationDatabase';

const prisma = createIntegrationPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

userRepositoryContract(
  'PrismaUserRepository (real PostgreSQL)',
  () => new PrismaUserRepository(prisma),
);
passwordHasherContract('BcryptPasswordHasher', () => new BcryptPasswordHasher());
authTokenServiceContract('JwtAuthTokenService (real PostgreSQL)', () => ({
  service: new JwtAuthTokenService(createTestCodec(), prisma, 900, 604800, 2592000),
  createUser: async () => {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: `t${id.slice(0, 8)}@example.com`,
        passwordHash: 'not-a-real-hash',
        username: `tok-${id.slice(0, 8)}`,
        usernameKey: `tok-${id.slice(0, 8)}`,
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      },
    });
    return id;
  },
  liveSessionsOf: (id: string) => prisma.session.count({ where: { userId: id, isRevoked: false } }),
  deactivate: async (id: string) => {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  },
}));
