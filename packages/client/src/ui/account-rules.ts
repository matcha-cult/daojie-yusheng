export const ACCOUNT_MIN_LENGTH = 1;
export const PASSWORD_MIN_LENGTH = 6;

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

export function validateRegisterUsername(username: string): string | null {
  if (username.length < ACCOUNT_MIN_LENGTH) {
    return `账号长度不能少于 ${ACCOUNT_MIN_LENGTH} 个字符`;
  }
  if (hasWhitespace(username)) {
    return '账号不支持空格';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码长度不能少于 ${PASSWORD_MIN_LENGTH} 个字符`;
  }
  if (hasWhitespace(password)) {
    return '密码不支持空格';
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  if (!displayName) {
    return '显示名称不能为空';
  }
  if (hasWhitespace(displayName)) {
    return '显示名称不支持空格';
  }
  if ([...displayName].length !== 1) {
    return '显示名称必须为 1 个字符';
  }
  return null;
}

export function validateRoleName(roleName: string): string | null {
  const normalized = roleName.normalize('NFC').trim();
  if (!normalized) {
    return '角色名称不能为空';
  }
  if ([...normalized].length > 50) {
    return '角色名称不能超过 50 个字符';
  }
  return null;
}
