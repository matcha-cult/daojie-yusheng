import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './entities/user.entity';
import { PlayerEntity } from './entities/player.entity';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.get<string>('DATABASE_URL');
        if (url) {
          return {
            type: 'postgres' as const,
            url,
            entities: [UserEntity, PlayerEntity],
            synchronize: true, // 开发阶段自动同步表结构
          };
        }

        return {
          type: 'postgres' as const,
          host: cfg.get<string>('DB_HOST', 'localhost'),
          port: cfg.get<number>('DB_PORT', 5432),
          username: cfg.get<string>('DB_USERNAME', 'postgres'),
          password: cfg.get<string>('DB_PASSWORD', 'postgres'),
          database: cfg.get<string>('DB_DATABASE', 'daojie_yusheng'),
          entities: [UserEntity, PlayerEntity],
          synchronize: true, // 开发阶段自动同步表结构
        };
      },
    }),
    TypeOrmModule.forFeature([UserEntity, PlayerEntity]),
  ],
  providers: [RedisService],
  exports: [TypeOrmModule, RedisService],
})
export class DatabaseModule {}
