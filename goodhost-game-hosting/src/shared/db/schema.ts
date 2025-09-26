import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin', 'moderator'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// Game server types
export const gameServerTypes = sqliteTable('game_server_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g., "Minecraft", "CS2", "Rust"
  displayName: text('display_name').notNull(),
  description: text('description'),
  dockerImage: text('docker_image').notNull(),
  defaultPort: integer('default_port').notNull(),
  maxPlayers: integer('max_players').notNull().default(20),
  minRam: integer('min_ram').notNull(), // in MB
  maxRam: integer('max_ram').notNull(), // in MB
  minCpu: real('min_cpu').notNull(), // CPU cores
  maxCpu: real('max_cpu').notNull(), // CPU cores
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Game servers
export const gameServers = sqliteTable('game_servers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  serverTypeId: text('server_type_id').notNull().references(() => gameServerTypes.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['creating', 'starting', 'running', 'stopping', 'stopped', 'error', 'deleting'] 
  }).notNull().default('creating'),
  containerId: text('container_id'), // Docker container ID
  port: integer('port').notNull(),
  ram: integer('ram').notNull(), // in MB
  cpu: real('cpu').notNull(), // CPU cores
  diskSpace: integer('disk_space').notNull().default(10240), // in MB
  maxPlayers: integer('max_players').notNull(),
  serverProperties: text('server_properties', { mode: 'json' }), // JSON config
  environmentVariables: text('environment_variables', { mode: 'json' }), // JSON env vars
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
  lastStartedAt: integer('last_started_at', { mode: 'timestamp' }),
  lastStoppedAt: integer('last_stopped_at', { mode: 'timestamp' }),
});

// VPS instances
export const vpsInstances = sqliteTable('vps_instances', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['creating', 'starting', 'running', 'stopping', 'stopped', 'error', 'deleting'] 
  }).notNull().default('creating'),
  containerId: text('container_id'), // Docker container ID
  ram: integer('ram').notNull(), // in MB
  cpu: real('cpu').notNull(), // CPU cores
  diskSpace: integer('disk_space').notNull(), // in MB
  operatingSystem: text('operating_system').notNull().default('ubuntu:22.04'),
  sshPort: integer('ssh_port').notNull(),
  rootPassword: text('root_password'), // Encrypted
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
  lastStartedAt: integer('last_started_at', { mode: 'timestamp' }),
  lastStoppedAt: integer('last_stopped_at', { mode: 'timestamp' }),
});

// Resource usage tracking
export const resourceUsage = sqliteTable('resource_usage', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(), // Can be game server or VPS
  serverType: text('server_type', { enum: ['game_server', 'vps'] }).notNull(),
  cpuUsage: real('cpu_usage').notNull(), // Percentage
  memoryUsage: integer('memory_usage').notNull(), // in MB
  diskUsage: integer('disk_usage').notNull(), // in MB
  networkIn: integer('network_in').notNull().default(0), // bytes
  networkOut: integer('network_out').notNull().default(0), // bytes
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Server logs
export const serverLogs = sqliteTable('server_logs', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  serverType: text('server_type', { enum: ['game_server', 'vps'] }).notNull(),
  level: text('level', { enum: ['info', 'warn', 'error', 'debug'] }).notNull(),
  message: text('message').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Billing and subscriptions
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  planName: text('plan_name').notNull(),
  pricePerMonth: real('price_per_month').notNull(),
  maxGameServers: integer('max_game_servers').notNull().default(1),
  maxVpsInstances: integer('max_vps_instances').notNull().default(0),
  maxRam: integer('max_ram').notNull().default(2048), // in MB
  maxCpu: real('max_cpu').notNull().default(1.0),
  maxDiskSpace: integer('max_disk_space').notNull().default(10240), // in MB
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertGameServerTypeSchema = createInsertSchema(gameServerTypes);
export const selectGameServerTypeSchema = createSelectSchema(gameServerTypes);

export const insertGameServerSchema = createInsertSchema(gameServers);
export const selectGameServerSchema = createSelectSchema(gameServers);

export const insertVpsInstanceSchema = createInsertSchema(vpsInstances);
export const selectVpsInstanceSchema = createSelectSchema(vpsInstances);

export const insertResourceUsageSchema = createInsertSchema(resourceUsage);
export const selectResourceUsageSchema = createSelectSchema(resourceUsage);

export const insertServerLogSchema = createInsertSchema(serverLogs);
export const selectServerLogSchema = createSelectSchema(serverLogs);

export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const selectSubscriptionSchema = createSelectSchema(subscriptions);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type GameServerType = typeof gameServerTypes.$inferSelect;
export type NewGameServerType = typeof gameServerTypes.$inferInsert;

export type GameServer = typeof gameServers.$inferSelect;
export type NewGameServer = typeof gameServers.$inferInsert;

export type VpsInstance = typeof vpsInstances.$inferSelect;
export type NewVpsInstance = typeof vpsInstances.$inferInsert;

export type ResourceUsage = typeof resourceUsage.$inferSelect;
export type NewResourceUsage = typeof resourceUsage.$inferInsert;

export type ServerLog = typeof serverLogs.$inferSelect;
export type NewServerLog = typeof serverLogs.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;