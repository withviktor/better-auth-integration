#!/bin/bash

# Development helper script for GoodHost
echo "🔧 GoodHost Development Helper"

case "$1" in
    "start")
        echo "🚀 Starting development environment..."
        docker-compose up -d postgres redis
        sleep 3
        yarn start:dev
        ;;
    "stop")
        echo "🛑 Stopping development environment..."
        docker-compose stop
        ;;
    "reset")
        echo "🔄 Resetting development environment..."
        docker-compose down -v
        docker-compose up -d postgres redis
        sleep 5
        npx prisma migrate reset --force
        yarn start:dev
        ;;
    "logs")
        echo "📋 Showing application logs..."
        docker-compose logs -f goodhost_app
        ;;
    "db")
        echo "🗃️ Opening database GUI..."
        npx prisma studio
        ;;
    "migrate")
        echo "🗃️ Running database migration..."
        npx prisma migrate dev
        ;;
    "seed")
        echo "🌱 Seeding database..."
        npx prisma db seed
        ;;
    "test")
        echo "🧪 Running tests..."
        yarn test
        ;;
    "build")
        echo "🏗️ Building application..."
        yarn build
        ;;
    *)
        echo "Usage: $0 {start|stop|reset|logs|db|migrate|seed|test|build}"
        echo ""
        echo "Commands:"
        echo "  start   - Start development environment"
        echo "  stop    - Stop development environment"
        echo "  reset   - Reset and restart development environment"
        echo "  logs    - Show application logs"
        echo "  db      - Open database GUI (Prisma Studio)"
        echo "  migrate - Run database migrations"
        echo "  seed    - Seed database with sample data"
        echo "  test    - Run test suite"
        echo "  build   - Build application for production"
        exit 1
        ;;
esac