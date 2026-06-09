import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Health check endpoint — returns DB connectivity status.
   * Excluded from global /api prefix → accessible at GET /health
   */
  @Get('health')
  async healthCheck() {
    return this.appService.checkHealth();
  }
}
