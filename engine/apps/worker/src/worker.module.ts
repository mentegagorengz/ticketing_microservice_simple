import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { CommonModule, Ticket, Seat } from '@app/common'; // <--- Import Seat
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    CommonModule,
    // Tambahkan Seat di sini agar Worker bisa mengubah data kursi:
    TypeOrmModule.forFeature([Ticket, Seat]),
  ],
  controllers: [WorkerController],
  providers: [WorkerService],
})
export class WorkerModule {}
