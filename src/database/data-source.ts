import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Service } from '../services/entities/service.entity';
import { ServiceVersion } from '../services/entities/service-version.entity';

config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USERNAME ?? 'kong',
  password: process.env.DB_PASSWORD ?? 'kong',
  database: process.env.DB_NAME ?? 'kong_services',
  entities: [Service, ServiceVersion],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
