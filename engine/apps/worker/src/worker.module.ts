import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { CommonModule, Ticket, Seat } from '@app/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([Ticket, Seat])],
  controllers: [WorkerController],
  providers: [WorkerService],
})
export class WorkerModule {}
