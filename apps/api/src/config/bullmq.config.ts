import { BullRootModuleOptions } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getRedisRuntimeConfig,
  logRedisRuntimeConfig,
} from './redis.config.js';

const logger = new Logger('BullMQConfig');

export const getBullMQConfig = (
  configService: ConfigService,
): BullRootModuleOptions => {
  const redisConfig = getRedisRuntimeConfig(configService);
  logRedisRuntimeConfig(configService, logger, 'BullMQ');

  return {
    connection: redisConfig.options,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
};
