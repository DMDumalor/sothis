import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'sothis-1618-hr-erp-api', timestamp: new Date().toISOString() };
  }
}
