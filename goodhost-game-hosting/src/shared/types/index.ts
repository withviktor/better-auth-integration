// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Server status types
export type ServerStatus = 'creating' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'deleting';

// Resource limits
export interface ResourceLimits {
  ram: number; // in MB
  cpu: number; // CPU cores
  diskSpace: number; // in MB
}

// Docker container info
export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: { [key: string]: Array<{ HostPort: string; HostIp: string }> };
  state: {
    Status: string;
    Running: boolean;
    Paused: boolean;
    Restarting: boolean;
    OOMKilled: boolean;
    Dead: boolean;
    Pid: number;
    ExitCode: number;
    Error: string;
    StartedAt: string;
    FinishedAt: string;
  };
  created: string;
  labels: { [key: string]: string };
}

// Resource usage metrics
export interface ResourceMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // in MB
  diskUsage: number; // in MB
  networkIn: number; // bytes
  networkOut: number; // bytes
  timestamp: Date;
}

// Game server configuration
export interface GameServerConfig {
  name: string;
  description?: string;
  serverType: string;
  port: number;
  maxPlayers: number;
  ram: number;
  cpu: number;
  serverProperties?: Record<string, any>;
  environmentVariables?: Record<string, string>;
}

// VPS configuration
export interface VpsConfig {
  name: string;
  description?: string;
  ram: number;
  cpu: number;
  diskSpace: number;
  operatingSystem: string;
  sshPort: number;
}

// User authentication
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin' | 'moderator';
  isActive: boolean;
}

// Subscription plans
export interface SubscriptionPlan {
  id: string;
  name: string;
  pricePerMonth: number;
  maxGameServers: number;
  maxVpsInstances: number;
  maxRam: number; // in MB
  maxCpu: number; // CPU cores
  maxDiskSpace: number; // in MB
  features: string[];
}

// Docker operations
export interface DockerOperation {
  type: 'create' | 'start' | 'stop' | 'restart' | 'delete';
  containerId?: string;
  image?: string;
  name?: string;
  ports?: { [key: string]: string };
  environment?: { [key: string]: string };
  volumes?: { [key: string]: string };
  labels?: { [key: string]: string };
  resources?: {
    memory?: number;
    cpus?: number;
  };
}

// Server events
export interface ServerEvent {
  id: string;
  serverId: string;
  serverType: 'game_server' | 'vps';
  eventType: 'created' | 'started' | 'stopped' | 'deleted' | 'error' | 'resource_warning';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export class GameHostingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'GameHostingError';
  }
}

export class ValidationError extends GameHostingError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends GameHostingError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends GameHostingError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends GameHostingError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ResourceLimitError extends GameHostingError {
  constructor(message: string, public resource: string) {
    super(message, 'RESOURCE_LIMIT_EXCEEDED', 400);
    this.name = 'ResourceLimitError';
  }
}