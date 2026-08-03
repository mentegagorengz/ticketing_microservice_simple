import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat, CommonService, seatLockKey } from '@app/common';
import { Repository } from 'typeorm';

@Injectable()
export class WorkerService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    private readonly common: CommonService,
  ) {}

  async processTicket(data: { seatId: string; userId: string }) {
    console.log(`\n=============================`);
    console.log(`⚡ Memproses tiket untuk User: ${data.userId}`);

    // PENDING — claimed, nothing durable yet.
    const newTicket = new Ticket();
    newTicket.seatId = data.seatId;
    newTicket.userId = data.userId;
    newTicket.status = 'PENDING';

    const savedTicket = await this.ticketRepo.save(newTicket);
    console.log(`💾 Tiket PENDING tersimpan! ID: ${savedTicket.id}`);

    try {
      // BOOKED — seat is now taken. Only guard the engine has once the lock drops.
      await this.seatRepo.update(
        { seatNumber: data.seatId },
        { status: 'BOOKED' },
      );
      await this.ticketRepo.update(savedTicket.id, { status: 'BOOKED' });
      console.log(`🔒 Kursi ${data.seatId} + tiket set ke BOOKED`);
    } finally {
      // Seat is durably BOOKED (or the update threw and we must not wedge the
      // seat for the full TTL) — either way the lock has done its job.
      await this.common.releaseLock(seatLockKey(data.seatId));
      console.log(`🔓 UNLOCK REDIS: Kunci ${data.seatId} dilepas.`);
    }

    console.log(`⏳ Generating PDF & QR Code...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ISSUED — fulfilment done.
    await this.ticketRepo.update(savedTicket.id, { status: 'ISSUED' });

    console.log(`✅ Tiket ${data.seatId} Selesai & Status Updated ke ISSUED!`);
    console.log(`=============================`);
  }
}
