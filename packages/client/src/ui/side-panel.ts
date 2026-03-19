/** 页面布局与多组标签页控制器 */
export class SidePanel {
  private panel: HTMLElement;
  private visible = false;
  private onVisibilityChange: ((visible: boolean) => void) | null = null;

  constructor() {
    this.panel = document.getElementById('game-shell')!;
    this.bindTabGroups();
  }

  show(): void {
    this.panel.classList.remove('hidden');
    this.visible = true;
    this.onVisibilityChange?.(true);
  }

  hide(): void {
    this.panel.classList.add('hidden');
    this.visible = false;
    this.onVisibilityChange?.(false);
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
      return;
    }
    this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisibilityChangeCallback(callback: (visible: boolean) => void): void {
    this.onVisibilityChange = callback;
  }

  switchTab(tabName: string): void {
    const groups = this.panel.querySelectorAll<HTMLElement>('[data-tab-group]');
    groups.forEach(group => {
      const hasTarget = this.getGroupTabs(group)
        .some(button => button.dataset.tab === tabName);
      if (hasTarget) {
        this.switchGroupTab(group, tabName);
      }
    });
  }

  private bindTabGroups(): void {
    const groups = this.panel.querySelectorAll<HTMLElement>('[data-tab-group]');
    groups.forEach(group => {
      this.getGroupTabs(group).forEach(button => {
        button.addEventListener('click', () => {
          const tabName = button.dataset.tab;
          if (!tabName) return;
          this.switchGroupTab(group, tabName);
        });
      });
    });
  }

  private switchGroupTab(group: HTMLElement, tabName: string): void {
    this.getGroupTabs(group).forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });
    this.getGroupPanes(group).forEach(pane => {
      pane.classList.toggle('active', pane.dataset.pane === tabName);
    });
  }

  private getGroupTabs(group: HTMLElement): HTMLElement[] {
    return [...group.querySelectorAll<HTMLElement>('[data-tab]')]
      .filter((button) => button.closest<HTMLElement>('[data-tab-group]') === group);
  }

  private getGroupPanes(group: HTMLElement): HTMLElement[] {
    return [...group.querySelectorAll<HTMLElement>('[data-pane]')]
      .filter((pane) => pane.closest<HTMLElement>('[data-tab-group]') === group);
  }
}
