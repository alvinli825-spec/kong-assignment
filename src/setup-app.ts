import { INestApplication, ValidationPipe } from '@nestjs/common';

// Shared between main.ts and the e2e suite so both run the exact same app setup.
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  return app;
}
