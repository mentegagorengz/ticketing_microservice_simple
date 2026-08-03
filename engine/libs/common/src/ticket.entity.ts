import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid') // ID unik acak (contoh: a1b2-c3d4...)
  id: string;

  @Column()
  seatId: string;

  @Column()
  userId: string;

  @Column({ default: 'PENDING' })
  status: string; // PENDING -> BOOKED -> ISSUED

  @CreateDateColumn()
  createdAt: Date;
}
