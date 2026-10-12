import { FastifyAdapter } from '@nestjs/platform-fastify';
import { parseTrustedProxies } from '../config/TrustedProxies';

/**
 * The HTTP adapter, with `trustProxy` set from TRUSTED_PROXIES. Built before the Nest container exists
 * (Fastify takes this option at construction), which is why it cannot live in configureApp() with the
 * rest of the cross-cutting setup.
 *
 * Without a trusted list `request.ip` is the socket address — behind an ingress, the ingress. Every
 * per-IP limit then treats all clients as one. With a list, only a hop in it may set X-Forwarded-For.
 */
export function createFastifyAdapter(trustedProxies: string): FastifyAdapter {
  const proxies = parseTrustedProxies(trustedProxies);
  return new FastifyAdapter({ trustProxy: proxies.length > 0 ? proxies : false });
}
