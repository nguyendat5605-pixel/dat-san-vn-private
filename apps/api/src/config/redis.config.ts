import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

export interface RedisRuntimeConfig {
  options: RedisOptions;
  mode: 'url' | 'host';
  host: string;
  port: number;
  db: number;
  tlsEnabled: boolean;
}

const LOCAL_REDIS_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function getRedisRuntimeConfig(
  configService: ConfigService,
): RedisRuntimeConfig {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const redisUrl = getNonEmptyConfig(configService, 'REDIS_URL');
  const redisHost = getNonEmptyConfig(configService, 'REDIS_HOST');

  if (!redisUrl && !redisHost && isProduction) {
    throw new Error(
      'Redis configuration is required in production. Set REDIS_URL or REDIS_HOST for BullMQ booking expiration and booking idempotency.',
    );
  }

  const runtimeConfig = redisUrl
    ? parseRedisUrl(redisUrl, configService)
    : buildHostRedisConfig(configService);

  if (
    isProduction &&
    LOCAL_REDIS_HOSTS.has(runtimeConfig.host) &&
    getNonEmptyConfig(configService, 'REDIS_ALLOW_LOCALHOST_IN_PRODUCTION') !==
      'true'
  ) {
    throw new Error(
      'Redis resolved to localhost in production. Set REDIS_URL/REDIS_HOST to a managed Redis endpoint, or explicitly set REDIS_ALLOW_LOCALHOST_IN_PRODUCTION=true.',
    );
  }

  return runtimeConfig;
}

export function createRedisClient(
  configService: ConfigService,
  connectionName: string,
  overrides: RedisOptions = {},
): Redis {
  const runtimeConfig = getRedisRuntimeConfig(configService);

  return new Redis({
    ...runtimeConfig.options,
    ...overrides,
    connectionName,
  });
}

export function describeRedisRuntimeConfig(configService: ConfigService) {
  const runtimeConfig = getRedisRuntimeConfig(configService);

  return {
    mode: runtimeConfig.mode,
    host: runtimeConfig.host,
    port: runtimeConfig.port,
    db: runtimeConfig.db,
    tlsEnabled: runtimeConfig.tlsEnabled,
  };
}

export function logRedisRuntimeConfig(
  configService: ConfigService,
  logger: Logger,
  consumer: string,
) {
  const runtimeConfig = describeRedisRuntimeConfig(configService);

  logger.log(
    `${consumer} Redis enabled via ${runtimeConfig.mode} mode: ${runtimeConfig.host}:${runtimeConfig.port} db=${runtimeConfig.db} tls=${runtimeConfig.tlsEnabled ? 'on' : 'off'}`,
  );
}

function parseRedisUrl(
  redisUrl: string,
  configService: ConfigService,
): RedisRuntimeConfig {
  const parsed = new URL(redisUrl);
  const tlsEnabled =
    parsed.protocol === 'rediss:' ||
    getBooleanConfig(configService, 'REDIS_TLS');
  const dbFromPath = parsed.pathname.replace('/', '');
  const parsedDb = dbFromPath ? Number(dbFromPath) : undefined;
  const db =
    typeof parsedDb === 'number' && Number.isFinite(parsedDb)
      ? parsedDb
      : getNumberConfig(configService, 'REDIS_DB', 0);
  const port = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === 'rediss:'
      ? 6380
      : 6379;
  const options: RedisOptions = {
    ...baseRedisOptions(),
    host: parsed.hostname,
    port,
    db,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: tlsEnabled ? {} : undefined,
  };

  return {
    options,
    mode: 'url',
    host: parsed.hostname,
    port,
    db,
    tlsEnabled,
  };
}

function buildHostRedisConfig(
  configService: ConfigService,
): RedisRuntimeConfig {
  const host = getNonEmptyConfig(configService, 'REDIS_HOST') ?? 'localhost';
  const port = getNumberConfig(configService, 'REDIS_PORT', 6379);
  const db = getNumberConfig(configService, 'REDIS_DB', 0);
  const tlsEnabled = getBooleanConfig(configService, 'REDIS_TLS');
  const options: RedisOptions = {
    ...baseRedisOptions(),
    host,
    port,
    password: getNonEmptyConfig(configService, 'REDIS_PASSWORD'),
    db,
    tls: tlsEnabled ? {} : undefined,
  };

  return {
    options,
    mode: 'host',
    host,
    port,
    db,
    tlsEnabled,
  };
}

function baseRedisOptions(): RedisOptions {
  return {
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  };
}

function getNonEmptyConfig(configService: ConfigService, key: string) {
  const value = configService.get<string>(key);
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumberConfig(
  configService: ConfigService,
  key: string,
  fallback: number,
) {
  const raw = configService.get<string | number>(key);
  const value = typeof raw === 'number' ? raw : Number(raw);

  return Number.isFinite(value) ? value : fallback;
}

function getBooleanConfig(configService: ConfigService, key: string) {
  const raw = configService.get<string | boolean>(key);

  if (typeof raw === 'boolean') {
    return raw;
  }

  return raw === 'true' || raw === '1';
}
