import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ maxLength: 255, example: 'Payments' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ maxLength: 5000, example: 'Processes card payments and refunds.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
