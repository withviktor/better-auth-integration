#!/bin/bash

# GoodHost Setup Script
echo "🚀 Setting up GoodHost Server Management System..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    read -p "Press Enter to continue after editing .env file..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
if command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗃️ Running database migrations..."
npx prisma migrate dev --name init

# Create default server directories
echo "📁 Creating server directories..."
mkdir -p game_servers
mkdir -p backups
mkdir -p logs

# Set permissions
chmod 755 game_servers
chmod 755 backups
chmod 755 logs

echo "✅ Setup completed successfully!"
echo ""
echo "🚀 To start the application:"
echo "   yarn start:dev"
echo ""
echo "🌐 API will be available at: http://localhost:3000"
echo "📊 Health check: http://localhost:3000/health"
echo "📖 API Info: http://localhost:3000/api/info"
echo ""
echo "🔧 Useful commands:"
echo "   yarn start:dev    - Start development server"
echo "   yarn build        - Build for production"
echo "   yarn test         - Run tests"
echo "   npx prisma studio - Open database GUI"
echo ""
echo "Happy hosting! 🎮"