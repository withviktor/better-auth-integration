import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './api/root';
import { createContext } from './api/trpc';
import { dockerService } from './services/docker.service';
import { databaseService } from './services/database.service';

const app = new Hono();

// Health check endpoint
app.get('/health', async (c) => {
  const dockerHealthy = await dockerService.testConnection();
  const dbHealthy = await databaseService.testConnection();
  
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      docker: dockerHealthy ? 'healthy' : 'unhealthy',
      database: dbHealthy ? 'healthy' : 'unhealthy',
    }
  });
});

// tRPC endpoint
app.all('/trpc/*', async (c) => {
  const response = await fetchRequestHandler({
    router: appRouter,
    createContext,
    req: c.req.raw,
    endpoint: '/trpc',
  });

  return response;
});

// API routes
app.get('/api/status', (c) => {
  return c.json({
    message: 'GoodHost Game Hosting API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  }, 404);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`🚀 GoodHost Game Hosting Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ Server running at http://localhost:${port}`);
console.log(`📊 Health check: http://localhost:${port}/health`);
console.log(`🔌 tRPC endpoint: http://localhost:${port}/trpc`);