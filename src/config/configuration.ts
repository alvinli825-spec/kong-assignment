export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    username: process.env.DB_USERNAME ?? 'kong',
    password: process.env.DB_PASSWORD ?? 'kong',
    name: process.env.DB_NAME ?? 'kong_services',
  },
  auth: {
    readerToken: process.env.API_READER_TOKEN ?? '',
    adminToken: process.env.API_ADMIN_TOKEN ?? '',
  },
});
