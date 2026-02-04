import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { EngineModule } from './engine.module';

async function bootstrap() {
  const app = await NestFactory.create(EngineModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
