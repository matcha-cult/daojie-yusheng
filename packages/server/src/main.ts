import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SERVER_PORT } from '@mud/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors();

  const port = Number(process.env.PORT) || SERVER_PORT;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`Server running on http://${host}:${port}`);
}
bootstrap();
