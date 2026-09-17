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
    message: 'DATABASE_URL doit être une URL de connexion PostgreSQL (postgresql://...)',
  })
  DATABASE_URL!: string;

  @IsString()
  @Matches(/^rediss?:\/\/.+/, {
    message: 'REDIS_URL doit être une URL de connexion Redis (redis://...)',
  })
  REDIS_URL!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET doit contenir au moins 32 caractères',
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
}
