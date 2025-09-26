# GoodHost - Game Server Management System

A modern, Docker-based game server hosting platform built with TypeScript and the Better T Stack. Designed to replace Pterodactyl with a more scalable and developer-friendly architecture.

## Features

- 🚀 **Docker-based**: All game servers run in isolated Docker containers
- 🎮 **Multi-game Support**: Currently supports Minecraft (Java/Bedrock/Paper/Spigot/BungeeCord)
- 🔧 **Real-time Management**: Start, stop, restart, and monitor servers in real-time
- 📊 **Resource Monitoring**: CPU, memory, disk, and network usage tracking
- 👥 **User Management**: Role-based access control with admin and user roles
- 🔒 **Secure**: Built with security best practices and authentication
- 📈 **Scalable**: Microservices architecture ready for horizontal scaling
- 🎯 **TypeScript**: Full type safety throughout the application

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with JWT
- **Containerization**: Docker and Docker Compose
- **Monitoring**: Built-in resource monitoring and metrics
- **Caching**: Redis for performance optimization

## Architecture

The system follows a microservices-inspired architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   tRPC API      │    │   Docker        │
│   (Frontend)    │◄──►│   Layer         │◄──►│   Engine        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prisma ORM    │    │   PostgreSQL    │    │   Server        │
│                 │◄──►│   Database      │    │   Manager       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

- **Server Manager**: Handles Docker container lifecycle and server operations
- **Resource Monitor**: Tracks CPU, memory, and disk usage in real-time
- **User Management**: Role-based access control and authentication
- **Activity Logger**: Audit trail for all server and user actions
- **Backup System**: Automated and manual backup capabilities

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd goodhost-server-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Start the development database and services**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Default admin: `admin@goodhost.com` / `admin123`

### Production Deployment

1. **Build the application**
   ```bash
   docker-compose build
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations**
   ```bash
   docker-compose exec app npm run db:push
   ```

## Usage

### Creating a Server

1. Sign in with your admin account
2. Click "Create Server" on the dashboard
3. Fill in the server details:
   - Server name and description
   - Game type (Minecraft variants)
   - Port number (must be unique)
   - Resource limits (CPU, memory, disk)
   - Server configuration (MOTD, max players, etc.)

### Managing Servers

- **Start**: Launch the server in a Docker container
- **Stop**: Gracefully shutdown the server
- **Restart**: Stop and start the server
- **Monitor**: View real-time resource usage and player count
- **Logs**: Access server console logs
- **Delete**: Remove server and all associated data

### Monitoring

The system automatically monitors:
- CPU usage percentage
- Memory consumption
- Disk space usage
- Network traffic (in/out)
- Player count and server uptime

## API Reference

The application uses tRPC for type-safe API communication. Key endpoints:

### Server Management
- `server.getAll` - Get all servers for the current user
- `server.getById` - Get detailed server information
- `server.create` - Create a new server
- `server.start` - Start a server
- `server.stop` - Stop a server
- `server.restart` - Restart a server
- `server.delete` - Delete a server

### User Management
- Authentication via NextAuth.js
- Role-based permissions (USER, ADMIN, SUPER_ADMIN)
- Activity logging for audit trails

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `NEXTAUTH_URL` | Base URL for authentication | - |
| `NEXTAUTH_SECRET` | Secret for JWT signing | - |
| `DOCKER_HOST` | Docker daemon socket path | `unix:///var/run/docker.sock` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

### Docker Images

The system supports various Minecraft server types:

- **Minecraft Java**: `itzg/minecraft-server`
- **Minecraft Bedrock**: `itzg/minecraft-bedrock-server`
- **Paper**: `paperclipsmc/paper`
- **Spigot**: `itzg/minecraft-server` (with Spigot flag)
- **BungeeCord**: `itzg/bungeecord`

## Security Features

- **Container Isolation**: Each server runs in its own Docker container
- **Resource Limits**: CPU, memory, and disk quotas per server
- **Network Security**: Servers are isolated and only expose necessary ports
- **Authentication**: JWT-based authentication with role-based access
- **Audit Logging**: All actions are logged for security monitoring
- **Input Validation**: Zod schema validation for all API inputs

## Monitoring and Alerts

The system includes built-in monitoring:

- **Resource Usage**: Real-time CPU, memory, and disk monitoring
- **Performance Metrics**: Server response times and throughput
- **Error Tracking**: Automatic error logging and alerting
- **Activity Monitoring**: User and server activity tracking

## Extending the Platform

### Adding New Game Types

1. Update the `GameType` enum in `prisma/schema.prisma`
2. Add game-specific configuration in `ServerManager.createServerConfig()`
3. Update the frontend components to support the new game type
4. Add appropriate Docker images and environment variables

### Adding New Features

The modular architecture makes it easy to extend:

- **New API endpoints**: Add to the tRPC router
- **New services**: Create in the `services/` directory
- **New components**: Add to the `components/` directory
- **Database changes**: Update Prisma schema and run migrations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please contact the GoodHost team or create an issue in the repository.

---

Built with ❤️ by the GoodHost team