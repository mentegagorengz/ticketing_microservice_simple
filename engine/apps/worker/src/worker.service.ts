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

    // Idempotent: retry (misal crash setelah PENDING tersimpan) tidak boleh
    // membuat tiket duplikat. Reuse tiket lama yang belum sampai ISSUED.
    let savedTicket = await this.ticketRepo.findOne({
      where: { seatId: data.seatId },
    });

    if (!savedTicket || savedTicket.status === 'ISSUED') {
      // Sudah ISSUED = pesan terkirim dua kali (ack hilang). Jangan duplikat.
      if (savedTicket?.status === 'ISSUED') {
        console.log(`♻️ Duplikat: tiket ${savedTicket.id} sudah ISSUED. Skip.`);
        return;
      }
      const newTicket = new Ticket();
      newTicket.seatId = data.seatId;
      newTicket.userId = data.userId;
      newTicket.status = 'PENDING';
      savedTicket = await this.ticketRepo.save(newTicket);
      console.log(`💾 Tiket PENDING tersimpan! ID: ${savedTicket.id}`);
    } else {
      console.log(
        `♻️ Retry: pakai tiket lama ${savedTicket.id} (status ${savedTicket.status})`,
      );
    }

    try {
      // BOOKED — seat is now taken. Only guard the engine has once the lock drops.
      await this.seatRepo.update(
        { seatNumber: data.seatId },
        { status: 'BOOKED' },
      );
      await this.ticketRepo.update(savedTicket.id, { status: 'BOOKED' });
      console.log(`🔒 Kursi ${data.seatId} + tiket set ke BOOKED`);
    } catch (error) {
      // Jangan biarkan tiket nyangkut PENDING selamanya saat seat update gagal.
      await this.ticketRepo.update(savedTicket.id, { status: 'FAILED' });
      throw error;
    } finally {
      // Seat is durably BOOKED (or the update threw and we must not wedge the
      // seat for the full TTL) — either way the lock has done its job.
      // Hanya lepas kalau kita masih pemegangnya.
      await this.common.releaseLock(seatLockKey(data.seatId), data.userId);
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
