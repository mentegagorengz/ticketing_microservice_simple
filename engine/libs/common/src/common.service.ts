import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Shared between engine (acquire) and worker (release) — must not drift. */
export const seatLockKey = (seatId: string) => `lock:seat:${seatId}`;

@Injectable()
export class CommonService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommonService.name);
  private redisClient: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.redisClient = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: Number(this.config.getOrThrow<string>('REDIS_PORT')),
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
