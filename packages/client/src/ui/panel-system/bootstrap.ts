import { PanelCapabilityMonitor, detectPanelCapabilities } from './capability';
import { resolvePanelLayoutProfile } from './layout-profiles';
import { buildDefaultPanelRegistry, PanelRegistry } from './registry';
import { PanelSystemStore } from './store';
import { PanelRuntimeState } from './types';

export interface ClientPanelSystem {
  registry: PanelRegistry;
  store: PanelSystemStore;
  capabilityMonitor: PanelCapabilityMonitor;
  destroy: () => void;
}

const INITIAL_RUNTIME_STATE: PanelRuntimeState = {
  connected: false,
  playerId: null,
  mapId: null,
  shellVisible: false,
};

export function createClientPanelSystem(win: Window = window): ClientPanelSystem {
  const capabilities = detectPanelCapabilities(win);
  const layout = resolvePanelLayoutProfile(capabilities);
  const registry = buildDefaultPanelRegistry();
  const store = new PanelSystemStore({
    capabilities,
    layout,
    runtime: INITIAL_RUNTIME_STATE,
    panels: {},
  });

  const capabilityMonitor = new PanelCapabilityMonitor(win, (nextCapabilities) => {
    store.setCapabilities(nextCapabilities, resolvePanelLayoutProfile(nextCapabilities));
  });
  capabilityMonitor.start();

  return {
    registry,
    store,
    capabilityMonitor,
    destroy: () => {
      capabilityMonitor.stop();
    },
  };
}
