import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BackupService, CreateBackupDto } from './backup.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('backups')
@UseGuards(AuthGuard)
export class BackupController {
  constructor(private backupService: BackupService) {}

  /**
   * Create a manual backup
   */
  @Post()
  async createBackup(@Request() req: any, @Body() createDto: CreateBackupDto) {
    return this.backupService.createBackup(req.user.id, createDto);
  }

  /**
   * Get all user's backups
   */
  @Get()
  async getUserBackups(@Request() req: any) {
    return this.backupService.getUserBackups(req.user.id);
  }

  /**
   * Get backups for a specific server
   */
  @Get('server/:serverId')
  async getServerBackups(@Request() req: any, @Param('serverId') serverId: string) {
    return this.backupService.getServerBackups(req.user.id, serverId);
  }

  /**
   * Get specific backup
   */
  @Get(':id')
  async getBackup(@Request() req: any, @Param('id') backupId: string) {
    return this.backupService.getBackup(req.user.id, backupId);
  }

  /**
   * Delete backup
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBackup(@Request() req: any, @Param('id') backupId: string) {
    await this.backupService.deleteBackup(req.user.id, backupId);
  }

  /**
   * Restore backup
   */
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreBackup(
    @Request() req: any,
    @Param('id') backupId: string,
    @Body() body: { targetServerId?: string },
  ) {
    await this.backupService.restoreBackup(req.user.id, backupId, body.targetServerId);
    return { message: 'Backup restore initiated' };
  }

  /**
   * Schedule automatic backup for server
   */
  @Post('server/:serverId/schedule')
  @HttpCode(HttpStatus.OK)
  async scheduleAutoBackup(@Request() req: any, @Param('serverId') serverId: string) {
    await this.backupService.scheduleAutoBackup(serverId);
    return { message: 'Auto backup scheduled' };
  }

  /**
   * Cancel automatic backup for server
   */
  @Delete('server/:serverId/schedule')
  @HttpCode(HttpStatus.OK)
  async cancelAutoBackup(@Request() req: any, @Param('serverId') serverId: string) {
    await this.backupService.cancelAutoBackup(serverId);
    return { message: 'Auto backup cancelled' };
  }

  /**
   * Get backup statistics
   */
  @Get('stats')
  async getBackupStats(@Request() req: any) {
    return this.backupService.getBackupStats(req.user.id);
  }
}