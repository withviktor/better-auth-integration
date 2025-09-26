import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { GameType, ServerStatus } from "@prisma/client";
import { serverManager } from "@/server/services/server-manager";

export const serverRouter = createTRPCRouter({
  // Get all servers for the current user
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const servers = await prisma.server.findMany({
      where: {
        ownerId: ctx.session.user.id,
      },
      include: {
        instances: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return servers;
  }),

  // Get a specific server by ID
  getById: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .query(async ({ ctx, input }) => {
      const server = await prisma.server.findFirst({
        where: {
          id: input.serverId,
          ownerId: ctx.session.user.id,
        },
        include: {
          instances: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          backups: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!server) {
        throw new Error("Server not found");
      }

      return server;
    }),

  // Create a new server
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        gameType: z.nativeEnum(GameType),
        version: z.string().min(1),
        port: z.number().min(1024).max(65535),
        maxPlayers: z.number().min(1).max(1000),
        motd: z.string().optional(),
        cpuLimit: z.number().min(100).max(8000).default(2000),
        memoryLimit: z.number().min(512).max(16384).default(2048),
        diskLimit: z.number().min(1024).max(102400).default(10240),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if port is already in use
      const existingServer = await prisma.server.findFirst({
        where: { port: input.port },
      });

      if (existingServer) {
        throw new Error("Port is already in use");
      }

      const server = await prisma.server.create({
        data: {
          ...input,
          ownerId: ctx.session.user.id,
          status: ServerStatus.OFFLINE,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId: ctx.session.user.id,
          serverId: server.id,
          action: "SERVER_CREATE",
          details: { serverName: server.name, gameType: server.gameType },
        },
      });

      return server;
    }),

  // Start a server
  start: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const server = await prisma.server.findFirst({
        where: {
          id: input.serverId,
          ownerId: ctx.session.user.id,
        },
      });

      if (!server) {
        throw new Error("Server not found");
      }

      // Start the server using the server manager
      await serverManager.startServer(server);

      // Update server status
      await prisma.server.update({
        where: { id: server.id },
        data: { status: ServerStatus.STARTING },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId: ctx.session.user.id,
          serverId: server.id,
          action: "SERVER_START",
        },
      });

      return { success: true };
    }),

  // Stop a server
  stop: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const server = await prisma.server.findFirst({
        where: {
          id: input.serverId,
          ownerId: ctx.session.user.id,
        },
      });

      if (!server) {
        throw new Error("Server not found");
      }

      // Stop the server using the server manager
      await serverManager.stopServer(server);

      // Update server status
      await prisma.server.update({
        where: { id: server.id },
        data: { status: ServerStatus.STOPPING },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId: ctx.session.user.id,
          serverId: server.id,
          action: "SERVER_STOP",
        },
      });

      return { success: true };
    }),

  // Restart a server
  restart: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const server = await prisma.server.findFirst({
        where: {
          id: input.serverId,
          ownerId: ctx.session.user.id,
        },
      });

      if (!server) {
        throw new Error("Server not found");
      }

      // Restart the server using the server manager
      await serverManager.restartServer(server);

      // Log activity
      await prisma.activity.create({
        data: {
          userId: ctx.session.user.id,
          serverId: server.id,
          action: "SERVER_RESTART",
        },
      });

      return { success: true };
    }),

  // Delete a server
  delete: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const server = await prisma.server.findFirst({
        where: {
          id: input.serverId,
          ownerId: ctx.session.user.id,
        },
      });

      if (!server) {
        throw new Error("Server not found");
      }

      // Stop the server first if it's running
      if (server.status === ServerStatus.ONLINE) {
        await serverManager.stopServer(server);
      }

      // Delete all associated data
      await prisma.$transaction([
        prisma.backup.deleteMany({ where: { serverId: server.id } }),
        prisma.serverInstance.deleteMany({ where: { serverId: server.id } }),
        prisma.resourceUsage.deleteMany({ where: { serverId: server.id } }),
        prisma.activity.deleteMany({ where: { serverId: server.id } }),
        prisma.server.delete({ where: { id: server.id } }),
      ]);

      // Log activity
      await prisma.activity.create({
        data: {
          userId: ctx.session.user.id,
          action: "SERVER_DELETE",
          details: { serverName: server.name },
        },
      });

      return { success: true };
    }),

  // Get server logs
  getLogs: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .query(async ({ ctx, input }) => {
      const server = await prisma.server.findFirst({
        where: {
          id: input.serverId,
          ownerId: ctx.session.user.id,
        },
        include: {
          instances: {
            where: { status: "RUNNING" },
            take: 1,
          },
        },
      });

      if (!server) {
        throw new Error("Server not found");
      }

      // Get logs from the server manager
      const logs = await serverManager.getLogs(server);

      return logs;
    }),
});