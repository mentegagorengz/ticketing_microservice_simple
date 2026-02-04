import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat } from '@app/common';
import { Repository } from 'typeorm';
import Redis from 'ioredis'; // Pastikan import ini ada

@Injectable()
export class EngineService {
  // 1. Inisialisasi Redis Client
  private readonly redis = new Redis({
    host: 'localhost',
    port: 6379,
  });

  constructor(
    @Inject('TICKET_SERVICE') private readonly client: ClientProxy,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
  ) {}

  // === LOGIKA BOOKING FULL (DB + REDIS + QUEUE) ===
  async bookSeat(seatId: string, userId: string) {
    console.log(`\n🎫 Request Booking: ${seatId} oleh ${userId}`);

    // --- STEP 1: VALIDASI DATABASE (Satpam Gudang) ---
    // Pastikan kursi benar-benar ada dan statusnya AVAILABLE
    const seat = await this.seatRepo.findOne({
      where: { seatNumber: seatId },
    });

    if (!seat) {
      console.log(`❌ DITOLAK: Kursi ${seatId} tidak ditemukan di Inventory.`);
      throw new Error(`Kursi ${seatId} tidak valid.`);
    }

    if (seat.status !== 'AVAILABLE') {
      console.log(`❌ DITOLAK: Kursi ${seatId} statusnya ${seat.status}.`);
      throw new Error(`Kursi ${seatId} sudah terjual.`);
    }

    // --- STEP 2: REDIS LOCK (Wasit Balapan) ---
    // Mencegah Race Condition (2 orang booking bersamaan)
    const redisKey = `lock:seat:${seatId}`;

    // SETNX (Set if Not Exists) + Expire 10 menit (600 detik)
    // Jika return 'OK' -> Berhasil kunci
    // Jika return null -> Gagal (sudah dikunci orang lain)
    const isLocked = await this.redis.set(redisKey, userId, 'EX', 600, 'NX');

    if (!isLocked) {
      console.log(
        `🛡️ BLOKIR REDIS: Kursi ${seatId} sedang diproses orang lain.`,
      );
      throw new Error(
        'Kursi sedang dalam proses pemesanan orang lain. Coba lagi.',
      );
    }

    console.log(`✅ KUNCI REDIS: Berhasil mengunci ${seatId} untuk ${userId}`);

    // --- STEP 3: KIRIM KE WORKER (RabbitMQ) + RELEASE LOCK ---
    try {
      // Emit event ke RabbitMQ
      await this.client.emit('ticket_created', { seatId, userId }).toPromise();

      console.log(`📤 Event terkirim ke Worker untuk ${seatId}`);

      // ✅ RELEASE LOCK SETELAH SUKSES KIRIM
      await this.redis.del(redisKey);
      console.log(`🔓 UNLOCK REDIS: Kunci ${seatId} dilepas.`);

      return {
        message: 'Booking sedang diproses',
        seatId,
        userId,
      };
    } catch (error) {
      // ✅ RELEASE LOCK JIKA GAGAL KIRIM EVENT
      await this.redis.del(redisKey);
      console.log(
        `🔓 UNLOCK REDIS (ERROR): Kunci ${seatId} dilepas karena error.`,
      );

      console.error(`❌ Gagal kirim event ke Worker:`, error);
      throw new Error('Gagal memproses booking. Silakan coba lagi.');
    }
  }

  // ... (Fungsi getAllTickets & seedSeats tetap sama, biarkan di bawah sini) ...

  async getAllTickets() {
    return this.ticketRepo.find({ order: { createdAt: 'DESC' } });
  }

  async seedSeats() {
    const count = await this.seatRepo.count();
    if (count > 0) return { message: 'Gudang penuh.', total: count };

    const seatsToCreate: Seat[] = [];
    for (let i = 1; i <= 100; i++) {
      const seat = new Seat();
      seat.seatNumber = `A-${i}`;
      seat.status = 'AVAILABLE';
      seat.category = i <= 20 ? 'VIP' : 'REGULAR';
      seatsToCreate.push(seat);
    }
    await this.seatRepo.save(seatsToCreate);
    return { message: 'Sukses generate 100 kursi.', total: 100 };
  }
}
