"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const redis_1 = require("./config/redis");
const database_1 = require("./config/database");
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const patient_1 = __importDefault(require("./routes/patient"));
const doctor_1 = __importDefault(require("./routes/doctor"));
const admin_1 = __importDefault(require("./routes/admin"));
const appointment_1 = __importDefault(require("./routes/appointment"));
const payment_1 = __importDefault(require("./routes/payment"));
const aiAgent_1 = __importDefault(require("./routes/aiAgent"));
const video_1 = __importDefault(require("./routes/video"));
const family_1 = __importDefault(require("./routes/family"));
const health_insights_1 = __importDefault(require("./routes/health-insights"));
const translation_1 = __importDefault(require("./routes/translation"));
// AI Agents
const PatientAIAgent_1 = require("./agents/PatientAIAgent");
const DoctorAIAgent_1 = require("./agents/DoctorAIAgent");
const AdminAIAgent_1 = require("./agents/AdminAIAgent");
const AgentOrchestrator_1 = require("./agents/AgentOrchestrator");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3001",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP, please try again later.'
});
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
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
app.use('/api/auth', auth_1.default);
app.use('/api/patient', patient_1.default);
app.use('/api/doctor', doctor_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/appointments', appointment_1.default);
app.use('/api/payments', payment_1.default);
app.use('/api/ai-agents', aiAgent_1.default);
app.use('/api/video', video_1.default);
app.use('/api/family', family_1.default);
app.use('/api/health-insights', health_insights_1.default);
app.use('/api/translation', translation_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
// Initialize AI Agents
let agentOrchestrator;
async function initializeAIAgents() {
    try {
        const patientAgent = new PatientAIAgent_1.PatientAIAgent();
        const doctorAgent = new DoctorAIAgent_1.DoctorAIAgent();
        const adminAgent = new AdminAIAgent_1.AdminAIAgent();
        agentOrchestrator = new AgentOrchestrator_1.AgentOrchestrator(patientAgent, doctorAgent, adminAgent, io);
        await agentOrchestrator.initialize();
        logger_1.logger.info('AI Agents initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize AI Agents:', error);
    }
}
// Socket.IO for real-time communication
io.on('connection', (socket) => {
    logger_1.logger.info(`Client connected: ${socket.id}`);
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        logger_1.logger.info(`Client ${socket.id} joined room ${roomId}`);
    });
    socket.on('ai-message', async (data) => {
        if (agentOrchestrator) {
            await agentOrchestrator.handleMessage(socket, data);
        }
    });
    socket.on('disconnect', () => {
        logger_1.logger.info(`Client disconnected: ${socket.id}`);
    });
});
// Start server
async function startServer() {
    try {
        // Initialize database
        await (0, database_1.initializeDatabase)();
        logger_1.logger.info('Database connected successfully');
        // Initialize Redis
        await (0, redis_1.connectRedis)();
        logger_1.logger.info('Redis connected successfully');
        // Initialize AI Agents
        await initializeAIAgents();
        server.listen(PORT, () => {
            logger_1.logger.info(`AuraMed Backend Server running on port ${PORT}`);
            logger_1.logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger_1.logger.info('Process terminated');
    });
});
startServer();
//# sourceMappingURL=index.js.map