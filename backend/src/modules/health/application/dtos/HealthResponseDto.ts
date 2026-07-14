import { HealthStatus } from '../../domain/entities/HealthStatus';

export class HealthResponseDto {
  status!: string;
  checkedAt!: string;

  static fromDomain(healthStatus: HealthStatus): HealthResponseDto {
    const dto = new HealthResponseDto();
    dto.status = healthStatus.state;
    dto.checkedAt = healthStatus.checkedAt.toISOString();
    return dto;
  }
}
