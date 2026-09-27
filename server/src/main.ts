import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

// 先加载 .env（AppModule 为动态导入，确保 TypeORM 配置时环境变量已就绪）
loadEnv();

async function bootstrap() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: false }),
  );
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Open Cinema API running at http://localhost:${port}/api`);
}
bootstrap();
