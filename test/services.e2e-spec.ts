import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { dataSourceOptions } from '../src/database/data-source';
import { Service } from '../src/services/entities/service.entity';
import { ServiceVersion } from '../src/services/entities/service-version.entity';
import { configureApp } from '../src/setup-app';

const READER = { Authorization: 'Bearer test-reader-token' };
const ADMIN = { Authorization: 'Bearer test-admin-token' };

const FIXTURE_BASE = new Date('2026-01-01T00:00:00Z');
const minutesAfterBase = (minutes: number) => new Date(FIXTURE_BASE.getTime() + minutes * 60_000);

interface FixtureService {
  name: string;
  description: string;
  createdAtOffset: number;
  versions: { name: string; createdAtOffset: number }[];
}

// 16 services total; 'Sort *' entries have createdAt in reverse alphabetical
// order so name-sort and date-sort produce different sequences.
const FIXTURES: FixtureService[] = [
  { name: 'Sort A', description: 'sort fixture', createdAtOffset: 30, versions: [] },
  { name: 'Sort B', description: 'sort fixture', createdAtOffset: 20, versions: [] },
  { name: 'Sort C', description: 'sort fixture', createdAtOffset: 10, versions: [] },
  {
    name: 'Payments',
    description: 'Handles card payments and refunds',
    createdAtOffset: 1,
    versions: [
      { name: '1.0.0', createdAtOffset: 1 },
      { name: '1.1.0', createdAtOffset: 2 },
      { name: '2.0.0', createdAtOffset: 3 },
    ],
  },
  {
    name: 'Billing',
    description: 'Monthly payment collection engine',
    createdAtOffset: 2,
    versions: [{ name: '1.0.0', createdAtOffset: 1 }],
  },
  { name: '100% Uptime Monitor', description: 'SLO tracking', createdAtOffset: 3, versions: [] },
  {
    name: 'data_sync',
    description: 'ETL pipeline orchestration',
    createdAtOffset: 4,
    versions: [],
  },
  {
    name: 'dataXsync',
    description: 'decoy for wildcard search tests',
    createdAtOffset: 5,
    versions: [],
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    name: `Filler 0${i + 1}`,
    description: `Filler service number ${i + 1}`,
    createdAtOffset: 40 + i,
    versions: [],
  })),
];

describe('Services API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let http: () => request.SuperTest<request.Test>;
  const serviceIds = new Map<string, string>();

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query('TRUNCATE TABLE "service" CASCADE');

    const services = dataSource.getRepository(Service);
    const versions = dataSource.getRepository(ServiceVersion);
    for (const fixture of FIXTURES) {
      const created = await services.save(
        services.create({
          name: fixture.name,
          description: fixture.description,
          createdAt: minutesAfterBase(fixture.createdAtOffset),
          updatedAt: minutesAfterBase(fixture.createdAtOffset),
        }),
      );
      serviceIds.set(fixture.name, created.id);
      for (const version of fixture.versions) {
        await versions.save(
          versions.create({
            serviceId: created.id,
            name: version.name,
            description: `${fixture.name} ${version.name}`,
            createdAt: minutesAfterBase(version.createdAtOffset),
            updatedAt: minutesAfterBase(version.createdAtOffset),
          }),
        );
      }
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  describe('GET /v1/services', () => {
    it('returns the first page with defaults and pagination meta', async () => {
      const res = await http().get('/v1/services').set(READER).expect(200);

      expect(res.body.data).toHaveLength(10);
      expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 16, totalPages: 2 });
    });

    it('exposes name, description and versionCount for each card', async () => {
      const res = await http().get('/v1/services?q=Payments').set(READER).expect(200);

      expect(res.body.data).toHaveLength(1);
      const payments = res.body.data[0];
      expect(payments.name).toBe('Payments');
      expect(payments.description).toBe('Handles card payments and refunds');
      expect(payments.versionCount).toBe(3);
      expect(payments.id).toBe(serviceIds.get('Payments'));
    });

    it('reports zero versions for a service without any', async () => {
      const res = await http().get('/v1/services?q=Uptime').set(READER).expect(200);

      expect(res.body.data[0].versionCount).toBe(0);
    });

    it('searches name and description case-insensitively', async () => {
      const res = await http().get('/v1/services?q=PAYMENT').set(READER).expect(200);

      const names = res.body.data.map((s: any) => s.name).sort();
      expect(names).toEqual(['Billing', 'Payments']);
    });

    it('returns an empty page for a query with no matches', async () => {
      const res = await http().get('/v1/services?q=nonexistent-xyz').set(READER).expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });

    it('treats % as a literal character in searches', async () => {
      const res = await http()
        .get(`/v1/services?q=${encodeURIComponent('0%')}`)
        .set(READER);

      expect(res.status).toBe(200);
      expect(res.body.data.map((s: any) => s.name)).toEqual(['100% Uptime Monitor']);
    });

    it('treats _ as a literal character in searches', async () => {
      const res = await http()
        .get(`/v1/services?q=${encodeURIComponent('a_s')}`)
        .set(READER);

      expect(res.status).toBe(200);
      expect(res.body.data.map((s: any) => s.name)).toEqual(['data_sync']);
    });

    it('sorts by name ascending by default', async () => {
      const res = await http().get('/v1/services?q=Sort').set(READER).expect(200);

      expect(res.body.data.map((s: any) => s.name)).toEqual(['Sort A', 'Sort B', 'Sort C']);
    });

    it('sorts by name descending', async () => {
      const res = await http().get('/v1/services?q=Sort&order=desc').set(READER).expect(200);

      expect(res.body.data.map((s: any) => s.name)).toEqual(['Sort C', 'Sort B', 'Sort A']);
    });

    it('sorts by createdAt ascending', async () => {
      const res = await http()
        .get('/v1/services?q=Sort&sort=createdAt&order=asc')
        .set(READER)
        .expect(200);

      expect(res.body.data.map((s: any) => s.name)).toEqual(['Sort C', 'Sort B', 'Sort A']);
    });

    it('accepts an uppercase order value', async () => {
      await http().get('/v1/services?q=Sort&order=DESC').set(READER).expect(200);
    });

    it('paginates without dropping or repeating rows', async () => {
      const seen = new Set<string>();
      for (let page = 1; page <= 4; page++) {
        const res = await http().get(`/v1/services?limit=5&page=${page}`).set(READER).expect(200);
        expect(res.body.meta).toEqual({ page, limit: 5, total: 16, totalPages: 4 });
        for (const service of res.body.data) {
          expect(seen.has(service.id)).toBe(false);
          seen.add(service.id);
        }
      }
      expect(seen.size).toBe(16);
    });

    it('returns an empty page past the end', async () => {
      const res = await http().get('/v1/services?limit=10&page=99').set(READER).expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(16);
    });

    it.each([
      'page=0',
      'page=-1',
      'page=abc',
      'page=1.5',
      'limit=0',
      'limit=101',
      'limit=abc',
      'sort=bogus',
      'order=sideways',
      `q=${'x'.repeat(256)}`,
    ])('rejects invalid query %s with 400', (queryString) => {
      return http().get(`/v1/services?${queryString}`).set(READER).expect(400);
    });
  });

  describe('GET /v1/services/:id', () => {
    it('returns the service with versions newest first', async () => {
      const res = await http()
        .get(`/v1/services/${serviceIds.get('Payments')}`)
        .set(READER)
        .expect(200);

      expect(res.body.name).toBe('Payments');
      expect(res.body.versions.map((v: any) => v.name)).toEqual(['2.0.0', '1.1.0', '1.0.0']);
    });

    it('returns an empty versions array for a service without versions', async () => {
      const res = await http()
        .get(`/v1/services/${serviceIds.get('100% Uptime Monitor')}`)
        .set(READER)
        .expect(200);

      expect(res.body.versions).toEqual([]);
    });

    it('rejects a malformed uuid with 400', () => {
      return http().get('/v1/services/not-a-uuid').set(READER).expect(400);
    });

    it('returns 404 for an unknown uuid', () => {
      return http()
        .get('/v1/services/00000000-0000-4000-8000-000000000000')
        .set(READER)
        .expect(404);
    });
  });

  describe('GET /v1/services/:id/versions', () => {
    it('returns versions newest first', async () => {
      const res = await http()
        .get(`/v1/services/${serviceIds.get('Payments')}/versions`)
        .set(READER)
        .expect(200);

      expect(res.body.map((v: any) => v.name)).toEqual(['2.0.0', '1.1.0', '1.0.0']);
    });

    it('returns an empty array for a service without versions', async () => {
      const res = await http()
        .get(`/v1/services/${serviceIds.get('data_sync')}/versions`)
        .set(READER)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns 404 when the service does not exist', () => {
      return http()
        .get('/v1/services/00000000-0000-4000-8000-000000000000/versions')
        .set(READER)
        .expect(404);
    });
  });

  describe('authorization', () => {
    it('forbids mutations with a reader token', async () => {
      await http().post('/v1/services').set(READER).send({ name: 'Nope' }).expect(403);
      await http()
        .patch(`/v1/services/${serviceIds.get('Payments')}`)
        .set(READER)
        .send({ name: 'Nope' })
        .expect(403);
      await http()
        .delete(`/v1/services/${serviceIds.get('Payments')}`)
        .set(READER)
        .expect(403);
    });

    it('allows reads with an admin token', () => {
      return http().get('/v1/services').set(ADMIN).expect(200);
    });
  });

  describe('CRUD lifecycle (admin)', () => {
    it('creates, reads, updates and deletes a service with its versions', async () => {
      const created = await http()
        .post('/v1/services')
        .set(ADMIN)
        .send({ name: '  Ledger  ', description: 'Double-entry bookkeeping' })
        .expect(201);
      const serviceId = created.body.id;
      expect(created.body.name).toBe('Ledger');

      const version = await http()
        .post(`/v1/services/${serviceId}/versions`)
        .set(ADMIN)
        .send({ name: '0.1.0' })
        .expect(201);
      expect(version.body.serviceId).toBe(serviceId);
      expect(version.body.description).toBe('');

      const patched = await http()
        .patch(`/v1/services/${serviceId}`)
        .set(ADMIN)
        .send({ description: 'General ledger service' })
        .expect(200);
      expect(patched.body.name).toBe('Ledger');
      expect(patched.body.description).toBe('General ledger service');

      const patchedVersion = await http()
        .patch(`/v1/services/${serviceId}/versions/${version.body.id}`)
        .set(ADMIN)
        .send({ description: 'First cut' })
        .expect(200);
      expect(patchedVersion.body.name).toBe('0.1.0');
      expect(patchedVersion.body.description).toBe('First cut');

      const detail = await http().get(`/v1/services/${serviceId}`).set(READER).expect(200);
      expect(detail.body.versions).toHaveLength(1);

      await http()
        .delete(`/v1/services/${serviceId}/versions/${version.body.id}`)
        .set(ADMIN)
        .expect(204);
      await http().delete(`/v1/services/${serviceId}`).set(ADMIN).expect(204);
      await http().get(`/v1/services/${serviceId}`).set(READER).expect(404);
    });

    it('deleting a service cascades to its versions', async () => {
      const created = await http()
        .post('/v1/services')
        .set(ADMIN)
        .send({ name: 'Cascade Target' })
        .expect(201);
      await http()
        .post(`/v1/services/${created.body.id}/versions`)
        .set(ADMIN)
        .send({ name: '1.0.0' })
        .expect(201);

      await http().delete(`/v1/services/${created.body.id}`).set(ADMIN).expect(204);

      const orphans = await dataSource.query(
        'SELECT count(*)::int AS count FROM "service_version" WHERE "service_id" = $1',
        [created.body.id],
      );
      expect(orphans[0].count).toBe(0);
    });

    it('returns 404 when adding a version to a missing service', () => {
      return http()
        .post('/v1/services/00000000-0000-4000-8000-000000000000/versions')
        .set(ADMIN)
        .send({ name: '1.0.0' })
        .expect(404);
    });

    it('returns 404 when updating a version through the wrong service', async () => {
      const versionId = (
        await http()
          .get(`/v1/services/${serviceIds.get('Payments')}/versions`)
          .set(READER)
      ).body[0].id;

      return http()
        .patch(`/v1/services/${serviceIds.get('Billing')}/versions/${versionId}`)
        .set(ADMIN)
        .send({ name: '9.9.9' })
        .expect(404);
    });

    it('rejects a service without a name', () => {
      return http().post('/v1/services').set(ADMIN).send({ description: 'no name' }).expect(400);
    });

    it('rejects a blank name', () => {
      return http().post('/v1/services').set(ADMIN).send({ name: '   ' }).expect(400);
    });

    it('strips unknown fields from the payload', async () => {
      const res = await http()
        .post('/v1/services')
        .set(ADMIN)
        .send({ name: 'Strict', bogus: 'field' })
        .expect(201);

      expect(res.body).not.toHaveProperty('bogus');
      await http().delete(`/v1/services/${res.body.id}`).set(ADMIN).expect(204);
    });

    it('updates a mutation only through PATCH, leaving other fields intact', async () => {
      const created = await http()
        .post('/v1/services')
        .set(ADMIN)
        .send({ name: 'Patch Me', description: 'original' })
        .expect(201);

      const patched = await http()
        .patch(`/v1/services/${created.body.id}`)
        .set(ADMIN)
        .send({ name: 'Patched' })
        .expect(200);
      expect(patched.body.description).toBe('original');

      await http().delete(`/v1/services/${created.body.id}`).set(ADMIN).expect(204);
    });
  });
});
