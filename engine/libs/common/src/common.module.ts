import { Module, Global } from '@nestjs/common';
import { CommonService } from './common.service';
import { TypeOrmModule } from '@nestjs/typeorm'; // Import TypeORM
import { Ticket } from './ticket.entity';        // Import Entity tadi
import { Seat } from './seat.entity';

@Global()
@Module({
  imports: [
    // 1. KONEKSI UTAMA KE POSTGRES
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',      // Host Docker
      port: 5434,             // Port Default Postgres
      username: 'max_admin',  // Sesuai docker-compose.yml
      password: 'secure_password', // Sesuai docker-compose.yml
      database: 'ticket_db',
      entities: [Ticket, Seat],     // Daftarkan tabel Ticket & Seat
      synchronize: true,      // AUTO-CREATE TABLE (Hanya untuk Dev, jangan di Prod)
    }),
    
    // 2. DAFTARKAN REPOSITORY AGAR BISA DIPAKAI (Inject)
    TypeOrmModule.forFeature([Ticket, Seat]),
  ],
  providers: [CommonService],
  exports: [CommonService, TypeOrmModule], // Export TypeOrmModule juga!
})
export class CommonModule {}