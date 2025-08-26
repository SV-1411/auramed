"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
// Register new user
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('phone').isMobilePhone('any'),
    (0, express_validator_1.body)('password').isLength({ min: 8 }),
    (0, express_validator_1.body)('role').isIn(['PATIENT', 'DOCTOR', 'ADMIN']),
    (0, express_validator_1.body)('firstName').notEmpty().trim(),
    (0, express_validator_1.body)('lastName').notEmpty().trim()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, phone, password, role, firstName, lastName, ...profileData } = req.body;
        const db = (0, database_1.getDatabase)();
        // Check if user already exists
        const existingUser = await db.user.findFirst({
            where: {
                OR: [{ email }, { phone }]
            }
        });
        if (existingUser) {
            throw (0, errorHandler_1.createError)('User already exists with this email or phone', 409);
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
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
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        // Store session in Redis
        const redis = (0, redis_1.getRedis)();
        await redis.setUserSession(user.id, {
            userId: user.id,
            email: user.email,
            role: user.role,
            loginTime: new Date().toISOString()
        });
        logger_1.logger.info(`User registered: ${user.email} (${user.role})`);
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
    }
    catch (error) {
        next(error);
    }
});
// Login user
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password } = req.body;
        const db = (0, database_1.getDatabase)();
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
            throw (0, errorHandler_1.createError)('Invalid credentials', 401);
        }
        // Check password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw (0, errorHandler_1.createError)('Invalid credentials', 401);
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        // Store session in Redis
        const redis = (0, redis_1.getRedis)();
        await redis.setUserSession(user.id, {
            userId: user.id,
            email: user.email,
            role: user.role,
            loginTime: new Date().toISOString()
        });
        logger_1.logger.info(`User logged in: ${user.email} (${user.role})`);
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
    }
    catch (error) {
        next(error);
    }
});
// Logout user
router.post('/logout', async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            throw (0, errorHandler_1.createError)('No token provided', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const redis = (0, redis_1.getRedis)();
        // Remove session from Redis
        await redis.deleteUserSession(decoded.userId);
        logger_1.logger.info(`User logged out: ${decoded.userId}`);
        res.json({
            status: 'success',
            message: 'Logout successful'
        });
    }
    catch (error) {
        next(error);
    }
});
// Refresh token
router.post('/refresh', async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            throw (0, errorHandler_1.createError)('No token provided', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const db = (0, database_1.getDatabase)();
        // Verify user still exists and is active
        const user = await db.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user || !user.isActive) {
            throw (0, errorHandler_1.createError)('User not found or inactive', 401);
        }
        // Generate new token
        const newToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({
            status: 'success',
            data: { token: newToken }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get current user profile
router.get('/me', async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            throw (0, errorHandler_1.createError)('No token provided', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const db = (0, database_1.getDatabase)();
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
            throw (0, errorHandler_1.createError)('User not found', 404);
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map