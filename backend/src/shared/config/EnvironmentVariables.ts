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

  /**
   * Version of the terms of service currently in force (e.g. "2026-01"). A registration records the
   * version the user accepted and is refused when it differs from this one. Change it whenever the
   * published terms change.
   */
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,32}$/, {
    message: 'TERMS_VERSION must be 1-32 characters among letters, digits, ".", "_" and "-"',
  })
  TERMS_VERSION: string = '1';
}
