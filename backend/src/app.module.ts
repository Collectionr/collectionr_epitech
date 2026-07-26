import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './shared/config/ValidateEnvironment';
import { HealthModule } from './modules/health/HealthModule';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), HealthModule],
})
export class AppModule {}
