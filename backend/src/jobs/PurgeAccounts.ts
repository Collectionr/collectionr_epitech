import 'dotenv/config';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../app.module';
import { AnonymizeDueAccountsUseCase } from '../modules/auth/application/use-cases/AnonymizeDueAccountsUseCase';
import { JOB_EXIT_FAILURE, runPurgeAccountsJob } from './PurgeAccountsJob';

/**
 * `npm run purge:accounts`: the daily account purge (RGPD), run by the CronJob of COLLR-544 with the
 * API's image and environment. Boots the same AppModule as the API, without listening on a port.
 */
async function main(): Promise<number> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  try {
    app.useLogger(app.get(Logger));
    const useCase = app.get(AnonymizeDueAccountsUseCase, { strict: false });
    return await runPurgeAccountsJob(() => useCase.execute(), new NestLogger('PurgeAccounts'));
  } finally {
    // Closes the database pool and the Redis client: without it the process would stay alive.
    await app.close();
  }
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error: unknown) => {
    console.error(
      `Account purge could not start (${error instanceof Error ? error.name : 'unknown error'})`,
    );
    process.exit(JOB_EXIT_FAILURE);
  });
