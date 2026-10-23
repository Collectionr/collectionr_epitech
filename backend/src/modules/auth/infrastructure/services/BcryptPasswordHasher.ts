import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { compare, hash, hashSync } from 'bcrypt';
import type { IPasswordHasher } from '../../application/ports/IPasswordHasher';

/** Cost factor for bcrypt hashing. Fixed (not env-specific): a security-reviewed value, not config. */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Native bcrypt (libuv thread pool), not bcryptjs: the pure-JS implementation runs on the event
 * loop, so a handful of concurrent logins (~230 ms each at cost 12) froze every other request,
 * /health included — enough for a K3s probe to restart the pod. Hashes are interchangeable with
 * bcryptjs ($2a$/$2b$), so existing accounts keep working.
 */
@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  // bcrypt reads the first 72 BYTES of its input and silently ignores the rest. This is the one place
  // that knows it: the domain enforces the ceiling through the port (Password.create).
  readonly maxPasswordBytes = 72;

  // Computed once at construction (so at application boot) with the SAME cost as hash(): the
  // hasher is the only one who knows its work factor, which is what makes the "unknown account"
  // branch of the login exactly as slow as the "known account" one. Synchronous on purpose: a
  // one-off ~250 ms at startup, never on the request path.
  private readonly dummyHash = hashSync(randomBytes(32).toString('hex'), BCRYPT_SALT_ROUNDS);

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, BCRYPT_SALT_ROUNDS);
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    // bcrypt would silently compare only the first 72 bytes: "<72 bytes>ANYTHING" must not pass.
    // A password this long can never have been stored, so answering early reveals nothing.
    if (Buffer.byteLength(plainPassword, 'utf8') > this.maxPasswordBytes) {
      return false;
    }

    try {
      return await compare(plainPassword, passwordHash);
    } catch {
      // A hash the library cannot parse is "does not match", never a 500.
      return false;
    }
  }

  getDummyHash(): string {
    return this.dummyHash;
  }
}
