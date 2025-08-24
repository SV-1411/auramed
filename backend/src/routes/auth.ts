import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone('any'),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['PATIENT', 'DOCTOR', 'ADMIN']),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, phone, password, role, firstName, lastName, ...profileData } = req.body;
    const db = getDatabase();

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { phone }]
      }
    });

    if (existingUser) {
      throw createError('User already exists with this email or phone', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with profile
    const user = await db.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role,
        ...(role === 'PATIENT' && {
          patientProfile: {
            create: {
              firstName,
              lastName,
              dateOfBirth: new Date(profileData.dateOfBirth),
              gender: profileData.gender,
              emergencyContact: profileData.emergencyContact,
              preferredLanguage: profileData.preferredLanguage || 'en'
            }
          }
        }),
        ...(role === 'DOCTOR' && {
          doctorProfile: {
            create: {
              firstName,
              lastName,
              licenseNumber: profileData.licenseNumber,
              specialization: profileData.specialization || [],
              experience: profileData.experience || 0,
              qualifications: profileData.qualifications || [],
              consultationFee: profileData.consultationFee || 500,
              languages: profileData.languages || ['en']
            }
          }
        }),
        ...(role === 'ADMIN' && {
          adminProfile: {
            create: {
              firstName,
              lastName,
              department: profileData.department || 'General',
              permissions: profileData.permissions || []
            }
          }
        })
      },
      include: {
        patientProfile: true,
        doctorProfile: true,
        adminProfile: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Store session in Redis
    const redis = getRedis();
    await redis.setUserSession(user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: new Date().toISOString()
    });

    logger.info(`User registered: ${user.email} (${user.role})`);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profile: user.patientProfile || user.doctorProfile || user.adminProfile
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const db = getDatabase();

    // Find user with profile
    const user = await db.user.findUnique({
      where: { email },
      include: {
        patientProfile: true,
        doctorProfile: true,
        adminProfile: true
      }
    });

    if (!user || !user.isActive) {
      throw createError('Invalid credentials', 401);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError('Invalid credentials', 401);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Store session in Redis
    const redis = getRedis();
    await redis.setUserSession(user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: new Date().toISOString()
    });

    logger.info(`User logged in: ${user.email} (${user.role})`);

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profile: user.patientProfile || user.doctorProfile || user.adminProfile
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Logout user
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw createError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const redis = getRedis();
    
    // Remove session from Redis
    await redis.deleteUserSession(decoded.userId);

    logger.info(`User logged out: ${decoded.userId}`);

    res.json({
      status: 'success',
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw createError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const db = getDatabase();

    // Verify user still exists and is active
    const user = await db.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      throw createError('User not found or inactive', 401);
    }

    // Generate new token
    const newToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      status: 'success',
      data: { token: newToken }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw createError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const db = getDatabase();

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: {
        patientProfile: {
          include: {
            familyMembers: true
          }
        },
        doctorProfile: {
          include: {
            availabilitySlots: true,
            qualityMetrics: true
          }
        },
        adminProfile: true
      }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profile: user.patientProfile || user.doctorProfile || user.adminProfile,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
