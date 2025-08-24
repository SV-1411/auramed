# AuraMed Platform Setup Instructions

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ with pip
- **Docker Desktop** (recommended) or PostgreSQL + Redis locally
- **Git** for version control

## Quick Start (Docker - Recommended)

### 1. Environment Setup
```bash
# Clone and navigate to project
cd d:/auramed/CascadeProjects/windsurf-project

# Copy environment file
copy .env.example .env
```

### 2. Configure Environment Variables
Edit `.env` file with your API keys:

```env
# Required for basic functionality
DATABASE_URL=postgresql://auramed_user:auramed_password@postgres:5432/auramed
REDIS_URL=redis://redis:6379
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001
AI_SERVICE_URL=http://ai-service:8001

# Optional (for full features)
STRIPE_SECRET_KEY=your_stripe_secret_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 3. Start All Services
```bash
# Build and start all containers
docker compose up -d --build

# Check if all services are running
docker compose ps
```

### 4. Database Setup
```bash
# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Optional: Seed database with sample data
docker compose exec backend npx prisma db seed
```

### 5. Verify Setup
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000/api/health
- **AI Service**: http://localhost:8001/docs
- **Database**: PostgreSQL on localhost:5432
- **Redis**: Redis on localhost:6379

---

## Local Development Setup (Alternative)

### 1. Install Dependencies
```bash
# Clean install all workspaces
Remove-Item -Force package-lock.json
Remove-Item -Recurse -Force node_modules
npm cache clean --force
npm install --workspaces
```

### 2. Start Database Services Only
```bash
# Start only PostgreSQL and Redis
docker compose up -d postgres redis
```

### 3. Environment Configuration
```bash
# Copy environment file
copy .env.example backend/.env
```

Update `backend/.env`:
```env
DATABASE_URL=postgresql://auramed_user:auramed_password@localhost:5432/auramed
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
AI_SERVICE_URL=http://localhost:8001
```

### 4. Database Setup
```bash
# Generate Prisma client
npx prisma generate --schema backend/schema.prisma

# Run migrations
npx prisma migrate dev --schema backend/schema.prisma
```

### 5. Python AI Service Setup
```bash
# Navigate to AI service
cd ai-service

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start AI service
python -m uvicorn main:app --reload --port 8001
```

### 6. Start Development Servers
```bash
# From project root - starts all services in dev mode
npm run dev
```

This runs:
- Backend on port 3000
- Frontend on port 3000 (with proxy)
- AI service on port 8001

---

## API Keys & External Services

### Required APIs
1. **OpenAI API Key**
   - Go to https://platform.openai.com/api-keys
   - Create new secret key
   - Add to `.env` as `OPENAI_API_KEY`

### Optional APIs (for full features)
1. **Stripe** (Payments)
   - Dashboard: https://dashboard.stripe.com/apikeys
   - Get publishable and secret keys

2. **Twilio** (Video calls)
   - Console: https://console.twilio.com/
   - Get Account SID, Auth Token, API Key/Secret

3. **Google Translate** (Multi-language)
   - Cloud Console: https://console.cloud.google.com/
   - Enable Translate API, create credentials

---

## Troubleshooting

### Common Issues

**1. Import Errors in Backend**
```bash
# Regenerate Prisma client
npx prisma generate --schema backend/schema.prisma
```

**2. Port Already in Use**
```bash
# Kill processes on ports
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**3. Docker Issues**
```bash
# Reset Docker containers
docker compose down -v
docker compose up -d --build
```

**4. Database Connection Issues**
```bash
# Check if PostgreSQL is running
docker compose logs postgres

# Reset database
docker compose down -v
docker compose up -d postgres
docker compose exec backend npx prisma migrate deploy
```

**5. Node Modules Issues**
```bash
# Clean reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm cache clean --force
npm install --workspaces
```

### Service Health Checks
- Backend: `curl http://localhost:3000/api/health`
- AI Service: `curl http://localhost:8001/health`
- Database: `docker compose exec postgres pg_isready`
- Redis: `docker compose exec redis redis-cli ping`

---

## Development Workflow

### Making Changes
1. **Backend changes**: Auto-reload with nodemon
2. **Frontend changes**: Auto-reload with React dev server
3. **AI service changes**: Auto-reload with uvicorn --reload
4. **Database schema changes**: Run `npx prisma migrate dev`

### Testing
```bash
# Run backend tests
npm run backend:test

# Run frontend tests
npm run frontend:test
```

### Building for Production
```bash
# Build all services
npm run build

# Or build individually
npm run backend:build
npm run frontend:build
```

---

## Architecture Overview

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + Prisma
- **AI Service**: Python + FastAPI + OpenAI
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Authentication**: JWT tokens
- **Real-time**: WebSockets (Socket.io)

## Key Features
- 🤖 Three AI Agents (Patient, Doctor, Admin)
- 💬 Real-time chat interface
- 🏥 Appointment scheduling
- 📋 Medical records management
- 💳 Payment processing
- 🔒 HIPAA/GDPR compliance monitoring
- 🌐 Multi-language support
- 📱 Responsive design

---

## Support

If you encounter issues:
1. Check the logs: `docker compose logs [service-name]`
2. Verify environment variables in `.env`
3. Ensure all required API keys are configured
4. Check that all ports (3000, 3001, 5432, 6379, 8001) are available

For development questions, refer to:
- Backend API docs: http://localhost:3000/api-docs (if Swagger enabled)
- AI Service docs: http://localhost:8001/docs
- Database schema: `backend/schema.prisma`
