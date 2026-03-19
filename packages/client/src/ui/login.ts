import { SocketManager } from '../network/socket';
import { AuthLoginReq, AuthRefreshReq, AuthRegisterReq, AuthTokenRes } from '@mud/shared';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class LoginUI {
  private overlay = document.getElementById('login-overlay')!;
  private usernameInput = document.getElementById('input-username') as HTMLInputElement;
  private passwordInput = document.getElementById('input-password') as HTMLInputElement;
  private loginBtn = document.getElementById('btn-login')!;
  private registerBtn = document.getElementById('btn-register')!;
  private errorDiv = document.getElementById('login-error')!;

  constructor(private socket: SocketManager) {
    this.loginBtn.addEventListener('click', () => this.handleLogin());
    this.registerBtn.addEventListener('click', () => this.handleRegister());
  }

  async restoreSession(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    this.setError('正在恢复会话...');
    try {
      const data = await this.post<AuthRefreshReq>('/auth/refresh', { refreshToken });
      this.onSuccess(data);
      this.setError('');
      return true;
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        this.clearSession();
      }
      this.show();
      this.setError(error instanceof Error ? error.message : '会话恢复失败');
      return false;
    }
  }

  show(message = ''): void {
    this.overlay.classList.remove('hidden');
    if (message) {
      this.setError(message);
    }
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }

  logout(message = ''): void {
    this.clearSession();
    this.show(message);
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  hasRefreshToken(): boolean {
    return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY));
  }

  private async handleLogin() {
    const body: AuthLoginReq = {
      username: this.usernameInput.value,
      password: this.passwordInput.value,
    };
    try {
      const data = await this.post<AuthLoginReq>('/auth/login', body);
      this.onSuccess(data);
    } catch (e: any) {
      this.setError(e.message);
    }
  }

  private async handleRegister() {
    const body: AuthRegisterReq = {
      username: this.usernameInput.value,
      password: this.passwordInput.value,
    };
    try {
      const data = await this.post<AuthRegisterReq>('/auth/register', body);
      this.onSuccess(data);
    } catch (e: any) {
      this.setError(e.message);
    }
  }

  private onSuccess(data: AuthTokenRes) {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    this.socket.connect(data.accessToken);
    this.hide();
    document.getElementById('hud')?.classList.remove('hidden');
    this.setError('');
  }

  private async post<TBody>(url: string, body: TBody): Promise<AuthTokenRes> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new RequestError(await this.readError(res), res.status);
    }

    return res.json() as Promise<AuthTokenRes>;
  }

  private async readError(res: Response): Promise<string> {
    try {
      const data = await res.json() as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        return data.message.join('，');
      }
      if (data.message) {
        return data.message;
      }
    } catch {
      // noop
    }
    return '请求失败';
  }

  private setError(message: string): void {
    this.errorDiv.textContent = message;
  }
}
