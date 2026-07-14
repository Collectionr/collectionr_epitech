export type HealthState = 'ok' | 'degraded';

export class HealthStatus {
  constructor(
    public readonly state: HealthState,
    public readonly checkedAt: Date,
  ) {}
}
