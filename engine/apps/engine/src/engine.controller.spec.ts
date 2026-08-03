import { Test, TestingModule } from '@nestjs/testing';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { HttpException } from '@nestjs/common';

describe('EngineController', () => {
  let controller: EngineController;
  const service = {
    bookSeat: jest.fn(),
    getAllTickets: jest.fn(),
    seedSeats: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EngineController],
      providers: [{ provide: EngineService, useValue: service }],
    }).compile();

    controller = app.get<EngineController>(EngineController);
  });

  it('POST /book meneruskan seatId+userId ke service', async () => {
    service.bookSeat.mockResolvedValue({ message: 'ok' });
    const result = await controller.bookTicket({
      seatId: 'A-1',
      userId: 'user-1',
    });
    expect(service.bookSeat).toHaveBeenCalledWith('A-1', 'user-1');
    expect(result).toEqual({ message: 'ok' });
  });

  it('POST /book gagal -> HttpException 409', async () => {
    service.bookSeat.mockRejectedValue(new Error('Kursi A-1 sudah terjual.'));
    await expect(
      controller.bookTicket({ seatId: 'A-1', userId: 'user-1' }),
    ).rejects.toThrow(HttpException);
  });

  it('GET /tickets return total + data', async () => {
    service.getAllTickets.mockResolvedValue([{ id: '1' }]);
    await expect(controller.getTickets()).resolves.toEqual({
      total: 1,
      data: [{ id: '1' }],
    });
  });
});
