import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';

describe('WorkerController', () => {
  let controller: WorkerController;
  const service = { processTicket: jest.fn() };

  const makeContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const originalMsg = { content: Buffer.from('{"seatId":"A-1"}') };
    return {
      channel,
      originalMsg,
      context: {
        getChannelRef: () => channel,
        getMessage: () => originalMsg,
      } as unknown as RmqContext,
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerController],
      providers: [{ provide: WorkerService, useValue: service }],
    }).compile();

    controller = app.get<WorkerController>(WorkerController);
  });

  it('sukses -> ack', async () => {
    service.processTicket.mockResolvedValue(undefined);
    const { channel, originalMsg, context } = makeContext();
    await controller.handleTicketCreated({ seatId: 'A-1' }, context);
    expect(channel.ack).toHaveBeenCalledWith(originalMsg);
  });

  it('error 3x berturut-turut -> nack tanpa requeue (drop)', async () => {
    service.processTicket.mockRejectedValue(new Error('db down'));
    for (let i = 0; i < 3; i++) {
      const { channel, originalMsg, context } = makeContext();
      await controller.handleTicketCreated({ seatId: 'A-1' }, context);
      expect(channel.nack).toHaveBeenCalledWith(originalMsg, false, i < 2);
    }
  });
});
