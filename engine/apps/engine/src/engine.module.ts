import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonModule, Ticket, Seat } from '@app/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Ticket, Seat]),

    ClientsModule.registerAsync([
      {
        name: 'TICKET_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ as const,
          options: {
            urls: [config.getOrThrow<string>('RABBITMQ_URL')],
            queue: 'ticket_queue',
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [EngineController],
  providers: [EngineService],
})
export class EngineModule {}
