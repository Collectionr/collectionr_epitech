import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/AuthModule';
import { JwtAuthGuard } from '../../src/modules/auth/interface/guards/JwtAuthGuard';
import { CurrentUser } from '../../src/modules/auth/interface/decorators/CurrentUser';
import type { AuthenticatedUser } from '../../src/modules/auth/interface/guards/JwtAuthGuard';
import { createAuthTestApp } from './AuthTestDoubles';
import type { AuthTestContext } from './AuthTestDoubles';

// Injected before AppModule loads: the global limiter is not under test.
process.env.THROTTLE_LIMIT = '100000';

jest.setTimeout(60_000);

// A module that is NOT AuthModule, protecting its own route with the exported guard — what every
// future module (collections, scan...) will do. Exporting the guard without what it injects used to
// make this fail to resolve at startup.
@Controller('protected-probe')
class ProtectedProbeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  whoAmI(@CurrentUser() user: AuthenticatedUser): { id: string } {
    return { id: user.id };
  }
}

@Module({ imports: [AuthModule], controllers: [ProtectedProbeController] })
class ProtectedProbeModule {}

describe('JwtAuthGuard used from another module (e2e)', () => {
  let context: AuthTestContext;

  beforeAll(async () => {
    context = await createAuthTestApp({ extraModules: [ProtectedProbeModule] });
  });

  afterAll(async () => {
    await context.app.close();
  });

  it('rejects a request without a token', async () => {
    const response = await request(context.app.getHttpServer()).get('/api/v1/protected-probe');

    expect(response.status).toBe(401);
  });

  it("authenticates the same access token that works on the auth module's own routes", async () => {
    const credentials = {
      email: 'reuse@example.com',
      password: 'Str0ngPassw0rd!',
      username: 'reuse_user',
      hasAcceptedTerms: true,
    };
    const registered = await request(context.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(credentials);
    const login = await request(context.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const { accessToken } = login.body as { accessToken: string };

    const response = await request(context.app.getHttpServer())
      .get('/api/v1/protected-probe')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: (registered.body as { id: string }).id });
  });
});
