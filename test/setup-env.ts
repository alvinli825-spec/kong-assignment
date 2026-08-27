// Force the e2e suite onto the dedicated test database so it can never
// truncate development data, and pin known auth tokens.
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5433';
process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'kong';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'kong';
process.env.DB_NAME = 'kong_services_test';
process.env.API_READER_TOKEN = 'test-reader-token';
process.env.API_ADMIN_TOKEN = 'test-admin-token';
