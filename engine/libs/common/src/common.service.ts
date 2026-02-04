import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CommonService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommonService.name);
  private redisClient: Redis;

  onModuleInit() {
    this.redisClient = new Redis({
      host: 'localhost', 
      port: 6379,
    });
    
    this.redisClient.on('connect', () => {
      this.logger.log('🚀 Terhubung ke Redis Docker!');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('❌ Redis Error:', err);
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  async acquireLock(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.redisClient.set(key, value, 'EX', ttl, 'NX');
    
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}