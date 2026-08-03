import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat, CommonService, seatLockKey } from '@app/common';
import { Repository } from 'typeorm';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    private readonly common: CommonService,
  ) {}

  async processTicket(data: { seatId: string; userId: string }) {
    this.logger.log(
      `Processing ticket: seat ${data.seatId} for user ${data.userId}`,
    );

    // Idempotent: retry (misal crash setelah PENDING tersimpan) tidak boleh
    // membuat tiket duplikat. Reuse tiket lama yang belum sampai ISSUED.
    let savedTicket = await this.ticketRepo.findOne({
      where: { seatId: data.seatId },
    });

    if (!savedTicket || savedTicket.status === 'ISSUED') {
      // Sudah ISSUED = pesan terkirim dua kali (ack hilang). Jangan duplikat.
      if (savedTicket?.status === 'ISSUED') {
        this.logger.log(
          `Duplicate delivery skipped: ticket ${savedTicket.id} already ISSUED`,
        );
        return;
      }
      const newTicket = new Ticket();
      newTicket.seatId = data.seatId;
      newTicket.userId = data.userId;
      newTicket.status = 'PENDING';
      savedTicket = await this.ticketRepo.save(newTicket);
      this.logger.log(`Ticket ${savedTicket.id} saved as PENDING`);
    } else {
      this.logger.log(
        `Retry: reusing ticket ${savedTicket.id} (status ${savedTicket.status})`,
      );
    }

    try {
      // Seat durably BOOKED — guard utama engine hilang begitu lock dilepas.
      await this.seatRepo.update(
        { seatNumber: data.seatId },
        { status: 'BOOKED' },
      );
      await this.ticketRepo.update(savedTicket.id, { status: 'BOOKED' });
      this.logger.log(`Seat ${data.seatId} and ticket set to BOOKED`);
    } catch (error) {
      // Jangan biarkan tiket nyangkut PENDING selamanya saat seat update gagal.
      await this.ticketRepo.update(savedTicket.id, { status: 'FAILED' });
      throw error;
    } finally {
      // Seat sudah durably BOOKED (atau update gagal dan seat tidak boleh
      // terkunci penuh TTL) — apapun kondisinya, tugas lock selesai.
      // Hanya lepas kalau kita masih pemegangnya.
      await this.common.releaseLock(seatLockKey(data.seatId), data.userId);
      this.logger.log(`Lock released: seat ${data.seatId}`);
    }

    this.logger.log('Generating PDF & QR code...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.ticketRepo.update(savedTicket.id, { status: 'ISSUED' });

    this.logger.log(`Ticket ${data.seatId} finished as ISSUED`);
  }
}
