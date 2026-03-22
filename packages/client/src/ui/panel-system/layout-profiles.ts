import { PanelCapabilities, PanelLayoutProfile } from './types';

export const DESKTOP_PANEL_LAYOUT: PanelLayoutProfile = {
  id: 'desktop',
  slots: [
    {
      placement: 'left-lower',
      panelIds: ['attr'],
    },
    {
      placement: 'center-intel',
      panelIds: ['world-map-intel', 'world-nearby', 'world-suggestions'],
    },
    {
      placement: 'right-top',
      panelIds: ['inventory', 'equipment', 'technique', 'quest'],
    },
    {
      placement: 'right-bottom',
      panelIds: ['action'],
    },
    {
      placement: 'hud',
      panelIds: ['hud'],
    },
    {
      placement: 'floating',
      panelIds: ['minimap', 'chat'],
    },
  ],
  overlayPanelIds: ['loot', 'settings', 'suggestion', 'changelog', 'debug'],
};

export const MOBILE_PANEL_LAYOUT: PanelLayoutProfile = {
  id: 'mobile',
  slots: [
    {
      placement: 'hud',
      panelIds: ['hud'],
    },
    {
      placement: 'floating',
      panelIds: ['minimap'],
    },
    {
      placement: 'external',
      panelIds: [
        'chat',
        'attr',
        'inventory',
        'equipment',
        'technique',
        'quest',
        'action',
        'world-map-intel',
        'world-nearby',
        'world-suggestions',
      ],
    },
  ],
  overlayPanelIds: ['loot', 'settings', 'suggestion', 'changelog', 'debug'],
};

export function resolvePanelLayoutProfile(capabilities: PanelCapabilities): PanelLayoutProfile {
  return capabilities.viewport === 'mobile' ? MOBILE_PANEL_LAYOUT : DESKTOP_PANEL_LAYOUT;
}
