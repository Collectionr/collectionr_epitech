import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/HealthModule';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
