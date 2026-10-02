import type { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { JwtTokenCodec } from './JwtTokenCodec';

const SECRET = 'a-test-secret-of-at-least-32-characters';

function buildConfigService(secret: string): ConfigService {
  return { get: () => secret } as unknown as ConfigService;
}

describe('JwtTokenCodec', () => {
  it('signs a payload and verifies it back', () => {
    const codec = new JwtTokenCodec(buildConfigService(SECRET));

    const token = codec.sign({ sub: 'user-1' }, 900);
    const payload = codec.verify<{ sub: string }>(token);

    expect(payload.sub).toBe('user-1');
  });

  it('throws on a token signed with a different secret', () => {
    const codec = new JwtTokenCodec(buildConfigService(SECRET));
    const foreignToken = jwt.sign({ sub: 'user-1' }, 'a-different-secret-of-32-characters');

    expect(() => codec.verify(foreignToken)).toThrow();
  });

  it('throws on an expired token', () => {
    const codec = new JwtTokenCodec(buildConfigService(SECRET));
    const expiredToken = jwt.sign({ sub: 'user-1' }, SECRET, { expiresIn: -1 });

    expect(() => codec.verify(expiredToken)).toThrow();
  });
});
