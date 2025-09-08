import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  // Accept 10-15 digit phone numbers with optional leading +
  body('phone').customSanitizer((v) => String(v)).matches(/^\+?\d{10,15}$/).withMessage('Phone must be 10-15 digits'),
  body('password').isLength({ min: 8 }),
  // Allow role in any case
  body('role').customSanitizer((v) => (typeof v === 'string' ? v.toUpperCase() : v)).isIn(['PATIENT', 'DOCTOR', 'ADMIN']),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, phone, password, role, firstName, lastName, ...profileData } = req.body;
    
    // Normalize doctor-specific fields to correct types to satisfy Prisma schema
    const doctorNormalized = {
      licenseNumber: profileData.licenseNumber ? String(profileData.licenseNumber) : undefined,
      specialization: Array.isArray(profileData.specialization)
        ? profileData.specialization.map((s: any) => String(s))
        : [],
      experience: profileData.experience !== undefined && profileData.experience !== null && profileData.experience !== ''
        ? Number(profileData.experience)
        : 0,
      qualifications: Array.isArray(profileData.qualifications)
        ? profileData.qualifications.map((q: any) => String(q))
        : [],
      consultationFee: profileData.consultationFee !== undefined && profileData.consultationFee !== null && profileData.consultationFee !== ''
        ? Number(profileData.consultationFee)
        : 500,
      languages: Array.isArray(profileData.languages)
        ? profileData.languages.map((l: any) => String(l))
        : ['en']
    };
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
                            gender: (profileData.gender ? String(profileData.gender).toUpperCase() : 'OTHER') as any,
                            ...(profileData.emergencyContact ? { emergencyContact: profileData.emergencyContact } : { emergencyContact: phone }),
              preferredLanguage: profileData.preferredLanguage || 'en'
            }
          }
        }),
        ...(role === 'DOCTOR' && {
          doctorProfile: {
            create: {
              firstName,
              lastName,
              licenseNumber: doctorNormalized.licenseNumber as string,
              specialization: doctorNormalized.specialization,
              experience: doctorNormalized.experience,
              qualifications: doctorNormalized.qualifications,
              consultationFee: doctorNormalized.consultationFee,
              languages: doctorNormalized.languages
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

    // Generate JWT token (persistent session - 30 days)
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as jwt.Secret,
      ({ expiresIn: '30d' } as SignOptions) // 30 days persistent session
    );

    // Store session in Redis (skip if Redis not available)
    const redis = getRedis();
    if (redis) {
      await redis.setUserSession(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role,
        loginTime: new Date().toISOString()
      });
    }

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
], async (req: Request, res: Response, next: NextFunction) => {
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

    // Generate JWT token (persistent session - 30 days)
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as jwt.Secret,
      ({ expiresIn: '30d' as StringValue } as SignOptions) // 30 days persistent session
    );

    // Store session in Redis (skip if Redis not available)
    const redis = getRedis();
    if (redis) {
      await redis.setUserSession(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role,
        loginTime: new Date().toISOString()
      });
    }

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

// Logout user (comprehensive session cleanup)
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw createError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const redis = getRedis();

    // Remove session from Redis (skip if Redis not available)
    if (redis) {
      await redis.deleteUserSession(decoded.userId);
    }

    // Log the logout event
    logger.info(`User logged out: ${decoded.userId}`);

    res.json({
      status: 'success',
      message: 'Logout successful - session cleared',
      data: {
        loggedOutAt: new Date().toISOString(),
        sessionCleared: true
      }
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
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

    // Generate new token (persistent session - 30 days)
    const signOptions: SignOptions = { expiresIn: '30d' as StringValue };
    const newToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as jwt.Secret,
      signOptions
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
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
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
