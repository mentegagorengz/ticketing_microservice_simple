import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // Kita buat Microservice, bukan HTTP Server biasa
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(WorkerModule, {
    transport: Transport.RMQ, // Gunakan protokol RabbitMQ
    options: {
      urls: ['amqp://guest:guest@localhost:5672'], // Koneksi ke Docker
      queue: 'ticket_queue', // Nama antrean yang harus didengarkan (Wajib sama dengan Engine)
      queueOptions: {
        durable: true, // Agar antrean tidak hilang saat restart
      },
    },
  });

  await app.listen();
  console.log('👷 Worker sedang bekerja... Menunggu pesanan tiket.');
}
bootstrap();