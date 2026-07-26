export type HealthState = 'ok' | 'degraded';
export type DependencyState = 'up' | 'down';

export class DependencyHealth {
  constructor(
    public readonly name: string,
    public readonly state: DependencyState,
    public readonly latencyMs: number | null,
  ) {}

  isUp(): boolean {
    return this.state === 'up';
  }
}

export class HealthStatus {
  constructor(
    public readonly state: HealthState,
    public readonly checkedAt: Date,
    public readonly dependencies: readonly DependencyHealth[],
  ) {}

  static fromDependencies(
    checkedAt: Date,
    dependencies: readonly DependencyHealth[],
  ): HealthStatus {
    const state: HealthState = dependencies.every((dependency) => dependency.isUp())
      ? 'ok'
      : 'degraded';

    return new HealthStatus(state, checkedAt, dependencies);
  }

  isHealthy(): boolean {
    return this.state === 'ok';
  }
}
