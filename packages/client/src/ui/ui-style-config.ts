/**
 * UI 样式配置
 * 统一管理颜色模式与字体等级，并持久化到本地存储
 */

import { UI_STYLE_STORAGE_KEY } from '@mud/shared';
import {
  DEFAULT_UI_STYLE_CONFIG,
  UI_COLOR_MODE_OPTIONS,
  UI_FONT_LEVEL_DEFINITIONS,
  type UiColorMode,
  type UiFontLevelDefinition,
  type UiFontLevelKey,
  type UiStyleConfig,
} from '../constants/ui/style';

export type { UiColorMode, UiFontLevelDefinition, UiFontLevelKey, UiStyleConfig };
export { UI_COLOR_MODE_OPTIONS, UI_FONT_LEVEL_DEFINITIONS };

let currentConfig = cloneConfig(DEFAULT_UI_STYLE_CONFIG);
let initialized = false;

export function initializeUiStyleConfig(): UiStyleConfig {
  if (initialized) {
    applyUiStyleConfig(currentConfig);
    return cloneConfig(currentConfig);
  }

  currentConfig = normalizeConfig(readStoredConfig());
  applyUiStyleConfig(currentConfig);
  initialized = true;
  return cloneConfig(currentConfig);
}

export function getUiStyleConfig(): UiStyleConfig {
  if (!initialized) {
    return initializeUiStyleConfig();
  }
  return cloneConfig(currentConfig);
}

export function updateUiColorMode(colorMode: UiColorMode): UiStyleConfig {
  currentConfig = normalizeConfig({
    ...currentConfig,
    colorMode,
  });
  commitConfig();
  return cloneConfig(currentConfig);
}

export function updateUiFontSize(key: UiFontLevelKey, size: number): UiStyleConfig {
  currentConfig = normalizeConfig({
    ...currentConfig,
    fontSizes: {
      ...currentConfig.fontSizes,
      [key]: size,
    },
  });
  commitConfig();
  return cloneConfig(currentConfig);
}

export function resetUiStyleConfig(): UiStyleConfig {
  currentConfig = cloneConfig(DEFAULT_UI_STYLE_CONFIG);
  commitConfig();
  return cloneConfig(currentConfig);
}

function commitConfig(): void {
  applyUiStyleConfig(currentConfig);
  persistConfig(currentConfig);
}

function applyUiStyleConfig(config: UiStyleConfig): void {
  const root = document.documentElement;
  root.dataset.colorMode = config.colorMode;
  root.style.colorScheme = config.colorMode;

  for (const definition of UI_FONT_LEVEL_DEFINITIONS) {
    root.style.setProperty(`--ui-font-size-${definition.key}`, `${config.fontSizes[definition.key]}px`);
  }
}

function normalizeConfig(raw: Partial<UiStyleConfig> | null | undefined): UiStyleConfig {
  const fontSizes = UI_FONT_LEVEL_DEFINITIONS.reduce<Record<UiFontLevelKey, number>>((result, definition) => {
    const candidate = raw?.fontSizes?.[definition.key];
    result[definition.key] = clampFontSize(candidate, definition);
    return result;
  }, {} as Record<UiFontLevelKey, number>);

  return {
    colorMode: raw?.colorMode === 'dark' ? 'dark' : 'light',
    fontSizes,
  };
}

function clampFontSize(value: unknown, definition: UiFontLevelDefinition): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return definition.defaultSize;
  }
  return Math.max(definition.min, Math.min(definition.max, Math.round(value)));
}

function persistConfig(config: UiStyleConfig): void {
  try {
    window.localStorage.setItem(UI_STYLE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 本地存储不可用时静默跳过，保留当前会话内样式
  }
}

function readStoredConfig(): Partial<UiStyleConfig> | null {
  try {
    const raw = window.localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed as Partial<UiStyleConfig>;
  } catch {
    return null;
  }
}

function cloneConfig(config: UiStyleConfig): UiStyleConfig {
  return {
    colorMode: config.colorMode,
    fontSizes: { ...config.fontSizes },
  };
}
