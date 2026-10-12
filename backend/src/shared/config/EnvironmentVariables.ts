import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a PostgreSQL connection URL (postgresql://...)',
  })
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  DATABASE_POOL_MAX: number = 5;

  @IsString()
  @Matches(/^rediss?:\/\/.+/, {
    message: 'REDIS_URL must be a Redis connection URL (redis://...)',
  })
  REDIS_URL!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters long',
  })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_TTL: number = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 100;

  @Transform(({ value }) => value === true || value === 'true')
  SWAGGER_ENABLED: boolean = false;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUDIT_LOG_RETENTION_DAYS: number = 90;

  @Type(() => Number)
  @IsInt()
  @Min(8)
  @Max(64)
  PASSWORD_MIN_LENGTH: number = 8;

  /** Access token lifetime, in seconds (default 900 = 15 min, S03 §4.2). Capped: tokens are stateless between checks. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  JWT_ACCESS_TOKEN_TTL_SECONDS: number = 900;

  /** Refresh token lifetime, in seconds (default 604800 = 7 days, S03 §4.2). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2592000)
  JWT_REFRESH_TOKEN_TTL_SECONDS: number = 604800;

  /**
   * Hard end of a login chain, in seconds (default 2592000 = 30 days): however often it is refreshed,
   * a session cannot outlive this — otherwise a stolen refresh token that keeps rotating lives forever.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7776000)
  JWT_SESSION_MAX_LIFETIME_SECONDS: number = 2592000;

  /** Max /auth/login attempts per account and address within the window below (default 5, S03 §7). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  AUTH_LOGIN_RATE_LIMIT: number = 5;

  /** Window for AUTH_LOGIN_RATE_LIMIT, in seconds (default 60, S03 §7). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: number = 60;

  /** How long a login is refused once the limit is exceeded, in seconds (default 900 = 15 min, S03 §7). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  AUTH_LOGIN_BLOCK_SECONDS: number = 900;

  /** Max /auth/register attempts per address within the window below (default 10, S03 §7 — indicative). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  AUTH_REGISTER_RATE_LIMIT: number = 10;

  /** Window for AUTH_REGISTER_RATE_LIMIT, in seconds (default 3600, S03 §7 — indicative). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS: number = 3600;

  /**
   * Reverse proxies (ingress, load balancer) whose X-Forwarded-For is believed: comma-separated IP
   * addresses or CIDR ranges. Empty (default) trusts nobody. Validated in ValidateEnvironment.ts.
   */
  @IsString()
  TRUSTED_PROXIES: string = '';
}
