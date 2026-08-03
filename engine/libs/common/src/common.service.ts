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
      this.logger.log('Connected to Redis');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  async acquireLock(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.redisClient.set(key, value, 'EX', ttl, 'NX');

    return result === 'OK';
  }

  // Compare-and-delete: hanya lepas lock kalau masih milik si pemegang.
  // Mencegah worker tua (yang lock-nya sudah kadaluarsa TTL lalu diambil
  // user lain) menghapus lock milik orang baru. Atomic via Lua, bukan
  // get-then-del (race).
  async releaseLock(key: string, owner: string): Promise<void> {
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      end
      return 0
    `;
    await this.redisClient.eval(script, 1, key, owner);
  }
}
