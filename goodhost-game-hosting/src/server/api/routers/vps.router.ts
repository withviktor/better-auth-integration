import { z } from 'zod';
import { router, protectedProcedure, adminProcedure, handleTRPCError, validateResourceLimits, validateServerOwnership } from '../trpc';
import { dockerService } from '@/server/services/docker.service';
import { generateId, generatePort } from '@/shared/utils';
import { VpsConfig, ServerStatus } from '@/shared/types';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '@/shared/db/schema';

export const vpsRouter = router({
  // Get all VPS instances for the authenticated user
  getUserVpsInstances: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const instances = await ctx.db.query.vpsInstances.findMany({
          where: eq(schema.vpsInstances.userId, ctx.user.id),
          orderBy: [desc(schema.vpsInstances.createdAt)]
        });
        
        return instances;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get a specific VPS instance
  getVpsInstance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        return instance;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Create a new VPS instance
  createVpsInstance: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      description: z.string().optional(),
      ram: z.number().min(512).max(32768), // 512MB to 32GB
      cpu: z.number().min(0.5).max(16), // 0.5 to 16 cores
      diskSpace: z.number().min(1024).max(1048576), // 1GB to 1TB
      operatingSystem: z.string().default('ubuntu:22.04'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
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
          validateResourceLimits(input.diskSpace, subscription.maxDiskSpace, 'Disk Space');
        }
        
        // Check current VPS count
        const currentInstances = await ctx.db.query.vpsInstances.findMany({
          where: eq(schema.vpsInstances.userId, ctx.user.id)
        });
        
        if (subscription && currentInstances.length >= subscription.maxVpsInstances) {
          throw new Error('Maximum number of VPS instances reached');
        }
        
        // Generate unique SSH port
        const sshPort = generatePort(22000, 23000);
        
        // Generate root password
        const rootPassword = generateId('pwd').substring(0, 12);
        
        // Create VPS record
        const vpsId = generateId('vps');
        const newVps = {
          id: vpsId,
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          status: 'creating' as ServerStatus,
          ram: input.ram,
          cpu: input.cpu,
          diskSpace: input.diskSpace,
          operatingSystem: input.operatingSystem,
          sshPort,
          rootPassword, // In production, this should be encrypted
        };
        
        await ctx.db.insert(schema.vpsInstances).values(newVps);
        
        // Create Docker container asynchronously
        setImmediate(async () => {
          try {
            const containerId = await dockerService.createContainer({
              image: input.operatingSystem,
              name: `vps-${vpsId}`,
              ports: { '22': sshPort.toString() },
              environment: {
                ROOT_PASSWORD: rootPassword,
                DEBIAN_FRONTEND: 'noninteractive',
              },
              volumes: {
                [`vps-${vpsId}-data`]: '/data'
              },
              labels: {
                'goodhost.type': 'vps',
                'goodhost.vps-id': vpsId,
                'goodhost.user-id': ctx.user.id,
              },
              resources: {
                memory: input.ram,
                cpus: input.cpu,
              }
            });
            
            // Update VPS with container ID and start it
            await ctx.db.update(schema.vpsInstances)
              .set({ 
                containerId,
                status: 'starting',
                updatedAt: new Date()
              })
              .where(eq(schema.vpsInstances.id, vpsId));
            
            await dockerService.startContainer(containerId);
            
            // Update VPS status to running
            await ctx.db.update(schema.vpsInstances)
              .set({ 
                status: 'running',
                lastStartedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(schema.vpsInstances.id, vpsId));
              
          } catch (error) {
            console.error('Failed to create VPS container:', error);
            
            // Update VPS status to error
            await ctx.db.update(schema.vpsInstances)
              .set({ 
                status: 'error',
                updatedAt: new Date()
              })
              .where(eq(schema.vpsInstances.id, vpsId));
          }
        });
        
        return { id: vpsId, status: 'creating', sshPort, rootPassword };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Start a VPS instance
  startVpsInstance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        if (!instance.containerId) {
          throw new Error('VPS container not found');
        }
        
        if (instance.status === 'running') {
          throw new Error('VPS is already running');
        }
        
        // Update status to starting
        await ctx.db.update(schema.vpsInstances)
          .set({ 
            status: 'starting',
            updatedAt: new Date()
          })
          .where(eq(schema.vpsInstances.id, input.id));
        
        // Start container
        await dockerService.startContainer(instance.containerId);
        
        // Update status to running
        await ctx.db.update(schema.vpsInstances)
          .set({ 
            status: 'running',
            lastStartedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.vpsInstances.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Stop a VPS instance
  stopVpsInstance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        if (!instance.containerId) {
          throw new Error('VPS container not found');
        }
        
        if (instance.status === 'stopped') {
          throw new Error('VPS is already stopped');
        }
        
        // Update status to stopping
        await ctx.db.update(schema.vpsInstances)
          .set({ 
            status: 'stopping',
            updatedAt: new Date()
          })
          .where(eq(schema.vpsInstances.id, input.id));
        
        // Stop container
        await dockerService.stopContainer(instance.containerId);
        
        // Update status to stopped
        await ctx.db.update(schema.vpsInstances)
          .set({ 
            status: 'stopped',
            lastStoppedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.vpsInstances.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Restart a VPS instance
  restartVpsInstance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        if (!instance.containerId) {
          throw new Error('VPS container not found');
        }
        
        // Restart container
        await dockerService.restartContainer(instance.containerId);
        
        // Update status
        await ctx.db.update(schema.vpsInstances)
          .set({ 
            status: 'running',
            lastStartedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.vpsInstances.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Delete a VPS instance
  deleteVpsInstance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        // Update status to deleting
        await ctx.db.update(schema.vpsInstances)
          .set({ 
            status: 'deleting',
            updatedAt: new Date()
          })
          .where(eq(schema.vpsInstances.id, input.id));
        
        // Delete container if it exists
        if (instance.containerId) {
          try {
            await dockerService.deleteContainer(instance.containerId, true);
          } catch (error) {
            console.error('Failed to delete VPS container:', error);
          }
        }
        
        // Delete VPS record
        await ctx.db.delete(schema.vpsInstances)
          .where(eq(schema.vpsInstances.id, input.id));
        
        return { success: true };
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get VPS logs
  getVpsLogs: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      tail: z.number().min(1).max(1000).default(100)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        if (!instance.containerId) {
          throw new Error('VPS container not found');
        }
        
        const logs = await dockerService.getContainerLogs(instance.containerId, input.tail);
        return logs;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Get VPS stats
  getVpsStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        if (!instance.containerId) {
          throw new Error('VPS container not found');
        }
        
        const stats = await dockerService.getContainerStats(instance.containerId);
        return stats;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Execute command in VPS
  executeCommand: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      command: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const instance = await validateServerOwnership(ctx.db, input.id, ctx.user.id, 'vps');
        
        if (!instance.containerId) {
          throw new Error('VPS container not found');
        }
        
        if (instance.status !== 'running') {
          throw new Error('VPS must be running to execute commands');
        }
        
        const result = await dockerService.execCommand(instance.containerId, input.command);
        return result;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),

  // Admin: Get all VPS instances
  getAllVpsInstances: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const offset = (input.page - 1) * input.limit;
        
        const where = input.status 
          ? eq(schema.vpsInstances.status, input.status as ServerStatus)
          : undefined;
        
        const instances = await ctx.db.query.vpsInstances.findMany({
          where,
          limit: input.limit,
          offset,
          orderBy: [desc(schema.vpsInstances.createdAt)],
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                email: true,
              }
            }
          }
        });
        
        const total = await ctx.db.select({ count: schema.vpsInstances.id })
          .from(schema.vpsInstances)
          .where(where);
        
        return {
          instances,
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