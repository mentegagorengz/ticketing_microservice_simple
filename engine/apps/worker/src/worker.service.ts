import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket, Seat } from '@app/common'; // <--- Import Seat
import { Repository, DataSource } from 'typeorm'; // Import DataSource untuk Transaction (Opsional tapi bagus)

@Injectable()
export class WorkerService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    // Inject Repository Seat:
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
  ) {}

  async processTicket(data: { seatId: string; userId: string }) {
    console.log(`\n=============================`);
    console.log(`⚡ Memproses tiket untuk User: ${data.userId}`);

    // 1. Simpan Tiket (Bukti Transaksi)
    const newTicket = new Ticket();
    newTicket.seatId = data.seatId;
    newTicket.userId = data.userId;
    newTicket.status = 'ISSUED';

    const savedTicket = await this.ticketRepo.save(newTicket);
    console.log(`💾 Data tersimpan di Postgres! ID: ${savedTicket.id}`);

    // 2. UPDATE STATUS GUDANG (PENTING!)
    // Ubah status kursi di tabel Seat menjadi 'BOOKED'
    await this.seatRepo.update(
      { seatNumber: data.seatId }, // Cari kursi berdasarkan nomor (misal: A-1)
      { status: 'BOOKED' }, // Ubah status jadi BOOKED
    );
    console.log(`🔒 Inventory Updated: Kursi ${data.seatId} status set to BOOKED`);

    // 3. Simulasi tugas berat (PDF/Email)
    console.log(`⏳ Generating PDF & QR Code...`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay 1 detik

    console.log(`✅ Tiket ${data.seatId} Selesai & Status Updated ke ISSUED!`);
    console.log(`=============================`);
  }
}
