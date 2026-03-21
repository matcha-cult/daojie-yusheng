import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import {
  AccountUpdateDisplayNameReq,
  AccountUpdateDisplayNameRes,
  AccountUpdatePasswordReq,
  AccountUpdateRoleNameReq,
  AccountUpdateRoleNameRes,
  BasicOkRes,
} from '@mud/shared';
import { AuthService } from '../auth/auth.service';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountService: AccountService,
  ) {}

  @Post('password')
  async updatePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AccountUpdatePasswordReq,
  ): Promise<BasicOkRes> {
    return this.accountService.updatePassword(this.requireUserId(authorization), body.currentPassword, body.newPassword);
  }

  @Post('display-name')
  async updateDisplayName(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AccountUpdateDisplayNameReq,
  ): Promise<AccountUpdateDisplayNameRes> {
    return this.accountService.updateDisplayName(this.requireUserId(authorization), body.displayName);
  }

  @Post('role-name')
  async updateRoleName(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AccountUpdateRoleNameReq,
  ): Promise<AccountUpdateRoleNameRes> {
    return this.accountService.updateRoleName(this.requireUserId(authorization), body.roleName);
  }

  private requireUserId(authorization: string | undefined): string {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token) {
      throw new UnauthorizedException('未登录');
    }
    const payload = this.authService.validateToken(token);
    if (!payload) {
      throw new UnauthorizedException('登录已失效');
    }
    return payload.userId;
  }
}
