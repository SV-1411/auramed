import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { connectRedis } from './config/redis';
import { initializeDatabase } from './config/database';

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

// AI Agents
import { PatientAIAgent } from './agents/PatientAIAgent';
import { DoctorAIAgent } from './agents/DoctorAIAgent';
import { AdminAIAgent } from './agents/AdminAIAgent';
import { AgentOrchestrator } from './agents/AgentOrchestrator';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

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
app.use('/api/family', familyRoutes);
app.use('/api/health-insights', healthInsightsRoutes);
app.use('/api/translation', translationRoutes);

// Error handling
app.use(errorHandler);

// Initialize AI Agents
let agentOrchestrator: AgentOrchestrator;

async function initializeAIAgents() {
  try {
    const patientAgent = new PatientAIAgent();
    const doctorAgent = new DoctorAIAgent();
    const adminAgent = new AdminAIAgent();
    
    agentOrchestrator = new AgentOrchestrator(patientAgent, doctorAgent, adminAgent, io);
    await agentOrchestrator.initialize();
    
    logger.info('AI Agents initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AI Agents:', error);
  }
}

// Socket.IO for real-time communication
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    logger.info(`Client ${socket.id} joined room ${roomId}`);
  });
  
  socket.on('ai-message', async (data) => {
    if (agentOrchestrator) {
      await agentOrchestrator.handleMessage(socket, data);
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');
    
    // Initialize Redis
    await connectRedis();
    logger.info('Redis connected successfully');
    
    // Initialize AI Agents
    await initializeAIAgents();
    
    server.listen(PORT, () => {
      logger.info(`AuraMed Backend Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
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
