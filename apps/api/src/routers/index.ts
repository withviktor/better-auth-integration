import { router } from '../trpc.js';
import { serversRouter } from './servers.js';

export const appRouter = router({
  servers: serversRouter
});

export type AppRouter = typeof appRouter;
