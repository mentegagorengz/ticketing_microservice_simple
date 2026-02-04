import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { WorkerService } from './worker.service'; // ✅ Import Service

@Controller()
export class WorkerController {
  constructor(
    // ✅ INJEKSI SERVICE (BUKAN REPOSITORY)
    private readonly workerService: WorkerService,
  ) {}

  @EventPattern('ticket_created')
  async handleTicketCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    try {
      // ✅ Delegate ke Service (yang sudah ada update inventory)
      await this.workerService.processTicket(data);

      // ACK message setelah berhasil diproses
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      channel.ack(originalMsg);
    } catch (error) {
      console.error('❌ Worker Error:', error);

      // NACK jika gagal (akan di-retry oleh RabbitMQ)
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      channel.nack(originalMsg, false, true); // Requeue
    }
  }
}
