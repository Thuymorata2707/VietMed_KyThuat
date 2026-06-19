// import { ValidationPipe } from '@nestjs/common';
// import { NestFactory } from '@nestjs/core';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import { AppModule } from './app.module';
// import { AppConfigService } from './config/app-config.service';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   const config = app.get(AppConfigService);
//   config.validate();

//   app.enableCors();

//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//     }),
//   );

//   const swaggerConfig = new DocumentBuilder()
//     .setTitle('VietMed Ky Thuat API')
//     .setDescription('Backend API for VietMed technical operations')
//     .setVersion('1.0')
//     .addBearerAuth()
//     .build();

//   const document = SwaggerModule.createDocument(app, swaggerConfig);
//   SwaggerModule.setup('docs', app, document);

//   await app.listen(config.port);
// }
// bootstrap();
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  config.validate();

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://viet-med-ky-thuat.vercel.app',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VietMed Ky Thuat API')
    .setDescription('Backend API for VietMed technical operations')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || config.port || 3000;
  await app.listen(port);
}
//DONR
bootstrap();
