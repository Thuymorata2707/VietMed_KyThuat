import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { createCsrfProtectionMiddleware } from './common/middleware/csrf-protection.middleware';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const config = app.get(AppConfigService);
  config.validate();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  app.enableCors({
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Protection'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    origin: config.corsOrigins,
    credentials: true,
  });
  app.use(createCsrfProtectionMiddleware(config));
  app.use(createRateLimitMiddleware(config));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (config.enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VietMed Ky Thuat API')
      .setDescription('Backend API for VietMed technical operations')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.port);
}
bootstrap();
