import { randomUUID } from 'node:crypto';
import { User } from '../modules/auth/domain/entities/User';
import { Email } from '../modules/auth/domain/value-objects/Email';
import { BcryptPasswordHasher } from '../modules/auth/infrastructure/services/BcryptPasswordHasher';
import {
  authTokenServiceContract,
  passwordHasherContract,
  userRepositoryContract,
} from './AuthPorts.contract';
import {
  InMemoryAuthStore,
  InMemoryAuthTokenService,
  InMemoryUserRepository,
} from './InMemoryAuthAdapters';
import { createTestCodec } from './IntegrationDatabase';

// Real bcrypt at cost 12 (the hasher contract) is slow when the whole suite runs in parallel.
jest.setTimeout(30_000);

// The in-memory doubles used by the e2e specs must honour the same contract as the real adapters —
// this runs in the plain unit suite (no infrastructure) and keeps the doubles honest.
userRepositoryContract(
  'InMemoryUserRepository (e2e double)',
  () => new InMemoryUserRepository(new InMemoryAuthStore()),
);
passwordHasherContract('BcryptPasswordHasher', () => new BcryptPasswordHasher());
authTokenServiceContract('InMemoryAuthTokenService (e2e double)', () => {
  const store = new InMemoryAuthStore();
  const repository = new InMemoryUserRepository(store);
  return {
    service: new InMemoryAuthTokenService(store, createTestCodec()),
    createUser: async () => {
      const id = randomUUID();
      const user = await repository.save(
        User.register({
          email: Email.create(`t${id.slice(0, 8)}@example.com`),
          passwordHash: 'not-a-real-hash',
          username: 'tok',
          consentGivenAt: new Date(),
        }),
      );
      return user.id;
    },
    liveSessionsOf: (id: string) => Promise.resolve(store.liveSessionsOf(id)),
    deactivate: async (id: string) => {
      const user = await repository.findById(id);
      if (user !== null) {
        await repository.save(user.deactivate());
      }
    },
  };
});
