import { Module, Global } from '@nestjs/common';
import { CommonService } from './common.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { Seat } from './seat.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5434,
      username: 'max_admin',
      password: 'secure_password',
      database: 'ticket_db',
      entities: [Ticket, Seat],
      synchronize: true,
    }),

    TypeOrmModule.forFeature([Ticket, Seat]),
  ],
  providers: [CommonService],
  exports: [CommonService, TypeOrmModule],
})
export class CommonModule {}
