import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the repository root .env
// Works from both ts-node (src) and compiled (dist) by resolving relative to current dir
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { connectRedis } from './config/redis';
import { getDatabase, initializeDatabase } from './config/database';

// Routes
import authRoutes from './routes/auth';
import patientRoutes from './routes/patient';
import doctorRoutes from './routes/doctor';
import adminRoutes from './routes/admin';
import appointmentRoutes from './routes/appointment';
import paymentRoutes from './routes/payment';
import aiAgentRoutes from './routes/aiAgent';
import videoRoutes from './routes/video';
import familyRoutes from './routes/family';
import healthInsightsRoutes from './routes/health-insights';
import translationRoutes from './routes/translation';
import { router as predictiveInsightsRoutes } from './routes/predictive-insights';
import predictiveMetricsRoutes from './routes/predictive-metrics';
import aiAppointmentRoutes from './routes/ai-appointment';
import consultationRoutes from './routes/consultation';
import sosRoutes from './routes/sos';
import medicineRoutes from './routes/medicine';
import prescriptionRoutes from './routes/prescriptions';
import freelanceRoutes from './routes/freelance';

// AI Agents
import { PatientAIAgent } from './agents/PatientAIAgent';
import { DoctorAIAgent } from './agents/DoctorAIAgent';
import { AdminAIAgent } from './agents/AdminAIAgent';
import { AgentOrchestrator } from './agents/AgentOrchestrator';

// dotenv already configured above

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai-agents', aiAgentRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/family-members', familyRoutes); // Fix: Change to match frontend expectations
app.use('/api/health-insights', healthInsightsRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/predictive-insights', predictiveInsightsRoutes);
app.use('/api/predictive-metrics', predictiveMetricsRoutes);
app.use('/api/ai-appointments', aiAppointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/medicine', medicineRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/freelance', freelanceRoutes);

// Error handling
app.use(errorHandler);

// Initialize AI Agents
let agentOrchestrator: AgentOrchestrator;

async function initializeAIAgents() {
  try {
    logger.info('Creating AI agent instances...');
    const patientAgent = new PatientAIAgent();
    const doctorAgent = new DoctorAIAgent();
    const adminAgent = new AdminAIAgent();

    logger.info('Creating agent orchestrator...');
    agentOrchestrator = new AgentOrchestrator(patientAgent, doctorAgent, adminAgent, io);

    logger.info('Initializing agent orchestrator...');
    await agentOrchestrator.initialize();

    logger.info('AI Agents initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AI Agents:', error);
    logger.error('AI Agent error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    // Don't let AI agent failures crash the server - continue without AI agents
  }
}

// Socket.IO for real-time communication
io.use((socket, next) => {
  try {
    const token = (socket.handshake as any)?.auth?.token || (socket.handshake.headers.authorization || '').replace('Bearer ', '');
    if (!token) {
      return next(new Error('Unauthorized'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (socket.data as any).user = { userId: decoded.userId, role: decoded.role };
    return next();
  } catch (e) {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  const authedUser = (socket.data as any).user as { userId: string; role: string } | undefined;
  if (authedUser?.userId) {
    socket.join(`user-${authedUser.userId}`);
  }

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    logger.info(`Client ${socket.id} joined room ${roomId}`);
  });

  socket.on('ai-message', async (data) => {
    if (agentOrchestrator) {
      await agentOrchestrator.handleMessage(socket, data);
    }
  });

  socket.on('sos:create', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'PATIENT') {
        throw new Error('Forbidden');
      }
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;
      const location = payload?.location;
      if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new Error('Invalid location');
      }

      const existing = await sosDelegate.findFirst({
        where: { patientId: authedUser.userId, status: { in: ['OPEN', 'ASSIGNED'] } }
      });
      const sos = existing
        ? existing
        : await sosDelegate.create({
            data: {
              patientId: authedUser.userId,
              status: 'OPEN',
              lastLocation: {
                latitude: location.latitude,
                longitude: location.longitude,
                address: location.address,
                timestamp: new Date().toISOString()
              },
              notes: payload?.notes
            }
          });

      socket.join(`sos-${(sos as any).id}`);
      io.to('ambulance-room').emit('sos:new', sos);
      cb?.({ ok: true, sos });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('sos:update-location', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'PATIENT') {
        throw new Error('Forbidden');
      }
      const sosId = payload?.sosId;
      const location = payload?.location;
      if (!sosId || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new Error('Invalid payload');
      }

      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;
      const sos = await sosDelegate.findFirst({
        where: { id: sosId, patientId: authedUser.userId, status: { in: ['OPEN', 'ASSIGNED'] } }
      });
      if (!sos) throw new Error('SOS not found');

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: {
          lastLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
            timestamp: new Date().toISOString()
          }
        }
      });

      io.to(`sos-${sosId}`).emit('sos:updated', updated);
      cb?.({ ok: true, sos: updated });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('ambulance:accept', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'AMBULANCE') {
        throw new Error('Forbidden');
      }
      const sosId = payload?.sosId;
      if (!sosId) throw new Error('Invalid payload');
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;
      const sos = await sosDelegate.findFirst({ where: { id: sosId, status: 'OPEN' } });
      if (!sos) throw new Error('SOS not found');

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: { status: 'ASSIGNED', assignedAmbulanceId: authedUser.userId }
      });

      socket.join(`sos-${sosId}`);
      io.to(`sos-${sosId}`).emit('sos:assigned', updated);
      io.to(`user-${(updated as any).patientId}`).emit('sos:assigned', updated);
      cb?.({ ok: true, sos: updated });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('ambulance:resolve', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'AMBULANCE') {
        throw new Error('Forbidden');
      }
      const sosId = payload?.sosId;
      if (!sosId) throw new Error('Invalid payload');
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;
      const sos = await sosDelegate.findFirst({
        where: { id: sosId, assignedAmbulanceId: authedUser.userId, status: 'ASSIGNED' }
      });
      if (!sos) throw new Error('SOS not found');

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: { status: 'RESOLVED' }
      });
      io.to(`sos-${sosId}`).emit('sos:resolved', updated);
      io.to(`user-${(updated as any).patientId}`).emit('sos:resolved', updated);
      cb?.({ ok: true, sos: updated });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  const haversineKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.sqrt(aa));
  };

  const asLoc = (loc: any): { latitude: number; longitude: number } | null => {
    if (!loc || typeof loc !== 'object') return null;
    if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
    return { latitude: loc.latitude, longitude: loc.longitude };
  };

  socket.on('freelance:doctor:go-online', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'DOCTOR') throw new Error('Forbidden');
      const loc = asLoc(payload?.location);
      if (!loc) throw new Error('Invalid location');

      const db = getDatabase();
      const sessionDelegate = (db as any).freelanceDoctorSession;

      const session = await sessionDelegate.upsert({
        where: { doctorId: authedUser.userId },
        update: { isOnline: true, lastLocation: { ...loc, timestamp: new Date().toISOString() } },
        create: { doctorId: authedUser.userId, isOnline: true, lastLocation: { ...loc, timestamp: new Date().toISOString() } }
      });

      cb?.({ ok: true, session });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('freelance:doctor:go-offline', async (_payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'DOCTOR') throw new Error('Forbidden');
      const db = getDatabase();
      const sessionDelegate = (db as any).freelanceDoctorSession;
      const session = await sessionDelegate.upsert({
        where: { doctorId: authedUser.userId },
        update: { isOnline: false },
        create: { doctorId: authedUser.userId, isOnline: false }
      });
      cb?.({ ok: true, session });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('freelance:doctor:location', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'DOCTOR') throw new Error('Forbidden');
      const loc = asLoc(payload?.location);
      if (!loc) throw new Error('Invalid location');
      const db = getDatabase();
      const sessionDelegate = (db as any).freelanceDoctorSession;
      const session = await sessionDelegate.upsert({
        where: { doctorId: authedUser.userId },
        update: { lastLocation: { ...loc, timestamp: new Date().toISOString() }, isOnline: true },
        create: { doctorId: authedUser.userId, isOnline: true, lastLocation: { ...loc, timestamp: new Date().toISOString() } }
      });
      cb?.({ ok: true, session });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('freelance:request:create', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'PATIENT') throw new Error('Forbidden');
      const pickup = asLoc(payload?.location);
      if (!pickup) throw new Error('Invalid location');
      const symptoms = Array.isArray(payload?.symptoms) ? payload.symptoms.map((s: any) => String(s)) : [];

      const db = getDatabase();
      const requestDelegate = (db as any).freelanceRequest;
      const sessionDelegate = (db as any).freelanceDoctorSession;

      const existing = await requestDelegate.findFirst({
        where: { patientId: authedUser.userId, status: { in: ['REQUESTED', 'OFFERED', 'ACCEPTED'] } },
        orderBy: { createdAt: 'desc' }
      });
      if (existing) {
        cb?.({ ok: true, request: existing });
        return;
      }

      const request = await requestDelegate.create({
        data: {
          patientId: authedUser.userId,
          status: 'REQUESTED',
          symptoms,
          pickupLocation: { ...pickup, timestamp: new Date().toISOString() }
        }
      });

      const sessions = await sessionDelegate.findMany({ where: { isOnline: true } });
      const nearby = sessions
        .map((s: any) => {
          const dLoc = asLoc(s.lastLocation);
          if (!dLoc) return null;
          const distanceKm = haversineKm(pickup, dLoc);
          return { ...s, distanceKm };
        })
        .filter((x: any) => x && x.distanceKm <= 10)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        .slice(0, 10);

      const effectiveStatus = nearby.length ? 'OFFERED' : 'REQUESTED';
      if (nearby.length) {
        await requestDelegate.update({ where: { id: request.id }, data: { status: 'OFFERED' } });
      }

      for (const s of nearby) {
        io.to(`user-${s.doctorId}`).emit('freelance:request:offer', {
          requestId: request.id,
          patientId: request.patientId,
          pickupLocation: request.pickupLocation,
          symptoms: request.symptoms,
          distanceKm: s.distanceKm
        });
      }

      io.to(`user-${authedUser.userId}`).emit('freelance:request:updated', { requestId: request.id, status: effectiveStatus });

      cb?.({ ok: true, request: { ...request, status: effectiveStatus } });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('freelance:request:accept', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'DOCTOR') throw new Error('Forbidden');
      const requestId = payload?.requestId;
      if (!requestId) throw new Error('Invalid requestId');
      const db = getDatabase();
      const requestDelegate = (db as any).freelanceRequest;

      const reqRow = await requestDelegate.findFirst({ where: { id: requestId, status: { in: ['REQUESTED', 'OFFERED'] } } });
      if (!reqRow) throw new Error('Request not found');

      const updated = await requestDelegate.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED', assignedDoctorId: authedUser.userId }
      });

      io.to(`user-${updated.patientId}`).emit('freelance:request:assigned', updated);
      io.to(`user-${authedUser.userId}`).emit('freelance:request:assigned', updated);
      cb?.({ ok: true, request: updated });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('freelance:request:complete', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'DOCTOR') throw new Error('Forbidden');
      const requestId = payload?.requestId;
      if (!requestId) throw new Error('Invalid requestId');
      const db = getDatabase();
      const requestDelegate = (db as any).freelanceRequest;

      const reqRow = await requestDelegate.findFirst({
        where: { id: requestId, assignedDoctorId: authedUser.userId, status: { in: ['ACCEPTED'] } }
      });
      if (!reqRow) throw new Error('Request not found');

      const updated = await requestDelegate.update({ where: { id: requestId }, data: { status: 'COMPLETED' } });
      io.to(`user-${updated.patientId}`).emit('freelance:request:updated', { requestId: updated.id, status: updated.status });
      io.to(`user-${authedUser.userId}`).emit('freelance:request:updated', { requestId: updated.id, status: updated.status });
      cb?.({ ok: true, request: updated });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('freelance:request:cancel', async (payload, cb) => {
    try {
      if (!authedUser || authedUser.role !== 'PATIENT') throw new Error('Forbidden');
      const requestId = payload?.requestId;
      if (!requestId) throw new Error('Invalid requestId');
      const db = getDatabase();
      const requestDelegate = (db as any).freelanceRequest;

      const reqRow = await requestDelegate.findFirst({
        where: { id: requestId, patientId: authedUser.userId, status: { in: ['REQUESTED', 'OFFERED', 'ACCEPTED'] } }
      });
      if (!reqRow) throw new Error('Request not found');

      const updated = await requestDelegate.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
      io.to(`user-${updated.patientId}`).emit('freelance:request:updated', { requestId: updated.id, status: updated.status });
      if (updated.assignedDoctorId) {
        io.to(`user-${updated.assignedDoctorId}`).emit('freelance:request:updated', { requestId: updated.id, status: updated.status });
      }
      cb?.({ ok: true, request: updated });
    } catch (e: any) {
      cb?.({ ok: false, error: e.message || 'Failed' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// WebSocket endpoint for frontend compatibility
app.get('/ws', (req, res) => {
  res.status(200).json({ message: 'WebSocket endpoint available', status: 'connected' });
});

// Start server
async function startServer() {
  try {
    logger.info('Starting AuraMed Backend Server...');

    // Initialize database
    logger.info('Initializing database...');
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    logger.info('Initializing Redis...');
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize AI Agents
    logger.info('Initializing AI Agents...');
    await initializeAIAgents();

    logger.info('Starting server on port ' + PORT);
    server.listen(PORT, () => {
      logger.info(`AuraMed Backend Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info('Server started successfully - listening for connections...');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    logger.error('Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

startServer();
