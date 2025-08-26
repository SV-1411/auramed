"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
exports.getDatabase = getDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
let prisma;
async function initializeDatabase() {
    try {
        prisma = new client_1.PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
        await prisma.$connect();
        logger_1.logger.info('Database connected successfully');
        return prisma;
    }
    catch (error) {
        logger_1.logger.error('Database connection failed:', error);
        throw error;
    }
}
function getDatabase() {
    if (!prisma) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return prisma;
}
async function disconnectDatabase() {
    if (prisma) {
        await prisma.$disconnect();
        logger_1.logger.info('Database disconnected');
    }
}
//# sourceMappingURL=database.js.map