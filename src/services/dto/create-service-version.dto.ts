import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateServiceVersionDto {
  @ApiProperty({ maxLength: 100, example: '1.2.0' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ maxLength: 5000, example: 'Adds idempotency keys.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
