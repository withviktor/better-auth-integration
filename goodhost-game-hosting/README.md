# GoodHost Game Hosting Platform

A modern, Docker-based game server hosting platform built with TypeScript, Next.js, tRPC, and Prisma. Inspired by how big companies handle containerized game server management.

## 🚀 Features

### Game Server Hosting
- **Multi-Game Support**: Minecraft, CS2, Rust, and more
- **Docker Containerization**: Isolated, scalable game server instances
- **Resource Management**: CPU, RAM, and disk space allocation
- **Real-time Monitoring**: Live resource usage and performance metrics
- **Easy Management**: Start, stop, restart, and delete servers via web interface

### VPS Hosting
- **Multiple OS Support**: Ubuntu, Debian, CentOS, Alpine Linux
- **SSH Access**: Secure shell access with generated credentials
- **Web Terminal**: Execute commands directly from the dashboard
- **Resource Scaling**: Adjust CPU, RAM, and disk space as needed

### Modern Tech Stack
- **Frontend**: Next.js 15 with React 18 and TypeScript
- **Backend**: Hono web framework with tRPC for type-safe APIs
- **Database**: SQLite with Drizzle ORM (easily switchable to PostgreSQL)
- **Containerization**: Docker with Dockerode for container management
- **Styling**: Tailwind CSS with custom component system
- **Monitoring**: Prometheus and Grafana integration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI   │    │   Hono API     │    │   Docker API   │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Containers)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   tRPC Client   │    │   Drizzle ORM   │    │   Game Servers  │
│   (Type Safety) │    │   (Database)    │    │   (Minecraft,   │
└─────────────────┘    └─────────────────┘    │    CS2, Rust)   │
                                              └─────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd goodhost-game-hosting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize database**
   ```bash
   npm run db:push
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - Health Check: http://localhost:3001/health

### Production Deployment

1. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Using Kubernetes** (coming soon)
   ```bash
   kubectl apply -f k8s/
   ```

## 📊 Monitoring

The platform includes comprehensive monitoring:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Beautiful dashboards and visualization
- **Health Checks**: Service health monitoring
- **Resource Usage**: Real-time CPU, memory, and network stats

Access monitoring at:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

## 🎮 Supported Games

### Currently Supported
- **Minecraft**: Java Edition with mod support
- **Counter-Strike 2**: Dedicated servers
- **Rust**: Survival game servers
- **Valheim**: Viking survival servers

### Coming Soon
- **ARK: Survival Evolved**
- **7 Days to Die**
- **Terraria**
- **Factorio**

## 🔧 Configuration

### Game Server Types
Add new game server types in the database:

```sql
INSERT INTO game_server_types (
  id, name, display_name, description, docker_image, 
  default_port, max_players, min_ram, max_ram, min_cpu, max_cpu
) VALUES (
  'minecraft', 'Minecraft', 'Minecraft Java Edition',
  'The classic block-building game', 'itzg/minecraft-server',
  25565, 20, 512, 8192, 0.5, 4.0
);
```

### Resource Limits
Configure user resource limits in the subscriptions table:

```sql
INSERT INTO subscriptions (
  id, user_id, plan_name, price_per_month, max_game_servers,
  max_vps_instances, max_ram, max_cpu, max_disk_space
) VALUES (
  'basic', 'user-id', 'Basic Plan', 9.99,
  2, 1, 4096, 2.0, 51200
);
```

## 🚀 Scaling

### Horizontal Scaling
- Deploy multiple API instances behind a load balancer
- Use Redis for session storage and caching
- Implement database read replicas

### Vertical Scaling
- Increase container resource limits
- Add more powerful hardware
- Optimize Docker container configurations

## 🔒 Security

- **Container Isolation**: Each server runs in its own Docker container
- **Resource Limits**: Prevent resource exhaustion attacks
- **Network Security**: Isolated container networks
- **Authentication**: JWT-based authentication (coming soon)
- **Rate Limiting**: API rate limiting with Nginx

## 📈 Performance

- **Type Safety**: End-to-end TypeScript for fewer runtime errors
- **Optimized Queries**: Drizzle ORM with optimized database queries
- **Caching**: Redis caching for frequently accessed data
- **CDN Ready**: Static assets optimized for CDN delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Pterodactyl Panel
- Built with modern web technologies
- Docker containerization best practices
- Enterprise-grade monitoring and scaling

## 📞 Support

- **Documentation**: [Wiki](https://github.com/your-org/goodhost-game-hosting/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/goodhost-game-hosting/issues)
- **Discord**: [Community Server](https://discord.gg/your-server)

---

**GoodHost** - Modern game server hosting made simple 🎮