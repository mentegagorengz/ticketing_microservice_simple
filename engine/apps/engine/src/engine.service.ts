import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat, CommonService, seatLockKey } from '@app/common';
import { Repository } from 'typeorm';

/** Lock TTL — safety net if the worker dies before releasing. */
const LOCK_TTL_SECONDS = 600;

@Injectable()
export class EngineService {
  constructor(
    @Inject('TICKET_SERVICE') private readonly client: ClientProxy,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    private readonly common: CommonService,
  ) {}

  async bookSeat(seatId: string, userId: string) {
    console.log(`\n🎫 Request Booking: ${seatId} oleh ${userId}`);

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

    const redisKey = seatLockKey(seatId);

    const isLocked = await this.common.acquireLock(
      redisKey,
      userId,
      LOCK_TTL_SECONDS,
    );

    if (!isLocked) {
      console.log(
        `🛡️ BLOKIR REDIS: Kursi ${seatId} sedang diproses orang lain.`,
      );
      throw new Error(
        'Kursi sedang dalam proses pemesanan orang lain. Coba lagi.',
      );
    }

    console.log(`✅ KUNCI REDIS: Berhasil mengunci ${seatId} untuk ${userId}`);

    try {
      await this.client.emit('ticket_created', { seatId, userId }).toPromise();

      console.log(`📤 Event terkirim ke Worker untuk ${seatId}`);

      // Lock stays held on purpose — the worker releases it once the seat is
      // durably BOOKED. Releasing here would reopen the double-booking window.
      return {
        message: 'Booking sedang diproses',
        seatId,
        userId,
      };
    } catch (error) {
      // Emit failed, so no worker will ever release it.
      await this.common.releaseLock(redisKey, userId);
      console.log(
        `🔓 UNLOCK REDIS (ERROR): Kunci ${seatId} dilepas karena error.`,
      );

      console.error(`❌ Gagal kirim event ke Worker:`, error);
      throw new Error('Gagal memproses booking. Silakan coba lagi.');
    }
  }

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
