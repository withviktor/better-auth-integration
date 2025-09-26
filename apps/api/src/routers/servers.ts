import { z } from 'zod';
import { Queue } from 'bullmq';
import { publicProcedure, router } from '../trpc.js';
import { JOBS } from '@goodhost/shared';

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const serverQueue = new Queue('server-jobs', { connection: { url: redisUrl } });

export const serversRouter = router({
  list: publicProcedure.query(async () => {
    // TODO: Replace with DB call
    return [] as Array<{ id: string; name: string; status: string }>;
  }),
  start: publicProcedure
    .input(z.object({ serverId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await serverQueue.add(JOBS.START_SERVER, { serverId: input.serverId });
      return { enqueued: true };
    }),
  stop: publicProcedure
    .input(z.object({ serverId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await serverQueue.add(JOBS.STOP_SERVER, { serverId: input.serverId });
      return { enqueued: true };
    })
});
