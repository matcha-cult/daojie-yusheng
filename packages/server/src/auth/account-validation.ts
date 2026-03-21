export const ACCOUNT_MIN_LENGTH = 1;
export const PASSWORD_MIN_LENGTH = 6;

function containsWhitespace(value: string): boolean {
  return /\s/.test(value);
}

export function normalizeUsername(value: string): string {
  return value.normalize('NFC');
}

export function normalizeDisplayName(value: string): string {
  return value.normalize('NFC');
}

export function getDefaultDisplayName(username: string): string {
  return [...normalizeUsername(username)][0] ?? '';
}

export function resolveDisplayName(displayName: string | null | undefined, username: string): string {
  const normalized = typeof displayName === 'string' ? normalizeDisplayName(displayName) : '';
  return normalized || getDefaultDisplayName(username);
}

export function validateUsername(username: string): string | null {
  const normalized = normalizeUsername(username);
  if (normalized.length < ACCOUNT_MIN_LENGTH) {
    return `账号长度不能少于 ${ACCOUNT_MIN_LENGTH} 个字符`;
  }
  if (containsWhitespace(normalized)) {
    return '账号不支持空格';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码长度不能少于 ${PASSWORD_MIN_LENGTH} 个字符`;
  }
  if (containsWhitespace(password)) {
    return '密码不支持空格';
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  const normalized = normalizeDisplayName(displayName);
  if (!normalized) {
    return '显示名称不能为空';
  }
  if (containsWhitespace(normalized)) {
    return '显示名称不支持空格';
  }
  if ([...normalized].length !== 1) {
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
