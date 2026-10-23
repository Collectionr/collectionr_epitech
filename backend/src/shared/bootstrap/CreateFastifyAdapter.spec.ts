import { createFastifyAdapter } from './CreateFastifyAdapter';

async function clientIpSeenBy(
  trustedProxies: string,
  socketAddress: string,
  forwardedFor: string,
): Promise<string> {
  const adapter = createFastifyAdapter(trustedProxies);
  const fastify = adapter.getInstance();
  fastify.get('/ip', (request) => request.ip);
  await fastify.ready();

  const response = await fastify.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress: socketAddress,
    headers: { 'x-forwarded-for': forwardedFor },
  });
  await fastify.close();
  return response.body;
}

describe('createFastifyAdapter', () => {
  it('ignores X-Forwarded-For when no proxy is trusted: a client cannot choose its own address', async () => {
    await expect(clientIpSeenBy('', '198.51.100.7', '203.0.113.99')).resolves.toBe('198.51.100.7');
  });

  it('believes X-Forwarded-For when the connection comes from a trusted proxy', async () => {
    await expect(clientIpSeenBy('10.0.0.0/8', '10.1.2.3', '203.0.113.99')).resolves.toBe(
      '203.0.113.99',
    );
  });

  it('ignores X-Forwarded-For from an address that is not a trusted proxy', async () => {
    await expect(clientIpSeenBy('10.0.0.0/8', '198.51.100.7', '203.0.113.99')).resolves.toBe(
      '198.51.100.7',
    );
  });

  it('refuses a blind-trust value instead of silently trusting everyone', () => {
    expect(() => createFastifyAdapter('*')).toThrow(/TRUSTED_PROXIES/);
  });
});
