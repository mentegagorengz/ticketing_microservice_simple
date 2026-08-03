import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonService } from './common.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { Seat } from './seat.entity';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // apps run from engine/, .env lives at repo root
      envFilePath: ['.env', '../.env'],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<string>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [Ticket, Seat],
        synchronize: true,
      }),
    }),

    TypeOrmModule.forFeature([Ticket, Seat]),
  ],
  providers: [CommonService],
  exports: [CommonService, TypeOrmModule],
})
export class CommonModule {}
