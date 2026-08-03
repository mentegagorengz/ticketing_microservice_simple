import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat, CommonService, seatLockKey } from '@app/common';
import { Repository } from 'typeorm';

// Safety net: worker yang mati sebelum release tidak mengunci kursi selamanya.
const LOCK_TTL_SECONDS = 600;

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    @Inject('TICKET_SERVICE') private readonly client: ClientProxy,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    private readonly common: CommonService,
  ) {}

  async bookSeat(seatId: string, userId: string) {
    this.logger.log(`Booking request: seat ${seatId} by ${userId}`);

    const seat = await this.seatRepo.findOne({
      where: { seatNumber: seatId },
    });

    if (!seat) {
      this.logger.warn(`Rejected: seat ${seatId} not found`);
      throw new Error(`Kursi ${seatId} tidak valid.`);
    }

    if (seat.status !== 'AVAILABLE') {
      this.logger.warn(`Rejected: seat ${seatId} already ${seat.status}`);
      throw new Error(`Kursi ${seatId} sudah terjual.`);
    }

    const redisKey = seatLockKey(seatId);

    const isLocked = await this.common.acquireLock(
      redisKey,
      userId,
      LOCK_TTL_SECONDS,
    );

    if (!isLocked) {
      this.logger.warn(
        `Rejected: seat ${seatId} locked by another booking in progress`,
      );
      throw new Error(
        'Kursi sedang dalam proses pemesanan orang lain. Coba lagi.',
      );
    }

    this.logger.log(`Lock acquired: seat ${seatId} for ${userId}`);

    try {
      await this.client.emit('ticket_created', { seatId, userId }).toPromise();

      this.logger.log(`Event ticket_created published for seat ${seatId}`);

      // Lock sengaja dipertahankan di sini — worker yang melepas setelah seat
      // tersimpan durable ke BOOKED. Release di sini membuka celah double-booking.
      return {
        message: 'Booking sedang diproses',
        seatId,
        userId,
      };
    } catch (error) {
      // Emit gagal, tidak akan ada worker yang melepas lock.
      await this.common.releaseLock(redisKey, userId);
      this.logger.log(`Lock released after emit failure: seat ${seatId}`);
      this.logger.error('Failed to publish ticket_created:', error);
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
