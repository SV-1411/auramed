"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = connectRedis;
exports.getRedis = getRedis;
exports.disconnectRedis = disconnectRedis;
const RedisService_1 = require("../services/RedisService");
const logger_1 = require("../utils/logger");
let redisService;
async function connectRedis() {
    try {
        redisService = new RedisService_1.RedisService();
        await redisService.connect();
        logger_1.logger.info('Redis service initialized');
        return redisService;
    }
    catch (error) {
        logger_1.logger.error('Redis initialization failed:', error);
        throw error;
    }
}
function getRedis() {
    if (!redisService) {
        throw new Error('Redis not initialized. Call connectRedis() first.');
    }
    return redisService;
}
async function disconnectRedis() {
    if (redisService) {
        await redisService.disconnect();
        logger_1.logger.info('Redis disconnected');
    }
}
//# sourceMappingURL=redis.js.map