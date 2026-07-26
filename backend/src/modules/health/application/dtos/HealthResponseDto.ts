import { ApiProperty } from '@nestjs/swagger';
import type {
  DependencyState,
  HealthState,
  HealthStatus,
} from '../../domain/entities/HealthStatus';

export class DependencyHealthDto {
  @ApiProperty({ example: 'database', description: 'Nom de la dépendance vérifiée' })
  name!: string;

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: DependencyState;

  @ApiProperty({ nullable: true, example: 12, description: 'Latence de la vérification en ms' })
  latencyMs!: number | null;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: HealthState;

  @ApiProperty({ example: '2026-07-26T12:00:00.000Z' })
  checkedAt!: string;

  @ApiProperty({ type: [DependencyHealthDto] })
  dependencies!: DependencyHealthDto[];

  static fromDomain(healthStatus: HealthStatus): HealthResponseDto {
    const dto = new HealthResponseDto();
    dto.status = healthStatus.state;
    dto.checkedAt = healthStatus.checkedAt.toISOString();
    dto.dependencies = healthStatus.dependencies.map((dependency) => {
      const dependencyDto = new DependencyHealthDto();
      dependencyDto.name = dependency.name;
      dependencyDto.status = dependency.state;
      dependencyDto.latencyMs = dependency.latencyMs;
      return dependencyDto;
    });
    return dto;
  }
}
