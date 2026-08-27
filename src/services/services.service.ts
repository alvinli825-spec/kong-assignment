import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceVersionDto } from './dto/create-service-version.dto';
import { UpdateServiceVersionDto } from './dto/update-service-version.dto';

export interface PaginatedServices {
  data: Service[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly servicesRepository: Repository<Service>,
    @InjectRepository(ServiceVersion)
    private readonly versionsRepository: Repository<ServiceVersion>,
  ) {}

  async list(query: ListServicesQueryDto): Promise<PaginatedServices> {
    const { q, page, limit, sort, order } = query;

    const qb = this.servicesRepository
      .createQueryBuilder('service')
      .loadRelationCountAndMap('service.versionCount', 'service.versions');

    if (q) {
      qb.where("(service.name ILIKE :q ESCAPE '\\' OR service.description ILIKE :q ESCAPE '\\')", {
        q: `%${escapeLikePattern(q)}%`,
      });
    }

    qb.orderBy(`service.${sort}`, order.toUpperCase() as 'ASC' | 'DESC')
      // stable tie-break so pagination never repeats or drops rows
      .addOrderBy('service.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.servicesRepository.findOne({
      where: { id },
      relations: { versions: true },
      order: { versions: { createdAt: 'DESC' } },
    });
    if (!service) {
      throw new NotFoundException(`Service ${id} not found`);
    }
    return service;
  }

  async listVersions(serviceId: string): Promise<ServiceVersion[]> {
    await this.ensureServiceExists(serviceId);
    return this.versionsRepository.find({
      where: { serviceId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const service = this.servicesRepository.create({
      name: dto.name,
      description: dto.description ?? '',
    });
    return this.servicesRepository.save(service);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.getServiceById(id);
    if (dto.name !== undefined) {
      service.name = dto.name;
    }
    if (dto.description !== undefined) {
      service.description = dto.description;
    }
    return this.servicesRepository.save(service);
  }

  async remove(id: string): Promise<void> {
    const result = await this.servicesRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Service ${id} not found`);
    }
  }

  async createVersion(serviceId: string, dto: CreateServiceVersionDto): Promise<ServiceVersion> {
    await this.ensureServiceExists(serviceId);
    const version = this.versionsRepository.create({
      serviceId,
      name: dto.name,
      description: dto.description ?? '',
    });
    return this.versionsRepository.save(version);
  }

  async updateVersion(
    serviceId: string,
    versionId: string,
    dto: UpdateServiceVersionDto,
  ): Promise<ServiceVersion> {
    const version = await this.versionsRepository.findOne({
      where: { id: versionId, serviceId },
    });
    if (!version) {
      throw new NotFoundException(`Version ${versionId} not found for service ${serviceId}`);
    }
    if (dto.name !== undefined) {
      version.name = dto.name;
    }
    if (dto.description !== undefined) {
      version.description = dto.description;
    }
    return this.versionsRepository.save(version);
  }

  async removeVersion(serviceId: string, versionId: string): Promise<void> {
    const result = await this.versionsRepository.delete({ id: versionId, serviceId });
    if (!result.affected) {
      throw new NotFoundException(`Version ${versionId} not found for service ${serviceId}`);
    }
  }

  private async getServiceById(id: string): Promise<Service> {
    const service = await this.servicesRepository.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Service ${id} not found`);
    }
    return service;
  }

  private async ensureServiceExists(id: string): Promise<void> {
    const exists = await this.servicesRepository.exists({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Service ${id} not found`);
    }
  }
}

// Escape LIKE wildcards so user input is always matched literally.
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
