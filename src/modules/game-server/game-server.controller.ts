import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GameServerService, CreateServerDto, UpdateServerDto } from './game-server.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('servers')
@UseGuards(AuthGuard)
export class GameServerController {
  constructor(private gameServerService: GameServerService) {}

  /**
   * Create a new game server
   */
  @Post()
  async createServer(@Request() req: any, @Body() createDto: CreateServerDto) {
    return this.gameServerService.createServer(req.user.id, createDto);
  }

  /**
   * Get all servers for the authenticated user
   */
  @Get()
  async getUserServers(@Request() req: any) {
    return this.gameServerService.getUserServers(req.user.id);
  }

  /**
   * Get a specific server by ID
   */
  @Get(':id')
  async getServer(@Request() req: any, @Param('id') serverId: string) {
    return this.gameServerService.getServer(serverId, req.user.id);
  }

  /**
   * Update server configuration
   */
  @Put(':id')
  async updateServer(
    @Request() req: any,
    @Param('id') serverId: string,
    @Body() updateDto: UpdateServerDto,
  ) {
    return this.gameServerService.updateServer(serverId, req.user.id, updateDto);
  }

  /**
   * Delete a server
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteServer(@Request() req: any, @Param('id') serverId: string) {
    await this.gameServerService.deleteServer(serverId, req.user.id);
  }

  /**
   * Start a server
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startServer(@Request() req: any, @Param('id') serverId: string) {
    await this.gameServerService.startServer(serverId, req.user.id);
    return { message: 'Server start initiated' };
  }

  /**
   * Stop a server
   */
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stopServer(@Request() req: any, @Param('id') serverId: string) {
    await this.gameServerService.stopServer(serverId, req.user.id);
    return { message: 'Server stop initiated' };
  }

  /**
   * Restart a server
   */
  @Post(':id/restart')
  @HttpCode(HttpStatus.OK)
  async restartServer(@Request() req: any, @Param('id') serverId: string) {
    await this.gameServerService.restartServer(serverId, req.user.id);
    return { message: 'Server restart initiated' };
  }

  /**
   * Get server logs
   */
  @Get(':id/logs')
  async getServerLogs(
    @Request() req: any,
    @Param('id') serverId: string,
    @Query('tail') tail?: string,
  ) {
    const tailCount = tail ? parseInt(tail, 10) : 100;
    const logs = await this.gameServerService.getServerLogs(serverId, req.user.id, tailCount);
    return { logs };
  }

  /**
   * Execute command in server
   */
  @Post(':id/command')
  async executeCommand(
    @Request() req: any,
    @Param('id') serverId: string,
    @Body() body: { command: string },
  ) {
    const output = await this.gameServerService.executeCommand(serverId, req.user.id, body.command);
    return { output };
  }

  /**
   * Get server statistics
   */
  @Get(':id/stats')
  async getServerStats(@Request() req: any, @Param('id') serverId: string) {
    return this.gameServerService.getServerStats(serverId, req.user.id);
  }
}