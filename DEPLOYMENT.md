# AuraMed Deployment Guide

## Overview

AuraMed is an AI-first healthcare platform with autonomous AI agents for patients, doctors, and administrators. This guide covers deployment, configuration, and maintenance.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   AI Service    │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Python)      │
│   Port: 80/5173 │    │   Port: 3000    │    │   Port: 8001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐    ┌─────────────────┐
                    │   PostgreSQL    │    │     Redis       │
                    │   Port: 5432    │    │   Port: 6379    │
                    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for AI service development)
- PostgreSQL 15+ (if running locally)
- Redis 7+ (if running locally)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd windsurf-project
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your configuration:

```bash
# Database
DATABASE_URL=postgresql://auramed:password@localhost:5432/auramed
DB_USER=auramed
DB_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your_openai_api_key
CLAUDE_API_KEY=your_claude_api_key

# Payment Gateways
STRIPE_SECRET_KEY=your_stripe_secret_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Communication
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
WHATSAPP_BUSINESS_API_KEY=your_whatsapp_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Translation
GOOGLE_TRANSLATE_API_KEY=your_translate_key
```

### 3. Development Deployment

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy for development
./scripts/deploy.sh development
```

### 4. Production Deployment

```bash
# Deploy for production
./scripts/deploy.sh production
```

## Manual Deployment Steps

### Backend Setup

```bash
# Install dependencies
cd backend
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Start server
npm start
```

### Frontend Setup

```bash
# Install dependencies
cd frontend
npm install

# Build for production
npm run build

# Serve with nginx or static server
```

### AI Service Setup

```bash
# Install Python dependencies
cd ai-service
pip install -r requirements.txt

# Start service
uvicorn main:app --host 0.0.0.0 --port 8001
```

## Docker Deployment

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Database Management

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Deploy migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Seeding

```bash
# Seed database with sample data
npm run seed
```

### Backup

```bash
# Run backup script
chmod +x scripts/backup.sh
./scripts/backup.sh
```

## Monitoring & Health Checks

### Health Endpoints

- Backend: `GET /api/health`
- AI Service: `GET /health`
- Frontend: `GET /health` (nginx)

### Monitoring Stack

- Prometheus: `http://localhost:9090`
- Grafana: Configure dashboards for metrics
- Application logs: `docker-compose logs -f`

### Log Management

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f ai-service
docker-compose logs -f frontend
```

## Security Configuration

### SSL/TLS Setup

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Configure nginx-proxy with certificates
3. Update environment variables for HTTPS

### API Security

- JWT tokens with secure secrets
- Rate limiting configured
- CORS properly set up
- Input validation on all endpoints

### Database Security

- Strong passwords
- Connection encryption
- Regular security updates
- Backup encryption

## Performance Optimization

### Database

- Connection pooling configured
- Indexes on frequently queried fields
- Query optimization
- Regular VACUUM and ANALYZE

### Caching

- Redis for session management
- API response caching
- Static asset caching with nginx

### Scaling

- Horizontal scaling with Docker Swarm/Kubernetes
- Load balancing with nginx
- Database read replicas
- CDN for static assets

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database status
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   
   # Restart database
   docker-compose restart postgres
   ```

2. **AI Service Not Responding**
   ```bash
   # Check AI service logs
   docker-compose logs ai-service
   
   # Restart AI service
   docker-compose restart ai-service
   ```

3. **Frontend Build Errors**
   ```bash
   # Clear node_modules and reinstall
   rm -rf frontend/node_modules
   cd frontend && npm install
   
   # Rebuild
   npm run build
   ```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=auramed:*

# Run with verbose logging
docker-compose up --verbose
```

## Maintenance

### Regular Tasks

1. **Daily**
   - Monitor system health
   - Check error logs
   - Verify backup completion

2. **Weekly**
   - Update dependencies
   - Review performance metrics
   - Clean up old logs

3. **Monthly**
   - Security updates
   - Database maintenance
   - Capacity planning review

### Updates

```bash
# Update application
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Update dependencies
npm update
pip install -r requirements.txt --upgrade
```

## API Documentation

### Authentication

```bash
# Register user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password",
  "firstName": "John",
  "lastName": "Doe",
  "role": "patient"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

### AI Agent Interaction

```bash
# Send message to AI agent
POST /api/ai-agent/chat
{
  "message": "I have a headache and fever",
  "agentType": "patient"
}

# Get symptom analysis
POST /api/ai-agent/analyze-symptoms
{
  "symptoms": ["headache", "fever"],
  "duration": "2 days"
}
```

## Support

### Documentation
- API Documentation: `/api/docs`
- Frontend Components: Storybook (if configured)
- Database Schema: Prisma Studio

### Logs Location
- Application: `./logs/`
- Docker: `docker-compose logs`
- System: `/var/log/`

### Contact
- Technical Issues: Create GitHub issue
- Security Issues: security@auramed.com
- General Support: support@auramed.com

## License

This project is licensed under the MIT License. See LICENSE file for details.
