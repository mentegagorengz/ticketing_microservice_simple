import 'reflect-metadata';
// Transport options are needed before Nest boots, so ConfigService isn't
// available yet — load .env by hand first.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: ['.env', '../.env'] });

import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is not set (see .env.example)');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'ticket_queue',
        noAck: false, // manual ack/nack di controller; kalau tidak, ack() di
        // controller tidak berefek dan pesan tak pernah di-retry.
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
  console.log('Worker listening for ticket_created events.');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
