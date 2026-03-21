import { detailModalHost } from '../detail-modal-host';
import { validateDisplayName, validatePassword, validateRoleName } from '../account-rules';
import {
  checkDisplayNameAvailability,
  getAccessToken,
  updateDisplayName,
  updatePassword,
  updateRoleName,
} from '../auth-api';

type SettingsPanelOptions = {
  getCurrentDisplayName: () => string;
  getCurrentRoleName: () => string;
  onDisplayNameUpdated: (displayName: string) => void;
  onRoleNameUpdated: (roleName: string) => void;
  onLogout: () => void;
};

export class SettingsPanel {
  private currentDisplayName = '';
  private currentRoleName = '';
  private displayNameCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private displayNameAbortController: AbortController | null = null;
  private displayNameAvailable = false;
  private options: SettingsPanelOptions | null = null;

  constructor() {
    document.getElementById('hud-open-settings')?.addEventListener('click', () => this.open());
    document.getElementById('hud-logout')?.addEventListener('click', () => {
      this.options?.onLogout();
    });
  }

  setOptions(options: SettingsPanelOptions): void {
    this.options = options;
  }

  open(): void {
    if (!this.options) {
      return;
    }
    this.currentDisplayName = this.options.getCurrentDisplayName().normalize('NFC');
    this.currentRoleName = this.options.getCurrentRoleName().normalize('NFC');
    this.displayNameAvailable = true;

    detailModalHost.open({
      ownerId: 'settings-panel',
      title: '设置',
      subtitle: `当前显示：${this.currentDisplayName || '未设置'} · 角色名：${this.currentRoleName || '未设置'}`,
      hint: '点击空白处关闭',
      bodyHtml: `
        <div class="panel-section account-settings-section">
          <div class="panel-section-title">名称设置</div>
          <div class="account-settings-copy">显示名称是唯一的一字标识；角色名称完整显示在头顶，默认使用账号名称，可与其他人重名。</div>
          <div class="account-settings-name-grid">
            <div class="account-settings-field account-settings-field--display">
              <label for="settings-display-name">显示名称</label>
              <input id="settings-display-name" class="account-settings-display-input" type="text" maxlength="1" value="${escapeHtml(this.currentDisplayName)}" placeholder="字" />
              <div id="settings-display-name-status" class="account-settings-status">当前名称可继续使用</div>
              <div class="account-settings-actions">
                <button id="settings-display-name-submit" class="small-btn" type="button">保存显示名称</button>
              </div>
            </div>
            <div class="account-settings-field">
              <label for="settings-role-name">角色名称</label>
              <input id="settings-role-name" type="text" maxlength="50" value="${escapeHtml(this.currentRoleName)}" placeholder="输入角色名称" />
              <div id="settings-role-name-status" class="account-settings-status"></div>
              <div class="account-settings-actions">
                <button id="settings-role-name-submit" class="small-btn" type="button">保存角色名称</button>
              </div>
            </div>
          </div>
        </div>
        <div class="panel-section account-settings-section">
          <div class="panel-section-title">修改密码</div>
          <div class="account-settings-field">
            <label for="settings-current-password">当前密码</label>
            <input id="settings-current-password" type="password" placeholder="输入当前密码" />
          </div>
          <div class="account-settings-field">
            <label for="settings-new-password">新密码</label>
            <input id="settings-new-password" type="password" placeholder="至少 6 位且不含空格" />
          </div>
          <div id="settings-password-status" class="account-settings-status"></div>
          <div class="account-settings-actions">
            <button id="settings-password-submit" class="small-btn" type="button">保存密码</button>
          </div>
        </div>
      `,
      onAfterRender: (body) => {
        this.bindModal(body);
      },
    });
  }

  private bindModal(body: HTMLElement): void {
    const displayNameInput = body.querySelector<HTMLInputElement>('#settings-display-name');
    const displayNameStatus = body.querySelector<HTMLElement>('#settings-display-name-status');
    const displayNameSubmit = body.querySelector<HTMLButtonElement>('#settings-display-name-submit');
    const currentPasswordInput = body.querySelector<HTMLInputElement>('#settings-current-password');
    const newPasswordInput = body.querySelector<HTMLInputElement>('#settings-new-password');
    const passwordStatus = body.querySelector<HTMLElement>('#settings-password-status');
    const passwordSubmit = body.querySelector<HTMLButtonElement>('#settings-password-submit');
    const roleNameInput = body.querySelector<HTMLInputElement>('#settings-role-name');
    const roleNameStatus = body.querySelector<HTMLElement>('#settings-role-name-status');
    const roleNameSubmit = body.querySelector<HTMLButtonElement>('#settings-role-name-submit');
    if (!displayNameInput || !displayNameStatus || !displayNameSubmit || !currentPasswordInput || !newPasswordInput || !passwordStatus || !passwordSubmit || !roleNameInput || !roleNameStatus || !roleNameSubmit) {
      return;
    }

    displayNameInput.addEventListener('input', () => {
      void this.scheduleDisplayNameCheck(displayNameInput, displayNameStatus);
    });
    displayNameSubmit.addEventListener('click', () => {
      void this.handleDisplayNameSubmit(displayNameInput, displayNameStatus, displayNameSubmit);
    });
    passwordSubmit.addEventListener('click', () => {
      void this.handlePasswordSubmit(currentPasswordInput, newPasswordInput, passwordStatus, passwordSubmit);
    });
    roleNameSubmit.addEventListener('click', () => {
      void this.handleRoleNameSubmit(roleNameInput, roleNameStatus, roleNameSubmit);
    });
  }

  private async scheduleDisplayNameCheck(
    input: HTMLInputElement,
    statusEl: HTMLElement,
  ): Promise<void> {
    if (this.displayNameCheckTimer) {
      clearTimeout(this.displayNameCheckTimer);
    }
    const displayName = input.value.normalize('NFC');
    if (displayName === this.currentDisplayName) {
      this.displayNameAvailable = true;
      setStatus(statusEl, '当前名称可继续使用', '');
      return;
    }

    const localError = validateDisplayName(displayName);
    if (localError) {
      this.displayNameAvailable = false;
      setStatus(statusEl, localError, 'error');
      return;
    }

    setStatus(statusEl, '正在检测...', '');
    this.displayNameCheckTimer = setTimeout(() => {
      void this.checkDisplayName(displayName, statusEl);
    }, 250);
  }

  private async checkDisplayName(displayName: string, statusEl: HTMLElement): Promise<void> {
    if (displayName === this.currentDisplayName) {
      this.displayNameAvailable = true;
      setStatus(statusEl, '当前名称可继续使用', '');
      return;
    }
    if (this.displayNameAbortController) {
      this.displayNameAbortController.abort();
    }
    const controller = new AbortController();
    this.displayNameAbortController = controller;

    try {
      const result = await checkDisplayNameAvailability(displayName, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      this.displayNameAvailable = result.available;
      setStatus(
        statusEl,
        result.available ? '显示名称可用' : (result.message ?? '显示名称不可用'),
        result.available ? 'success' : 'error',
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      this.displayNameAvailable = false;
      setStatus(statusEl, error instanceof Error ? error.message : '检测失败', 'error');
    }
  }

  private async handleDisplayNameSubmit(
    input: HTMLInputElement,
    statusEl: HTMLElement,
    button: HTMLButtonElement,
  ): Promise<void> {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus(statusEl, '登录已失效，请重新登录', 'error');
      return;
    }

    const displayName = input.value.normalize('NFC');
    const localError = validateDisplayName(displayName);
    if (localError) {
      setStatus(statusEl, localError, 'error');
      return;
    }
    if (displayName !== this.currentDisplayName) {
      await this.checkDisplayName(displayName, statusEl);
      if (!this.displayNameAvailable) {
        return;
      }
    }

    button.disabled = true;
    setStatus(statusEl, '正在保存...', '');
    try {
      const result = await updateDisplayName(accessToken, { displayName });
      this.currentDisplayName = result.displayName;
      this.displayNameAvailable = true;
      input.value = result.displayName;
      this.options?.onDisplayNameUpdated(result.displayName);
      setStatus(statusEl, '显示名称已更新', 'success');
    } catch (error) {
      setStatus(statusEl, error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      button.disabled = false;
    }
  }

  private async handlePasswordSubmit(
    currentPasswordInput: HTMLInputElement,
    newPasswordInput: HTMLInputElement,
    statusEl: HTMLElement,
    button: HTMLButtonElement,
  ): Promise<void> {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus(statusEl, '登录已失效，请重新登录', 'error');
      return;
    }

    if (!currentPasswordInput.value) {
      setStatus(statusEl, '当前密码不能为空', 'error');
      return;
    }
    const passwordError = validatePassword(newPasswordInput.value);
    if (passwordError) {
      setStatus(statusEl, passwordError, 'error');
      return;
    }

    button.disabled = true;
    setStatus(statusEl, '正在保存...', '');
    try {
      await updatePassword(accessToken, {
        currentPassword: currentPasswordInput.value,
        newPassword: newPasswordInput.value,
      });
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      setStatus(statusEl, '密码已更新', 'success');
    } catch (error) {
      setStatus(statusEl, error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      button.disabled = false;
    }
  }

  private async handleRoleNameSubmit(
    input: HTMLInputElement,
    statusEl: HTMLElement,
    button: HTMLButtonElement,
  ): Promise<void> {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus(statusEl, '登录已失效，请重新登录', 'error');
      return;
    }

    const roleName = input.value.normalize('NFC').trim();
    const roleNameError = validateRoleName(roleName);
    if (roleNameError) {
      setStatus(statusEl, roleNameError, 'error');
      return;
    }
    if (roleName === this.currentRoleName) {
      setStatus(statusEl, '角色名称未变化', '');
      return;
    }

    button.disabled = true;
    setStatus(statusEl, '正在保存...', '');
    try {
      const result = await updateRoleName(accessToken, { roleName });
      this.currentRoleName = result.roleName;
      input.value = result.roleName;
      this.options?.onRoleNameUpdated(result.roleName);
      setStatus(statusEl, '角色名称已更新', 'success');
    } catch (error) {
      setStatus(statusEl, error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      button.disabled = false;
    }
  }
}

function setStatus(target: HTMLElement, message: string, tone: '' | 'success' | 'error'): void {
  target.textContent = message;
  target.classList.remove('success', 'error');
  if (tone) {
    target.classList.add(tone);
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
