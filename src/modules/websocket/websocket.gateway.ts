import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(private authService: AuthService) {}

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Validate token
      const user = await this.authService.validateSession(token as string);
      if (!user) {
        this.logger.warn(`Client ${client.id} connected with invalid token`);
        client.disconnect();
        return;
      }

      // Attach user to socket
      client.userId = user.id;
      this.connectedUsers.set(user.id, client.id);

      // Join user to their personal room
      await client.join(`user:${user.id}`);

      this.logger.log(`User ${user.email} connected (${client.id})`);

      // Send connection confirmation
      client.emit('connected', { 
        message: 'Connected successfully',
        userId: user.id 
      });

    } catch (error) {
      this.logger.error(`Error during connection for client ${client.id}`, error);
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      this.logger.log(`User ${client.userId} disconnected (${client.id})`);
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  /**
   * Join a server room for real-time updates
   */
  @SubscribeMessage('joinServerRoom')
  async handleJoinServerRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { serverId: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { serverId } = data;
    await client.join(`server:${serverId}`);
    
    this.logger.log(`User ${client.userId} joined server room: ${serverId}`);
    client.emit('joinedServerRoom', { serverId });
  }

  /**
   * Leave a server room
   */
  @SubscribeMessage('leaveServerRoom')
  async handleLeaveServerRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { serverId: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { serverId } = data;
    await client.leave(`server:${serverId}`);
    
    this.logger.log(`User ${client.userId} left server room: ${serverId}`);
    client.emit('leftServerRoom', { serverId });
  }

  /**
   * Send server status update to all users in server room
   */
  emitServerStatusUpdate(serverId: string, status: string, data?: any) {
    this.server.to(`server:${serverId}`).emit('serverStatusUpdate', {
      serverId,
      status,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Send server metrics to all users in server room
   */
  emitServerMetrics(serverId: string, metrics: any) {
    this.server.to(`server:${serverId}`).emit('serverMetrics', {
      serverId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send server logs to all users in server room
   */
  emitServerLogs(serverId: string, logs: string[]) {
    this.server.to(`server:${serverId}`).emit('serverLogs', {
      serverId,
      logs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to a specific user
   */
  emitUserNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send system-wide notification
   */
  emitSystemNotification(notification: any) {
    this.server.emit('systemNotification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}