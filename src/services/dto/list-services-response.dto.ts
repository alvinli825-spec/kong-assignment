import { ApiProperty } from '@nestjs/swagger';
import { Service } from '../entities/service.entity';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class ListServicesResponseDto {
  @ApiProperty({ type: [Service] })
  data: Service[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
