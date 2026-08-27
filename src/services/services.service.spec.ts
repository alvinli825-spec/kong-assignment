import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';
import { escapeLikePattern, ServicesService } from './services.service';
import { ListServicesQueryDto, ServiceSortField, SortOrder } from './dto/list-services-query.dto';

const buildQuery = (overrides: Partial<ListServicesQueryDto> = {}) =>
  Object.assign(new ListServicesQueryDto(), overrides);

describe('ServicesService', () => {
  let service: ServicesService;
  let queryBuilder: Record<string, jest.Mock>;
  let servicesRepository: Record<string, jest.Mock>;
  let versionsRepository: Record<string, jest.Mock>;

  beforeEach(async () => {
    queryBuilder = {
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    servicesRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
      exists: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve({ id: 'svc-1', ...input })),
      delete: jest.fn(),
    };
    versionsRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve({ id: 'ver-1', ...input })),
      delete: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: getRepositoryToken(Service), useValue: servicesRepository },
        { provide: getRepositoryToken(ServiceVersion), useValue: versionsRepository },
      ],
    }).compile();

    service = moduleRef.get(ServicesService);
  });

  describe('list', () => {
    it('applies defaults: no filter, sorted by name asc, first page of 10', async () => {
      await service.list(buildQuery());

      expect(queryBuilder.where).not.toHaveBeenCalled();
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('service.name', 'ASC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('service.id', 'ASC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('maps the version count onto each service', async () => {
      await service.list(buildQuery());

      expect(queryBuilder.loadRelationCountAndMap).toHaveBeenCalledWith(
        'service.versionCount',
        'service.versions',
      );
    });

    it('filters on name and description with an escaped ILIKE pattern', async () => {
      await service.list(buildQuery({ q: 'pay' }));

      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('service.name ILIKE :q'),
        { q: '%pay%' },
      );
      expect(queryBuilder.where.mock.calls[0][0]).toContain('service.description ILIKE :q');
    });

    it('escapes LIKE wildcards in the search term', async () => {
      await service.list(buildQuery({ q: '50%_\\' }));

      expect(queryBuilder.where).toHaveBeenCalledWith(expect.any(String), {
        q: '%50\\%\\_\\\\%',
      });
    });

    it('applies the requested sort field and order', async () => {
      await service.list(buildQuery({ sort: ServiceSortField.CREATED_AT, order: SortOrder.DESC }));

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('service.createdAt', 'DESC');
    });

    it('paginates with skip/take', async () => {
      await service.list(buildQuery({ page: 3, limit: 5 }));

      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('computes pagination meta', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 11]);

      const result = await service.list(buildQuery({ page: 2, limit: 5 }));

      expect(result.meta).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
    });

    it('returns zero total pages for an empty result', async () => {
      const result = await service.list(buildQuery());

      expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });
  });

  describe('findOne', () => {
    it('returns the service with versions ordered newest first', async () => {
      const found = { id: 'svc-1', versions: [] };
      servicesRepository.findOne.mockResolvedValue(found);

      await expect(service.findOne('svc-1')).resolves.toBe(found);
      expect(servicesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        relations: { versions: true },
        order: { versions: { createdAt: 'DESC' } },
      });
    });

    it('throws NotFound for an unknown id', async () => {
      servicesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listVersions', () => {
    it('throws NotFound when the service does not exist', async () => {
      servicesRepository.exists.mockResolvedValue(false);

      await expect(service.listVersions('missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(versionsRepository.find).not.toHaveBeenCalled();
    });

    it('returns versions newest first', async () => {
      servicesRepository.exists.mockResolvedValue(true);
      const versions = [{ id: 'ver-1' }];
      versionsRepository.find.mockResolvedValue(versions);

      await expect(service.listVersions('svc-1')).resolves.toBe(versions);
      expect(versionsRepository.find).toHaveBeenCalledWith({
        where: { serviceId: 'svc-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('create', () => {
    it('defaults description to an empty string', async () => {
      await service.create({ name: 'Payments' });

      expect(servicesRepository.create).toHaveBeenCalledWith({
        name: 'Payments',
        description: '',
      });
    });
  });

  describe('update', () => {
    it('only overwrites fields present in the dto', async () => {
      servicesRepository.findOne.mockResolvedValue({
        id: 'svc-1',
        name: 'Old',
        description: 'Keep me',
      });

      await service.update('svc-1', { name: 'New' });

      expect(servicesRepository.save).toHaveBeenCalledWith({
        id: 'svc-1',
        name: 'New',
        description: 'Keep me',
      });
    });

    it('throws NotFound for an unknown id', async () => {
      servicesRepository.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'New' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('throws NotFound when nothing was deleted', async () => {
      servicesRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves when the service was deleted', async () => {
      servicesRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove('svc-1')).resolves.toBeUndefined();
    });
  });

  describe('version CRUD', () => {
    it('rejects creating a version for a missing service', async () => {
      servicesRepository.exists.mockResolvedValue(false);

      await expect(service.createVersion('missing', { name: '1.0.0' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates a version scoped to the service', async () => {
      servicesRepository.exists.mockResolvedValue(true);

      await service.createVersion('svc-1', { name: '1.0.0' });

      expect(versionsRepository.create).toHaveBeenCalledWith({
        serviceId: 'svc-1',
        name: '1.0.0',
        description: '',
      });
    });

    it('rejects updating a version that belongs to another service', async () => {
      versionsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateVersion('svc-1', 'ver-other', { name: '2.0.0' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(versionsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ver-other', serviceId: 'svc-1' },
      });
    });

    it('rejects deleting a version that does not match the service', async () => {
      versionsRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.removeVersion('svc-1', 'ver-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(versionsRepository.delete).toHaveBeenCalledWith({
        id: 'ver-other',
        serviceId: 'svc-1',
      });
    });
  });
});

describe('escapeLikePattern', () => {
  it.each([
    ['plain', 'plain'],
    ['50%', '50\\%'],
    ['a_b', 'a\\_b'],
    ['back\\slash', 'back\\\\slash'],
    ['%_\\', '\\%\\_\\\\'],
  ])('escapes %p to %p', (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });
});
