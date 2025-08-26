"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../config/redis");
const errorHandler_1 = require("./errorHandler");
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            throw (0, errorHandler_1.createError)('Access token required', 401);
        }
        // Verify JWT token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Check if session exists in Redis
        const redis = (0, redis_1.getRedis)();
        const session = await redis.getUserSession(decoded.userId);
        if (!session) {
            throw (0, errorHandler_1.createError)('Session expired', 401);
        }
        // Attach user info to request
        req.user = {
            id: decoded.userId,
            userId: decoded.userId,
            role: decoded.role
        };
        next();
    }
    catch (error) {
        if (error.name === 'JsonWebTokenError') {
            next((0, errorHandler_1.createError)('Invalid token', 401));
        }
        else if (error.name === 'TokenExpiredError') {
            next((0, errorHandler_1.createError)('Token expired', 401));
        }
        else {
            next(error);
        }
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return next((0, errorHandler_1.createError)('Authentication required', 401));
        }
        const allowedRoles = Array.isArray(role) ? role : [role];
        if (!allowedRoles.includes(req.user.role)) {
            return next((0, errorHandler_1.createError)('Insufficient permissions', 403));
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map