# GoodHost - Advanced Game Server Management System

A comprehensive, enterprise-grade game server hosting and management platform built with TypeScript, NestJS, and Docker. Designed to replace Pterodactyl with modern architecture and advanced features.

## 🚀 Features

### Core Features
- **Multi-Game Support**: Minecraft (Java & Bedrock), Valheim, Terraria, CS:GO, Garry's Mod
- **Docker-Based**: Containerized game servers for isolation and scalability
- **Real-time Monitoring**: Live server metrics, resource usage, and player statistics
- **WebSocket Integration**: Real-time updates for server status and logs
- **Advanced File Manager**: Web-based file editing with syntax highlighting
- **Automated Backups**: Scheduled and manual backups with compression
- **Template System**: Pre-configured server templates for quick deployment
- **User Management**: Multi-user support with role-based access control

### Enterprise Features
- **Job Queue System**: Redis-based job processing for server operations
- **Resource Monitoring**: CPU, memory, disk, and network usage tracking
- **Auto-scaling**: Dynamic resource allocation based on demand
- **Health Checks**: Automated server health monitoring and recovery
- **Audit Logging**: Complete audit trail for all operations
- **API-First**: RESTful API with comprehensive endpoints

## 🏗️ Architecture

### Technology Stack
- **Backend**: NestJS, TypeScript, Prisma ORM
- **Database**: PostgreSQL with migrations
- **Queue**: Redis with Bull queues
- **Containerization**: Docker & Docker Compose
- **Real-time**: Socket.IO for WebSocket connections
- **Authentication**: JWT-based authentication system

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   NestJS API    │    │   Docker Host   │
│   (React/Vue)   │◄──►│   (Backend)     │◄──►│  Game Servers   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Database)    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │     Redis       │
                    │  (Job Queue)    │
                    └─────────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Quick Start

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd goodhost-server-management
```

2. **Install dependencies**
```bash
yarn install
```

3. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker Compose**
```bash
docker-compose up -d postgres redis
```

5. **Run database migrations**
```bash
npx prisma migrate dev
```

6. **Start the application**
```bash
yarn start:dev
```

The API will be available at `http://localhost:3000`

### Production Deployment

1. **Build the application**
```bash
yarn build
```

2. **Start with Docker Compose**
```bash
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_HOST` | Redis server hostname | localhost |
| `REDIS_PORT` | Redis server port | 6379 |
| `PORT` | API server port | 3000 |
| `DOCKER_SOCKET_PATH` | Docker socket path | /var/run/docker.sock |
| `GAME_SERVERS_PATH` | Game server files directory | /app/game_servers |
| `BACKUP_PATH` | Backup files directory | /app/backups |
| `MAX_SERVERS_PER_USER` | Maximum servers per user | 5 |

See `.env.example` for complete configuration options.

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Server Management
- `GET /api/servers` - List user's servers
- `POST /api/servers` - Create new server
- `GET /api/servers/:id` - Get server details
- `PUT /api/servers/:id` - Update server
- `DELETE /api/servers/:id` - Delete server
- `POST /api/servers/:id/start` - Start server
- `POST /api/servers/:id/stop` - Stop server
- `POST /api/servers/:id/restart` - Restart server

### File Management
- `GET /api/files/servers/:id` - List server files
- `GET /api/files/servers/:id/content` - Read file content
- `PUT /api/files/servers/:id/content` - Update file content
- `POST /api/files/servers/:id/directories` - Create directory
- `DELETE /api/files/servers/:id/items` - Delete file/directory

### Backup System
- `GET /api/backups` - List user's backups
- `POST /api/backups` - Create manual backup
- `POST /api/backups/:id/restore` - Restore backup
- `DELETE /api/backups/:id` - Delete backup

### Monitoring
- `GET /api/monitoring/overview` - System overview
- `GET /api/monitoring/servers/:id/metrics` - Server metrics
- `GET /api/monitoring/servers/:id/health` - Server health check

## 🎮 Supported Games

### Minecraft Java Edition
- Versions: 1.16.5 - 1.20.4
- Server Types: Vanilla, Paper, Forge, Fabric
- Plugins: Automatic plugin management
- Configurations: server.properties, bukkit.yml, spigot.yml

### Minecraft Bedrock Edition  
- Cross-platform compatibility
- Automatic world management
- Resource pack support

### Valheim
- Dedicated server support
- World management
- Password protection
- Public server listing

### Terraria
- Multi-world support
- Player management
- Mod support (tModLoader)

### Counter-Strike: Global Offensive
- Custom maps and configs
- Workshop integration
- Player statistics

## 🔄 Development

### Project Structure
```
src/
├── modules/
│   ├── auth/           # Authentication system
│   ├── game-server/    # Server management
│   ├── docker/         # Docker integration
│   ├── monitoring/     # System monitoring
│   ├── backup/         # Backup system
│   ├── file-manager/   # File management
│   ├── template/       # Server templates
│   ├── websocket/      # Real-time features
│   └── prisma/         # Database layer
├── utils/              # Utility functions
├── app.module.ts       # Main application module
└── main.ts            # Application entry point
```

### Development Commands
```bash
# Start development server
yarn start:dev

# Run tests
yarn test

# Run e2e tests
yarn test:e2e

# Build for production
yarn build

# Database operations
npx prisma migrate dev    # Run migrations
npx prisma generate      # Generate client
npx prisma studio       # Database GUI
```

### Adding New Game Support

1. Create server template in `template.service.ts`
2. Add Docker image configuration
3. Update environment variables mapping
4. Add game-specific configurations
5. Test with sample server

## 📊 Monitoring & Metrics

### Real-time Metrics
- CPU usage per server
- Memory consumption
- Disk I/O statistics
- Network traffic
- Player count (game-specific)

### System Health
- Container status monitoring
- Automatic restart on crashes
- Resource usage alerts
- Performance optimization suggestions

### Logging
- Structured logging with Winston
- Container logs aggregation
- Audit trail for all operations
- Error tracking and reporting

## 🔒 Security

### Authentication
- JWT-based session management
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Session timeout and refresh

### Container Security
- Isolated game server containers
- Resource limits enforcement
- Network security groups
- File system permissions

### Data Protection
- Database encryption at rest
- Secure file upload handling
- Input validation and sanitization
- CORS configuration

## 🚀 Scaling & Performance

### Horizontal Scaling
- Multi-node Docker support
- Load balancing for API servers
- Database read replicas
- Redis clustering

### Optimization
- Connection pooling
- Query optimization
- Caching strategies
- Background job processing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Jest testing framework

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Documentation: [Wiki](https://github.com/your-org/goodhost/wiki)
- Issues: [GitHub Issues](https://github.com/your-org/goodhost/issues)
- Discord: [Community Server](https://discord.gg/your-invite)
- Email: support@goodhost.com

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Core server management
- ✅ Docker integration
- ✅ Basic monitoring
- ✅ File management
- ✅ Backup system

### Phase 2 (Next)
- 🔄 Frontend dashboard
- 🔄 Advanced monitoring
- 🔄 Plugin system
- 🔄 Multi-node support

### Phase 3 (Future)
- 📋 VPS hosting integration
- 📋 Kubernetes support
- 📋 Advanced analytics
- 📋 Marketplace integration

---

Built with ❤️ by the GoodHost team. Empowering gamers to host better servers.