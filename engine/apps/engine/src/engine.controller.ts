import {
  Body,
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EngineService } from './engine.service';
import { BookTicketDto } from './dto/book-ticket.dto';

@Controller()
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  @Post('book')
  async bookTicket(@Body() body: BookTicketDto) {
    try {
      return await this.engineService.bookSeat(body.seatId, body.userId);
    } catch (error) {
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

  @Get('tickets')
  async getTickets() {
    const tickets = await this.engineService.getAllTickets();
    return {
      total: tickets.length,
      data: tickets,
    };
  }

  @Post('admin/seed')
  async seed() {
    return this.engineService.seedSeats();
  }
}
