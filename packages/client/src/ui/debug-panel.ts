export class DebugPanel {
  private panel = document.getElementById('debug-panel')!;
  private resetBtn = document.getElementById('debug-reset-spawn') as HTMLButtonElement;
  private onReset: (() => void) | null = null;

  constructor() {
    this.resetBtn.addEventListener('click', () => {
      this.onReset?.();
    });
  }

  setCallbacks(onReset: () => void): void {
    this.onReset = onReset;
  }

  show(): void {
    this.panel.classList.remove('hidden');
  }

  hide(): void {
    this.panel.classList.add('hidden');
  }
}
