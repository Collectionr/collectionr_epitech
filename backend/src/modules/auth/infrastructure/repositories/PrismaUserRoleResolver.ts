import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { ROLE_NAMES } from '../../../../shared/config/AppConstants';
import type { RoleName } from '../../../../shared/config/AppConstants';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import type { IUserRoleResolver } from '../../application/ports/IUserRoleResolver';

@Injectable()
export class PrismaUserRoleResolver implements IUserRoleResolver {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async roleOf(userId: string): Promise<RoleName | null> {
    // The column is a uuid: anything else cannot match, and would otherwise be a database error.
    if (!isUuid(userId)) {
      return null;
    }
    const found = await this.prismaClient.user.findUnique({
      where: { id: userId },
      select: { role: { select: { name: true } } },
    });
    return knownRole(found?.role.name);
  }
}

/** A stored role counts only if the code knows it: a leftover row (e.g. a retired role) is refused. */
function knownRole(name: string | undefined): RoleName | null {
  return ROLE_NAMES.find((known) => known === name) ?? null;
}
