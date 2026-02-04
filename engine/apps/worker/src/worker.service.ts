import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat } from '@app/common';
import { Repository } from 'typeorm';

@Injectable()
export class WorkerService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
  ) {}

  async processTicket(data: { seatId: string; userId: string }) {
    console.log(`\n=============================`);
    console.log(`⚡ Memproses tiket untuk User: ${data.userId}`);

    const newTicket = new Ticket();
    newTicket.seatId = data.seatId;
    newTicket.userId = data.userId;
    newTicket.status = 'ISSUED';

    const savedTicket = await this.ticketRepo.save(newTicket);
    console.log(`💾 Data tersimpan di Postgres! ID: ${savedTicket.id}`);

    await this.seatRepo.update(
      { seatNumber: data.seatId },
      { status: 'BOOKED' },
    );
    console.log(
      `🔒 Inventory Updated: Kursi ${data.seatId} status set to BOOKED`,
    );

    console.log(`⏳ Generating PDF & QR Code...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`✅ Tiket ${data.seatId} Selesai & Status Updated ke ISSUED!`);
    console.log(`=============================`);
  }
}
