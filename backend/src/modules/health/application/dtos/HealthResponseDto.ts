import type {
  DependencyState,
  HealthState,
  HealthStatus,
} from '../../domain/entities/HealthStatus';

export class DependencyHealthDto {
  name!: string;
  status!: DependencyState;
  latencyMs!: number | null;
}

export class HealthResponseDto {
  status!: HealthState;
  checkedAt!: string;
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
