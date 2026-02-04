import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommonModule, Ticket, Seat } from '@app/common'; // <--- Import Seat
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    CommonModule,
    // Tambahkan Seat di sini:
    TypeOrmModule.forFeature([Ticket, Seat]),

    // Konfigurasi RabbitMQ (yang sudah ada)
    ClientsModule.register([
      {
        name: 'TICKET_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'ticket_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [EngineController],
  providers: [EngineService],
})
export class EngineModule {}
