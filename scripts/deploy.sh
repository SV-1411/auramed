#!/bin/bash

# AuraMed Deployment Script
# This script handles the deployment of the AuraMed platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

echo -e "${GREEN}🚀 Starting AuraMed deployment for $ENVIRONMENT environment${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Please update .env file with your configuration before continuing.${NC}"
    read -p "Press enter to continue after updating .env file..."
fi

# Build and start services
echo -e "${GREEN}🔨 Building and starting services...${NC}"
docker-compose -f $COMPOSE_FILE down --remove-orphans
docker-compose -f $COMPOSE_FILE build --no-cache
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Run database migrations
echo -e "${GREEN}🗄️  Running database migrations...${NC}"
docker-compose -f $COMPOSE_FILE exec backend npx prisma migrate deploy

# Seed database if in development
if [ "$ENVIRONMENT" = "development" ]; then
    echo -e "${GREEN}🌱 Seeding database with sample data...${NC}"
    docker-compose -f $COMPOSE_FILE exec backend npm run seed
fi

# Health checks
echo -e "${GREEN}🏥 Performing health checks...${NC}"

# Check backend health
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Check AI service health
if curl -f http://localhost:8001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ AI Service is healthy${NC}"
else
    echo -e "${RED}❌ AI Service health check failed${NC}"
fi

# Check frontend (only in production with nginx)
if [ "$ENVIRONMENT" = "production" ]; then
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
    else
        echo -e "${RED}❌ Frontend health check failed${NC}"
    fi
fi

# Display service URLs
echo -e "${GREEN}🌐 Service URLs:${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "Frontend: ${GREEN}http://localhost${NC}"
    echo -e "Backend API: ${GREEN}http://localhost/api${NC}"
else
    echo -e "Frontend: ${GREEN}http://localhost:5173${NC}"
    echo -e "Backend API: ${GREEN}http://localhost:3000/api${NC}"
fi
echo -e "AI Service: ${GREEN}http://localhost:8001${NC}"
echo -e "Database: ${GREEN}localhost:5432${NC}"
echo -e "Redis: ${GREEN}localhost:6379${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "Monitoring: ${GREEN}http://localhost:9090${NC}"
fi

echo -e "${GREEN}🎉 AuraMed deployment completed successfully!${NC}"
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "1. Update your .env file with production API keys"
echo -e "2. Configure SSL certificates for HTTPS"
echo -e "3. Set up monitoring and alerting"
echo -e "4. Configure backup strategies"
echo -e "5. Review security settings"

# Show logs
echo -e "${GREEN}📊 Showing service logs (Ctrl+C to exit):${NC}"
docker-compose -f $COMPOSE_FILE logs -f
