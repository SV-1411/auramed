#!/bin/bash

# AuraMed Backup Script
# Automated backup for database and application data

set -e

# Configuration
BACKUP_DIR="/backups/auramed"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database configuration
DB_NAME="auramed_prod"
DB_USER=${DB_USER:-"auramed"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

# Create backup directory
mkdir -p $BACKUP_DIR

echo "🔄 Starting AuraMed backup process..."

# Database backup
echo "📊 Backing up PostgreSQL database..."
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    --no-password --verbose --clean --no-owner --no-privileges \
    | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Redis backup
echo "💾 Backing up Redis data..."
redis-cli --rdb "$BACKUP_DIR/redis_backup_$DATE.rdb"

# Application files backup (if needed)
echo "📁 Backing up application files..."
tar -czf "$BACKUP_DIR/app_files_$DATE.tar.gz" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.git' \
    /app

# Upload to cloud storage (configure as needed)
# aws s3 cp "$BACKUP_DIR/" s3://your-backup-bucket/auramed/ --recursive

# Cleanup old backups
echo "🧹 Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup completed successfully!"
echo "📍 Backup location: $BACKUP_DIR"
ls -la $BACKUP_DIR/*$DATE*
