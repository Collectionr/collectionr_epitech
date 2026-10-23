// Injected before AppModule loads (ConfigModule reads the environment when the module is imported).
// The global in-memory limiter would answer 429 in the middle of these tests, which are not about it.
process.env.THROTTLE_LIMIT = '100000';

import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/AuthModule';
import { JwtAuthGuard } from '../../src/modules/auth/interface/guards/JwtAuthGuard';
import { RolesGuard } from '../../src/modules/auth/interface/guards/RolesGuard';
import { RequireRole } from '../../src/modules/auth/interface/decorators/RequireRole';
import { createAuthTestApp } from './AuthTestDoubles';
import type { AuthTestContext } from './AuthTestDoubles';

// No real admin route exists yet (COLLR-449 is the guard; the first admin feature comes later), so the
// guard is exercised on a probe, as the audit interceptor is exercised on audit-probe.
@Controller('roles-probe')
class RolesProbeController {
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRole('ADMIN')
  admin(): { ok: boolean } {
    return { ok: true };
  }

  // Declares no role: the guard must refuse it, even for an administrator.
  @Get('undeclared')
  @UseGuards(JwtAuthGuard, RolesGuard)
  undeclared(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ imports: [AuthModule], controllers: [RolesProbeController] })
class RolesProbeModule {}

describe('RolesGuard (e2e)', () => {
  let context: AuthTestContext;
  const http = (): ReturnType<typeof request> => request(context.app.getHttpServer());

  beforeAll(async () => {
    context = await createAuthTestApp({ extraModules: [RolesProbeModule] });
  });

  afterAll(async () => {
    await context.app.close();
  });

  /** A real account in the store, with the role the test gives it, and a real access token. */
  async function accountWithRole(role: 'USER' | 'ADMIN'): Promise<string> {
    const response = await http()
      .post('/api/v1/auth/register')
      .send({
        email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`,
        password: 'Str0ngPassw0rd!',
        username: `${role.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        acceptedTermsVersion: '1',
      });
    const { id } = response.body as { id: string };
    context.roles.setRole(id, role);
    const pair = await context.tokens.issueTokenPair(id);
    return pair.accessToken;
  }

  it('answers 401 without a token: JwtAuthGuard runs before the role check', async () => {
    await http().get('/api/v1/roles-probe/admin').expect(401);
  });

  it('answers 403 to a USER on an ADMIN route', async () => {
    const token = await accountWithRole('USER');

    await http()
      .get('/api/v1/roles-probe/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('answers 200 to an ADMIN on an ADMIN route', async () => {
    const token = await accountWithRole('ADMIN');

    await http()
      .get('/api/v1/roles-probe/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('answers 403 to an ADMIN on a route that declares no role (fail closed)', async () => {
    const token = await accountWithRole('ADMIN');

    await http()
      .get('/api/v1/roles-probe/undeclared')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
