import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { IPasswordHasher } from '../../application/ports/IPasswordHasher';

/** Cost factor for bcrypt hashing. Fixed (not env-specific): a security-reviewed value, not config. */
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, BCRYPT_SALT_ROUNDS);
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return compare(plainPassword, passwordHash);
  }
}
