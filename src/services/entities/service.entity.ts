import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceVersion } from './service-version.entity';

@Entity('service')
export class Service {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Payments' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ example: 'Processes card payments and refunds.' })
  @Column({ type: 'text', default: '' })
  description: string;

  @OneToMany(() => ServiceVersion, (version) => version.service)
  versions: ServiceVersion[];

  // Populated by loadRelationCountAndMap on list queries; not a column.
  @ApiProperty({ example: 3, required: false })
  versionCount?: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
