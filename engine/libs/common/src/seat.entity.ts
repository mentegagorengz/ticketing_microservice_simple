import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nama Kursi (Misal: "A1", "VIP-1")
  // Kita set UNIQUE agar tidak ada dua kursi bernama "A1"
  @Column({ unique: true })
  seatNumber: string;

  // Status Kursi: 'AVAILABLE' atau 'BOOKED'
  @Column({ default: 'AVAILABLE' })
  status: string;

  // Kategori: 'VIP' atau 'REGULAR' (Opsional, buat filter nanti)
  @Column({ default: 'REGULAR' })
  category: string;
}