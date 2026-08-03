import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { WorkerService } from './worker.service';

const MAX_ATTEMPTS = 3;

@Controller()
export class WorkerController {
  private readonly logger = new Logger(WorkerController.name);

  // Key = isi pesan (seatId+userId) — cukup unik per job untuk hitung retry.
  private readonly attempts = new Map<string, number>();

  constructor(private readonly workerService: WorkerService) {}

  @EventPattern('ticket_created')
  async handleTicketCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const key = Buffer.from(originalMsg.content).toString();

    try {
      await this.workerService.processTicket(data);
      this.attempts.delete(key);
      channel.ack(originalMsg);
    } catch (error) {
      const count = (this.attempts.get(key) ?? 0) + 1;
      const shouldRetry = count < MAX_ATTEMPTS;
      this.attempts.set(key, count);

      if (shouldRetry) {
        // Requeue: antre lagi, mungkin transient (DB down dll).
        channel.nack(originalMsg, false, true);
        this.logger.error(
          `Processing failed, retrying ${count}/${MAX_ATTEMPTS}:`,
          error,
        );
      } else {
        // Menyerah: drop, jangan requeue — poison message looping tanpa batas
        // itu hang selamanya. Tiket sudah ditandai FAILED di DB oleh service.
        // Ceiling: pesan tidak masuk DLQ, tidak ada backoff eksponensial.
        // Upgrade: dead-letter-exchange + retry delay (RabbitMQ delayed
        // message plugin) + dashboard DLQ manual.
        this.attempts.delete(key);
        channel.nack(originalMsg, false, false);
        this.logger.error(
          'Processing failed permanently, message dropped:',
          error,
        );
      }
    }
  }
}
