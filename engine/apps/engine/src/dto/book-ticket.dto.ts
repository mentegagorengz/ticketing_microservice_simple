import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BookTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  seatId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  userId: string;
}
