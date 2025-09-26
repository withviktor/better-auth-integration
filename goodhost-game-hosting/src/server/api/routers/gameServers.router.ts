import { z } from 'zod';
import { router, protectedProcedure, adminProcedure, handleTRPCError, validateResourceLimits, validateServerOwnership } from '../trpc';
import { dockerService } from '@/server/services/docker.service';
import { generateId, generatePort } from '@/shared/utils';
import { GameServerConfig, ServerStatus } from '@/shared/types';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '@/shared/db/schema';

export const gameServersRouter = router({
  // Get all game servers for the authenticated user
  getUserGameServers: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const servers = await ctx.db.query.gameServers.findMany({
          where: eq(schema.gameServers.userId, ctx.user.id),
          orderBy: [desc(schema.gameServers.createdAt)],
          with: {
            serverType: true
          }
        });
        
        return servers;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get a specific game server
  getGameServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        const serverWithType = await ctx.db.query.gameServers.findFirst({
          where: eq(schema.gameServers.id, input.id),
          with: {
            serverType: true
          }
        });
        
        return serverWithType;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Create a new game server
  createGameServer: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      description: z.string().optional(),
      serverTypeId: z.string(),
      maxPlayers: z.number().min(1).max(1000),
      ram: z.number().min(512).max(32768), // 512MB to 32GB
      cpu: z.number().min(0.5).max(16), // 0.5 to 16 cores
      serverProperties: z.record(z.string(), z.any()).optional(),
      environmentVariables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get server type
        const serverType = await ctx.db.query.gameServerTypes.findFirst({
          where: eq(schema.gameServerTypes.id, input.serverTypeId)
        });
        
        if (!serverType) {
          throw new Error('Invalid server type');
        }
        
        // Validate resource limits against user's subscription
        const subscription = await ctx.db.query.subscriptions.findFirst({
          where: and(
            eq(schema.subscriptions.userId, ctx.user.id),
            eq(schema.subscriptions.isActive, true)
          )
        });
        
        if (subscription) {
          validateResourceLimits(input.ram, subscription.maxRam, 'RAM');
          validateResourceLimits(input.cpu, subscription.maxCpu, 'CPU');
        }
        
        // Check current server count
        const currentServers = await ctx.db.query.gameServers.findMany({
          where: eq(schema.gameServers.userId, ctx.user.id)
        });
        
        if (subscription && currentServers.length >= subscription.maxGameServers) {
          throw new Error('Maximum number of game servers reached');
        }
        
        // Generate unique port
        const port = generatePort();
        
        // Create server record
        const serverId = generateId('gs');
        const newServer = {
          id: serverId,
          userId: ctx.user.id,
          serverTypeId: input.serverTypeId,
          name: input.name,
          description: input.description,
          status: 'creating' as ServerStatus,
          port,
          ram: input.ram,
          cpu: input.cpu,
          maxPlayers: input.maxPlayers,
          serverProperties: input.serverProperties,
          environmentVariables: input.environmentVariables,
        };
        
        await ctx.db.insert(schema.gameServers).values(newServer);
        
        // Create Docker container asynchronously
        setImmediate(async () => {
          try {
            const containerId = await dockerService.createContainer({
              image: serverType.dockerImage,
              name: `game-server-${serverId}`,
              ports: { [serverType.defaultPort]: port.toString() },
              environment: {
                ...input.environmentVariables,
                MAX_PLAYERS: input.maxPlayers.toString(),
                SERVER_PORT: serverType.defaultPort.toString(),
                EULA: 'TRUE',
              },
              labels: {
                'goodhost.type': 'game-server',
                'goodhost.server-id': serverId,
                'goodhost.user-id': ctx.user.id,
              },
              resources: {
                memory: input.ram,
                cpus: input.cpu,
              }
            });
            
            // Update server with container ID and start it
            await ctx.db.update(schema.gameServers)
              .set({ 
                containerId,
                status: 'starting',
                updatedAt: new Date()
              })
              .where(eq(schema.gameServers.id, serverId));
            
            await dockerService.startContainer(containerId);
            
            // Update server status to running
            await ctx.db.update(schema.gameServers)
              .set({ 
                status: 'running',
                lastStartedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(schema.gameServers.id, serverId));
              
          } catch (error) {
            console.error('Failed to create Docker container:', error);
            
            // Update server status to error
            await ctx.db.update(schema.gameServers)
              .set({ 
                status: 'error',
                updatedAt: new Date()
              })
              .where(eq(schema.gameServers.id, serverId));
          }
        });
        
        return { id: serverId, status: 'creating' };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Start a game server
  startGameServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        if (!server.containerId) {
          throw new Error('Server container not found');
        }
        
        if (server.status === 'running') {
          throw new Error('Server is already running');
        }
        
        // Update status to starting
        await ctx.db.update(schema.gameServers)
          .set({ 
            status: 'starting',
            updatedAt: new Date()
          })
          .where(eq(schema.gameServers.id, input.id));
        
        // Start container
        await dockerService.startContainer(server.containerId);
        
        // Update status to running
        await ctx.db.update(schema.gameServers)
          .set({ 
            status: 'running',
            lastStartedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.gameServers.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Stop a game server
  stopGameServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        if (!server.containerId) {
          throw new Error('Server container not found');
        }
        
        if (server.status === 'stopped') {
          throw new Error('Server is already stopped');
        }
        
        // Update status to stopping
        await ctx.db.update(schema.gameServers)
          .set({ 
            status: 'stopping',
            updatedAt: new Date()
          })
          .where(eq(schema.gameServers.id, input.id));
        
        // Stop container
        await dockerService.stopContainer(server.containerId);
        
        // Update status to stopped
        await ctx.db.update(schema.gameServers)
          .set({ 
            status: 'stopped',
            lastStoppedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.gameServers.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Restart a game server
  restartGameServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        if (!server.containerId) {
          throw new Error('Server container not found');
        }
        
        // Restart container
        await dockerService.restartContainer(server.containerId);
        
        // Update status
        await ctx.db.update(schema.gameServers)
          .set({ 
            status: 'running',
            lastStartedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.gameServers.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Delete a game server
  deleteGameServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        // Update status to deleting
        await ctx.db.update(schema.gameServers)
          .set({ 
            status: 'deleting',
            updatedAt: new Date()
          })
          .where(eq(schema.gameServers.id, input.id));
        
        // Delete container if it exists
        if (server.containerId) {
          try {
            await dockerService.deleteContainer(server.containerId, true);
          } catch (error) {
            console.error('Failed to delete container:', error);
          }
        }
        
        // Delete server record
        await ctx.db.delete(schema.gameServers)
          .where(eq(schema.gameServers.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get server logs
  getServerLogs: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      tail: z.number().min(1).max(1000).default(100)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        if (!server.containerId) {
          throw new Error('Server container not found');
        }
        
        const logs = await dockerService.getContainerLogs(server.containerId, input.tail);
        return logs;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get server stats
  getServerStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const server = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'game_server');
        
        if (!server.containerId) {
          throw new Error('Server container not found');
        }
        
        const stats = await dockerService.getContainerStats(server.containerId);
        return stats;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get available server types
  getServerTypes: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const serverTypes = await ctx.db.query.gameServerTypes.findMany({
          where: eq(schema.gameServerTypes.isActive, true),
          orderBy: [schema.gameServerTypes.displayName]
        });
        
        return serverTypes;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Admin: Get all game servers
  getAllGameServers: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const offset = (input.page - 1) * input.limit;
        
        const where = input.status 
          ? eq(schema.gameServers.status, input.status as ServerStatus)
          : undefined;
        
        const servers = await ctx.db.query.gameServers.findMany({
          where,
          limit: input.limit,
          offset,
          orderBy: [desc(schema.gameServers.createdAt)],
          with: {
            serverType: true,
            user: {
              columns: {
                id: true,
                username: true,
                email: true,
              }
            }
          }
        });
        
        const total = await ctx.db.select({ count: schema.gameServers.id })
          .from(schema.gameServers)
          .where(where);
        
        return {
          servers,
          pagination: {
            page: input.page,
            limit: input.limit,
            total: total.length,
            totalPages: Math.ceil(total.length / input.limit)
          }
        };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),
});