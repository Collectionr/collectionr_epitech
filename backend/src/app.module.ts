import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './shared/config/ValidateEnvironment';
import { AllExceptionsFilter } from './shared/interface/filters/AllExceptionsFilter';
import { HealthModule } from './modules/health/HealthModule';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), HealthModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
