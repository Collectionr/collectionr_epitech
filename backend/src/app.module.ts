import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { validateEnvironment } from './shared/config/ValidateEnvironment';
import { AllExceptionsFilter } from './shared/interface/filters/AllExceptionsFilter';
import { HealthModule } from './modules/health/HealthModule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: seconds(configService.get<number>('THROTTLE_TTL', 60)),
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
