import { Inject, Injectable } from '@nestjs/common';
import { SESSION_PURGER } from '../ports/ISessionPurger';
import type { ISessionPurger } from '../ports/ISessionPurger';

@Injectable()
export class PurgeExpiredSessionsUseCase {
  constructor(@Inject(SESSION_PURGER) private readonly sessionPurger: ISessionPurger) {}

  async execute(): Promise<number> {
    return this.sessionPurger.purgeExpiredSessions(new Date());
  }
}
