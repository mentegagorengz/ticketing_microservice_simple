import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  seatNumber: string;

  @Column({ default: 'AVAILABLE' })
  status: string;

  @Column({ default: 'REGULAR' })
  category: string;
}
