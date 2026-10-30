import { isIP } from 'node:net';

const MAX_PREFIX_IPV4 = 32;
const MAX_PREFIX_IPV6 = 128;

function isAddressOrRange(entry: string): boolean {
  const [address, prefix, ...rest] = entry.split('/');
  const version = isIP(address ?? '');
  if (version === 0 || rest.length > 0) {
    return false;
  }
  if (prefix === undefined) {
    return true;
  }
  return (
    /^\d{1,3}$/.test(prefix) &&
    Number(prefix) <= (version === 6 ? MAX_PREFIX_IPV6 : MAX_PREFIX_IPV4)
  );
}

/**
 * Parses TRUSTED_PROXIES: the addresses/ranges of the reverse proxies (ingress, load balancer) whose
 * X-Forwarded-For may be believed. An explicit list only — "trust everything" would let any client
 * claim any source address and walk around every per-IP limit. Empty means trust nobody (the socket
 * address is the client).
 *
 * @throws Error naming TRUSTED_PROXIES when an entry is not an IP address or CIDR range.
 */
export function parseTrustedProxies(raw: string): string[] {
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const invalid = entries.find((entry) => !isAddressOrRange(entry));
  if (invalid !== undefined) {
    throw new Error(
      `TRUSTED_PROXIES must be a comma-separated list of IP addresses or CIDR ranges ("${invalid}" is not)`,
    );
  }
  return entries;
}
