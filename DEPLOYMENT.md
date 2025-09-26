# GoodHost Deployment Guide

This guide covers deploying GoodHost in production environments.

## 🏗️ Production Architecture

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │    (Nginx)      │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │   GoodHost API  │
                    │   (NestJS App)  │
                    └─────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────────────┐ ┌──────────────┐ ┌────────────────┐
    │  PostgreSQL   │ │    Redis     │ │  Docker Host   │
    │  (Database)   │ │ (Job Queue)  │ │ (Game Servers) │
    └───────────────┘ └──────────────┘ └────────────────┘
```

## 🐳 Docker Deployment (Recommended)

### 1. Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Clone and Configure

```bash
# Clone repository
git clone <your-repo-url>
cd goodhost-server-management

# Create production environment file
cp .env.example .env
```

### 3. Production Environment Configuration

Edit `.env` file:

```env
# Production Database
DATABASE_URL="postgresql://goodhost:STRONG_PASSWORD@postgres:5432/goodhost_production"

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
ENCRYPTION_KEY=your_32_character_encryption_key

# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com

# Docker Configuration
DOCKER_SOCKET_PATH=/var/run/docker.sock

# File Storage (use absolute paths)
GAME_SERVERS_PATH=/opt/goodhost/game_servers
BACKUP_PATH=/opt/goodhost/backups

# Resource Limits
MAX_SERVERS_PER_USER=10
MAX_BACKUP_SIZE_GB=50
MAX_FILE_SIZE_MB=100

# Email Configuration (for notifications)
RESEND_API_KEY=your_resend_api_key
```

### 4. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: goodhost_postgres_prod
    environment:
      POSTGRES_USER: goodhost
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: goodhost_production
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups/db:/backups
    networks:
      - goodhost_network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: goodhost_redis_prod
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - goodhost_network
    restart: unless-stopped

  goodhost_app:
    build: .
    container_name: goodhost_app_prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /opt/goodhost/game_servers:/app/game_servers
      - /opt/goodhost/backups:/app/backups
      - /opt/goodhost/logs:/app/logs
    networks:
      - goodhost_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: goodhost_nginx_prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - goodhost_app
    networks:
      - goodhost_network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  goodhost_network:
    driver: bridge
```

### 5. Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream goodhost_backend {
        server goodhost_app_prod:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    server {
        listen 80;
        server_name your-domain.com;
        
        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://goodhost_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Authentication endpoints (stricter rate limiting)
        location /api/auth/ {
            limit_req zone=auth burst=10 nodelay;
            proxy_pass http://goodhost_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://goodhost_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location / {
            proxy_pass http://goodhost_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://goodhost_backend;
            access_log off;
        }
    }
}
```

### 6. Deploy

```bash
# Create required directories
sudo mkdir -p /opt/goodhost/{game_servers,backups,logs}
sudo chown -R $USER:$USER /opt/goodhost

# Generate SSL certificates (using Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to nginx directory
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec goodhost_app npx prisma migrate deploy

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🖥️ Manual Deployment

### 1. Server Setup

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server
```

### 2. Database Setup

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE goodhost_production;
CREATE USER goodhost WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE goodhost_production TO goodhost;
\q
```

### 3. Application Setup

```bash
# Clone and build
git clone <your-repo-url>
cd goodhost-server-management
npm install
npm run build

# Run migrations
npx prisma migrate deploy

# Create PM2 ecosystem file
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'goodhost-api',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/goodhost/logs/err.log',
    out_file: '/opt/goodhost/logs/out.log',
    log_file: '/opt/goodhost/logs/combined.log',
    time: true
  }]
}
```

### 4. Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# API health check
curl http://localhost:3000/health

# Database connection
docker-compose exec postgres pg_isready

# Redis connection
docker-compose exec redis redis-cli ping
```

### Log Management

```bash
# View application logs
docker-compose logs -f goodhost_app

# View specific service logs
docker-compose logs postgres
docker-compose logs redis

# Rotate logs (add to crontab)
0 0 * * * docker-compose exec goodhost_app logrotate /etc/logrotate.conf
```

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

# Database backup
docker-compose exec postgres pg_dump -U goodhost goodhost_production > backup_$(date +%Y%m%d).sql

# Game server files backup
tar -czf gameservers_backup_$(date +%Y%m%d).tar.gz /opt/goodhost/game_servers

# Upload to cloud storage (configure your preferred service)
# aws s3 cp backup_$(date +%Y%m%d).sql s3://your-backup-bucket/
```

### Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Update Node.js dependencies
npm audit fix
npm update
```

## 🔧 Performance Tuning

### Database Optimization

```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_game_server_user_id ON "game_server"(user_id);
CREATE INDEX CONCURRENTLY idx_game_server_status ON "game_server"(status);
CREATE INDEX CONCURRENTLY idx_server_metric_created_at ON "server_metric"(created_at);
```

### Redis Configuration

```redis
# /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Node.js Optimization

```javascript
// PM2 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'goodhost-api',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    env: {
      NODE_ENV: 'production',
      UV_THREADPOOL_SIZE: 128
    }
  }]
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Docker socket permission denied**
   ```bash
   sudo usermod -aG docker $USER
   # Logout and login again
   ```

2. **Database connection failed**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

3. **Redis connection failed**
   ```bash
   # Test Redis connection
   docker-compose exec redis redis-cli ping
   ```

4. **High memory usage**
   ```bash
   # Monitor container resources
   docker stats
   
   # Adjust memory limits in docker-compose.yml
   ```

### Performance Issues

- Monitor with `htop`, `iotop`, and `docker stats`
- Check database slow queries with `pg_stat_statements`
- Use Redis monitoring with `redis-cli --latency`
- Profile Node.js application with built-in profiler

## 📞 Support

- Create issues on GitHub for bugs
- Check logs first: `docker-compose logs -f`
- Monitor system resources during issues
- Provide configuration and error logs when reporting

---

For additional help, consult the main README.md or create an issue on GitHub.