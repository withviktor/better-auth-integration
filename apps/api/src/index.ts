import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/index.js';
import { createContext } from './trpc.js';

const PORT = Number(process.env['PORT'] ?? 3001);

async function main() {
  const app = Fastify({ logger: true });

  app.register(fastifyCors, { origin: true });

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext }
  });

  app.get('/health', async () => ({ ok: true }));

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`API listening on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
