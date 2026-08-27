import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { dataSourceOptions } from '../src/database/data-source';
import { configureApp } from '../src/setup-app';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const migrator = new DataSource(dataSourceOptions);
    await migrator.initialize();
    await migrator.runMigrations();
    await migrator.destroy();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('GET /v1/services requires authentication', () => {
    return request(app.getHttpServer()).get('/v1/services').expect(401);
  });

  it('rejects an invalid token', () => {
    return request(app.getHttpServer())
      .get('/v1/services')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);
  });
});
