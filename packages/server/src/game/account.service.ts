import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BasicOkRes } from '@mud/shared';
import { UserEntity } from '../database/entities/user.entity';
import { PlayerEntity } from '../database/entities/player.entity';
import { PlayerService } from './player.service';
import {
  normalizeDisplayName,
  resolveDisplayName,
  validateDisplayName,
  validatePassword,
  validateRoleName,
} from '../auth/account-validation';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PlayerEntity)
    private readonly playerRepo: Repository<PlayerEntity>,
    private readonly playerService: PlayerService,
  ) {}

  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<BasicOkRes> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('当前密码错误');
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    return { ok: true };
  }

  async updateDisplayName(userId: string, displayName: string): Promise<{ displayName: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const normalizedDisplayName = normalizeDisplayName(displayName);
    const displayNameError = validateDisplayName(normalizedDisplayName);
    if (displayNameError) {
      throw new BadRequestException(displayNameError);
    }

    const currentDisplayName = resolveDisplayName(user.displayName, user.username);
    if (normalizedDisplayName === currentDisplayName) {
      return { displayName: normalizedDisplayName };
    }

    const existing = await this.findUserByEffectiveDisplayName(normalizedDisplayName, userId);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('显示名称已存在');
    }

    user.displayName = normalizedDisplayName;
    await this.userRepo.save(user);
    await this.playerService.updatePlayerDisplayName(userId, normalizedDisplayName);
    return { displayName: normalizedDisplayName };
  }

  async updateRoleName(userId: string, roleName: string): Promise<{ roleName: string }> {
    const normalizedRoleName = roleName.normalize('NFC').trim();
    const roleNameError = validateRoleName(normalizedRoleName);
    if (roleNameError) {
      throw new BadRequestException(roleNameError);
    }

    await this.playerRepo.update({ userId }, { name: normalizedRoleName });
    await this.playerService.updatePlayerRoleName(userId, normalizedRoleName);
    return { roleName: normalizedRoleName };
  }

  private findUserByEffectiveDisplayName(displayName: string, excludeUserId: string): Promise<UserEntity | null> {
    return this.userRepo.createQueryBuilder('user')
      .where(new Brackets((qb) => {
        qb.where('user.displayName = :displayName', { displayName })
          .orWhere('(user.displayName IS NULL AND LEFT(user.username, 1) = :displayName)', { displayName });
      }))
      .andWhere('user.id != :excludeUserId', { excludeUserId })
      .getOne();
  }
}
