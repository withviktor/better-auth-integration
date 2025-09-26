import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): any {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'GoodHost Server Management',
      version: '1.0.0',
    };
  }

  @Get('api/info')
  getApiInfo(): any {
    return {
      name: 'GoodHost API',
      version: '1.0.0',
      description: 'Game server hosting and management API',
      endpoints: {
        auth: '/auth',
        servers: '/servers',
        templates: '/templates',
        backups: '/backups',
        files: '/files',
        monitoring: '/monitoring',
      },
      websocket: '/socket.io',
    };
  }
}
