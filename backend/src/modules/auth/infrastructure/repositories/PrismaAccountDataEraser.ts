import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import type { IAccountDataEraser } from '../../application/ports/IAccountDataEraser';

/**
 * Erases what a user owns across modules in one transaction. The collections table belongs to the
 * collection module, but the user's erasure is decided here (ADR-018): going through that module would
 * make auth depend on it, the wrong way round, for a plain `DELETE ... WHERE userId`. The card entries
 * go with their collection (ON DELETE CASCADE). The audit entries stay (legal retention, S04 §5), minus
 * the email they may carry in `metadata`.
 */
@Injectable()
export class PrismaAccountDataEraser implements IAccountDataEraser {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async eraseAccountData(userId: string): Promise<void> {
    // The column is a uuid: anything else owns nothing, and would otherwise surface as a database error.
    if (!isUuid(userId)) {
      return;
    }
    await this.prismaClient.$transaction([
      this.prismaClient.session.deleteMany({ where: { userId } }),
      this.prismaClient.collection.deleteMany({ where: { userId } }),
      // What the `users_purge_audit_pii` trigger does when a row is DELETEd (migration
      // 20261009120000): the account's row is anonymized here, never deleted, so the trigger would
      // never fire and the email an audit entry may carry would outlive the account.
      this.prismaClient.$executeRaw`UPDATE "audit_logs" SET "metadata" = "metadata" - 'email'
        WHERE "userId" = ${userId}::uuid AND "metadata" ? 'email'`,
    ]);
  }
}
