import { RedisService } from '../services/RedisService';
import { logger } from '../utils/logger';

let redisService: RedisService;

export async function connectRedis(): Promise<RedisService | null> {
  // Skip Redis initialization if REDIS_URL is not set or explicitly disabled
  if (!process.env.REDIS_URL || process.env.DISABLE_REDIS === 'true') {
    logger.info('Redis disabled - running without cache');
    redisService = null as any;
    return null;
  }

  try {
    redisService = new RedisService();
    await redisService.connect();
    logger.info('Redis service initialized');
    return redisService;
  } catch (error) {
    logger.warn('Redis not available - running without cache:', (error as Error).message);
    redisService = null as any;
    return null;
  }
}

export function getRedis(): RedisService | null {
  return redisService || null;
}

export async function disconnectRedis(): Promise<void> {
  if (redisService) {
    await redisService.disconnect();
    logger.info('Redis disconnected');
  }
}
