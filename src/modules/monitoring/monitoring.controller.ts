import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('monitoring')
@UseGuards(AuthGuard)
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  /**
   * Get system overview (admin only in production)
   */
  @Get('overview')
  async getSystemOverview() {
    return this.monitoringService.getSystemOverview();
  }

  /**
   * Get server metrics
   */
  @Get('servers/:id/metrics')
  async getServerMetrics(
    @Param('id') serverId: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNumber = hours ? parseInt(hours, 10) : 24;
    return this.monitoringService.getServerMetrics(serverId, hoursNumber);
  }

  /**
   * Get server uptime
   */
  @Get('servers/:id/uptime')
  async getServerUptime(
    @Param('id') serverId: string,
    @Query('days') days?: string,
  ) {
    const daysNumber = days ? parseInt(days, 10) : 30;
    return this.monitoringService.getServerUptime(serverId, daysNumber);
  }

  /**
   * Check server health
   */
  @Get('servers/:id/health')
  async checkServerHealth(@Param('id') serverId: string) {
    return this.monitoringService.checkServerHealth(serverId);
  }
}