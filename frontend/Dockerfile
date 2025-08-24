FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci

# Copy shared types and build
COPY shared/ ./shared/
RUN cd shared && npm run build

# Copy frontend source
COPY frontend/ ./frontend/

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
