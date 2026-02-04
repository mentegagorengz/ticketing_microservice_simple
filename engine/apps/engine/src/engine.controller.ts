import {
  Body,
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EngineService } from './engine.service';

@Controller()
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  // Endpoint Lama (POST /book)
  @Post('book')
  async bookTicket(@Body() body: { seatId: string; userId: string }) {
    try {
      return await this.engineService.bookSeat(body.seatId, body.userId);
    } catch (error) {
      // ✅ Proper error handling
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: error.message || 'Booking gagal',
          error: 'BookingError',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  // === ENDPOINT BARU (GET /tickets) ===
  @Get('tickets')
  async getTickets() {
    const tickets = await this.engineService.getAllTickets();
    return {
      total: tickets.length,
      data: tickets,
    };
  }

  // === TOMBOL ADMIN: ISI GUDANG ===
  @Post('admin/seed')
  async seed() {
    return this.engineService.seedSeats();
  }
}
