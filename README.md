# AuraMed - AI-First Healthcare Platform

## Overview
AuraMed is an AI-first healthcare platform with three autonomous AI agents that manage patient interactions, doctor workflows, and administrative operations.

## AI Agents
- **Patient AI Agent** - Symptom triage, appointment booking, payments, reminders
- **Doctor AI Agent** - Consultation summaries, prescriptions, performance tracking
- **Admin AI Agent** - Credential verification, fraud detection, compliance monitoring

## Key Features
- AI symptom checker with risk scoring (low/medium/high/critical)
- Emergency video consultations with automatic doctor routing
- Multilingual support with real-time translation
- Family profile management
- Integrated payments with deferred options
- Predictive health insights
- 24/7 AI health chat support

## Tech Stack
- **Backend**: Node.js/Express + TypeScript, PostgreSQL, Redis
- **AI/ML**: Python FastAPI, OpenAI/Claude APIs, LangChain
- **Frontend**: React/Next.js, React Native
- **Video**: Twilio for consultations
- **Payments**: Stripe/Razorpay integration
- **Translation**: Google Translate API

## Performance Requirements
- AI response time: < 2 seconds
- Appointment booking: < 3 seconds
- Uptime: 99.9%
- Scalability: 1M+ users

## Getting Started
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run development server
npm run dev
```

## Project Structure
```
auramed/
├── backend/           # Node.js API server
├── ai-service/        # Python ML/AI microservice
├── frontend/          # React web dashboard
├── mobile/            # React Native app
├── shared/            # Shared types and utilities
└── docs/              # Documentation
```
