import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export async function initializeDatabase(): Promise<PrismaClient> {
  try {
    prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      datasources: {
        db: {
          url: process.env.MONGODB_URI,
        },
      },
    });

    // Set connection timeout
    await prisma.$connect();
    logger.info('Database connected successfully');

    return prisma;
  } catch (error) {
    logger.error('Database connection failed:', error);

    // If MongoDB Atlas fails, log helpful message
    if (error instanceof Error && error.message.includes('Server selection timeout')) {
      logger.error(`
        MongoDB Atlas Connection Failed!
        Possible solutions:
        1. Resume your MongoDB Atlas cluster (it might be paused)
        2. Check your IP whitelist in MongoDB Atlas
        3. Verify your connection string is correct
        4. Consider using local MongoDB for development
      `);
    }

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
