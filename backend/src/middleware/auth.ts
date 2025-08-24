import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRedis } from '../config/redis';
import { createError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    role: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError('Access token required', 401);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Check if session exists in Redis
    const redis = getRedis();
    const session = await redis.getUserSession(decoded.userId);
    
    if (!session) {
      throw createError('Session expired', 401);
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      next(createError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(createError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

export const requireRole = (role: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};
