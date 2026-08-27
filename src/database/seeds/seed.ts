import dataSource from '../data-source';
import { Service } from '../../services/entities/service.entity';
import { ServiceVersion } from '../../services/entities/service-version.entity';

interface SeedVersion {
  name: string;
  description: string;
}

interface SeedService {
  name: string;
  description: string;
  versions: SeedVersion[];
}

const CATALOG: SeedService[] = [
  {
    name: 'Payments',
    description: 'Processes card payments, payouts and refunds for the organization.',
    versions: [
      { name: '1.0.0', description: 'Initial release with card charges.' },
      { name: '1.1.0', description: 'Adds refunds endpoint.' },
      { name: '2.0.0', description: 'Adds idempotency keys and 3DS support.' },
    ],
  },
  {
    name: 'Notifications',
    description: 'Sends email, SMS and push notifications to customers.',
    versions: [
      { name: '0.9.0', description: 'Beta rollout.' },
      { name: '1.0.0', description: 'General availability.' },
    ],
  },
  {
    name: 'Contact Us',
    description: 'Handles inbound support requests and routes them to the right team.',
    versions: [{ name: '1.0.0', description: 'Initial release.' }],
  },
  {
    name: 'Locate Us',
    description: 'Branch and ATM location lookup with geo search.',
    versions: [
      { name: '1.0.0', description: 'Initial release.' },
      { name: '1.1.0', description: 'Adds opening-hours data.' },
      { name: '1.2.0', description: 'Adds accessibility attributes.' },
      { name: '2.0.0', description: 'Switches to PostGIS-backed geo search.' },
    ],
  },
  {
    name: 'Collect Money',
    description: 'Payment request links and invoicing for small merchants.',
    versions: [
      { name: '1.0.0', description: 'Initial release.' },
      { name: '1.5.0', description: 'Adds recurring collection schedules.' },
    ],
  },
  {
    name: 'FX International',
    description: 'Foreign exchange rates and international transfer quotes.',
    versions: [
      { name: '1.0.0', description: 'Initial release.' },
      { name: '1.1.0', description: 'Adds forward rate quotes.' },
      { name: '1.2.0', description: 'Adds mid-market rate endpoint.' },
      { name: '1.3.0', description: 'Adds rate alerts.' },
      { name: '2.0.0', description: 'Streaming rates over websockets.' },
      { name: '2.1.0', description: 'Adds exotic currency pairs.' },
    ],
  },
  {
    name: 'Priority Services',
    description: 'Premium support entitlements and SLA tracking.',
    versions: [{ name: '1.0.0', description: 'Initial release.' }],
  },
  {
    name: 'Reporting',
    description: 'Scheduled and ad-hoc report generation across business units.',
    versions: [
      { name: '1.0.0', description: 'Initial release.' },
      { name: '2.0.0', description: 'Adds async export jobs.' },
    ],
  },
  {
    name: 'Security Center',
    description: 'Fraud monitoring, device management and account security controls.',
    versions: [
      { name: '1.0.0', description: 'Initial release.' },
      { name: '1.1.0', description: 'Adds device fingerprinting.' },
      { name: '1.2.0', description: 'Adds anomaly detection rules.' },
    ],
  },
  {
    name: 'Statements',
    description: 'Generates and archives monthly account statements.',
    versions: [
      { name: '1.0.0', description: 'Initial release.' },
      { name: '1.1.0', description: 'Adds PDF/A archival format.' },
    ],
  },
  {
    name: 'Identity',
    description: 'Customer identity verification and KYC orchestration.',
    // Recently announced service, no versions shipped yet.
    versions: [],
  },
  {
    name: 'Audit Trail',
    description: 'Immutable audit log of user and system actions.',
    versions: [{ name: '0.1.0', description: 'Early preview.' }],
  },
];

async function run() {
  await dataSource.initialize();
  await dataSource.transaction(async (manager) => {
    await manager.query('TRUNCATE TABLE "service" CASCADE');
    for (const entry of CATALOG) {
      const service = await manager.save(
        manager.create(Service, { name: entry.name, description: entry.description }),
      );
      for (const version of entry.versions) {
        await manager.save(
          manager.create(ServiceVersion, {
            serviceId: service.id,
            name: version.name,
            description: version.description,
          }),
        );
      }
    }
  });
  const count = await dataSource.getRepository(Service).count();
  console.log(`Seeded ${count} services`);
  await dataSource.destroy();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
