import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CommonService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommonService.name);
  private redisClient: Redis;

  onModuleInit() {
    // Kita hardcode dulu ke localhost karena code ini jalan di laptop (Host)
    // yang nembak ke Docker container.
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

  /**
   * THE SNIPER LOCK (Atomic Operation)
   * Mengunci resource agar tidak ada Race Condition.
   * * @param key Key unik (misal: "lock:event1:seatA1")
   * @param value Identitas user (misal: "user_123")
   * @param ttl Waktu lock dalam detik (misal: 300s / 5 menit)
   * @returns true jika berhasil lock, false jika sudah diambil orang
   */
  async acquireLock(key: string, value: string, ttl: number): Promise<boolean> {
    // SET key value NX (Not Exists) EX (Expire) ttl
    // Ini adalah operasi ATOMIK. Redis menjamin hanya 1 request yang sukses.
    const result = await this.redisClient.set(key, value, 'EX', ttl, 'NX');
    
    // Jika result 'OK', berarti kita berhasil mengunci.
    return result === 'OK';
  }

  /**
   * Melepas kunci (misal user cancel atau selesai bayar)
   */
  async releaseLock(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}