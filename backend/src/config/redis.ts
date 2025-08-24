import { RedisService } from '../services/RedisService';
import { logger } from '../utils/logger';

let redisService: RedisService;

export async function connectRedis(): Promise<RedisService> {
  try {
    redisService = new RedisService();
    await redisService.connect();
    logger.info('Redis service initialized');
    return redisService;
  } catch (error) {
    logger.error('Redis initialization failed:', error);
    throw error;
  }
}

export function getRedis(): RedisService {
  if (!redisService) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisService;
}

export async function disconnectRedis(): Promise<void> {
  if (redisService) {
    await redisService.disconnect();
    logger.info('Redis disconnected');
  }
}
