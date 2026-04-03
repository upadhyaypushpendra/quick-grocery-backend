import { Injectable } from '@nestjs/common';
import packageJson from 'package.json';

@Injectable()
export class AppService {
  healthCheck(): any {
    return {
      message: 'ok',
      timestamp: new Date().toISOString(),
      statusCode: 200,
      serverInfo: {
        name: 'Groceries App Backend',
        version: packageJson.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }
}
