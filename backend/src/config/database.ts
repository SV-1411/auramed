import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export async function initializeDatabase(): Promise<PrismaClient> {
  try {
    prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });

    await prisma.$connect();
    logger.info('Database connected successfully');
    
    return prisma;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export function getDatabase(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}
