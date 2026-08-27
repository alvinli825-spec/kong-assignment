import { Test } from '@nestjs/testing';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

describe('ServicesController', () => {
  let controller: ServicesController;
  const servicesService = {
    list: jest.fn(),
    findOne: jest.fn(),
    listVersions: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createVersion: jest.fn(),
    updateVersion: jest.fn(),
    removeVersion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: ServicesService, useValue: servicesService }],
    }).compile();

    controller = moduleRef.get(ServicesController);
  });

  it('delegates list with the parsed query', () => {
    const query = { page: 2 } as any;
    controller.list(query);
    expect(servicesService.list).toHaveBeenCalledWith(query);
  });

  it('delegates findOne', () => {
    controller.findOne('svc-1');
    expect(servicesService.findOne).toHaveBeenCalledWith('svc-1');
  });

  it('delegates listVersions', () => {
    controller.listVersions('svc-1');
    expect(servicesService.listVersions).toHaveBeenCalledWith('svc-1');
  });

  it('delegates create/update/remove', () => {
    controller.create({ name: 'A' });
    controller.update('svc-1', { name: 'B' });
    controller.remove('svc-1');
    expect(servicesService.create).toHaveBeenCalledWith({ name: 'A' });
    expect(servicesService.update).toHaveBeenCalledWith('svc-1', { name: 'B' });
    expect(servicesService.remove).toHaveBeenCalledWith('svc-1');
  });

  it('delegates version create/update/remove scoped to the service', () => {
    controller.createVersion('svc-1', { name: '1.0.0' });
    controller.updateVersion('svc-1', 'ver-1', { name: '1.1.0' });
    controller.removeVersion('svc-1', 'ver-1');
    expect(servicesService.createVersion).toHaveBeenCalledWith('svc-1', { name: '1.0.0' });
    expect(servicesService.updateVersion).toHaveBeenCalledWith('svc-1', 'ver-1', {
      name: '1.1.0',
    });
    expect(servicesService.removeVersion).toHaveBeenCalledWith('svc-1', 'ver-1');
  });
});
