import { SocketManager } from './network/socket';
import { TextRenderer } from './renderer/text';
import { Camera } from './renderer/camera';
import { KeyboardInput } from './input/keyboard';
import { MouseInput } from './input/mouse';
import { LoginUI } from './ui/login';
import { HUD } from './ui/hud';
import { ChatUI } from './ui/chat';
import { SidePanel } from './ui/side-panel';
import { DebugPanel } from './ui/debug-panel';
import { AttrPanel } from './ui/panels/attr-panel';
import { InventoryPanel } from './ui/panels/inventory-panel';
import { EquipmentPanel } from './ui/panels/equipment-panel';
import { TechniquePanel } from './ui/panels/technique-panel';
import { QuestPanel } from './ui/panels/quest-panel';
import { ActionPanel } from './ui/panels/action-panel';
import { GmPanel } from './ui/panels/gm-panel';
import { WorldPanel } from './ui/panels/world-panel';
import { adjustZoom, cycleZoom, getZoom } from './display';
import { Direction, MapMeta, PlayerState, Tile, VisibleTile, S2C_Init, S2C_Tick, VIEW_RADIUS, TechniqueRealm } from '@mud/shared';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const canvasHost = document.getElementById('game-stage') as HTMLElement;
const zoomInBtn = document.getElementById('zoom-in') as HTMLButtonElement | null;
const zoomOutBtn = document.getElementById('zoom-out') as HTMLButtonElement | null;
const zoomLevelEl = document.getElementById('zoom-level');
const socket = new SocketManager();
const camera = new Camera();
const renderer = new TextRenderer();
const loginUI = new LoginUI(socket);
const hud = new HUD();
const chatUI = new ChatUI();
const mouseInput = new MouseInput();
const debugPanel = new DebugPanel();

// 修仙系统面板
const sidePanel = new SidePanel();
const attrPanel = new AttrPanel();
const inventoryPanel = new InventoryPanel();
const equipmentPanel = new EquipmentPanel();
const techniquePanel = new TechniquePanel();
const questPanel = new QuestPanel();
const actionPanel = new ActionPanel();
const gmPanel = new GmPanel();
const worldPanel = new WorldPanel();
let pendingTargetedAction: { actionId: string; targetMode?: string } | null = null;

// 面板回调绑定
inventoryPanel.setCallbacks(
  (slotIndex) => socket.sendUseItem(slotIndex),
  (slotIndex, count) => socket.sendDropItem(slotIndex, count),
  (slotIndex) => socket.sendEquip(slotIndex),
);
equipmentPanel.setCallbacks(
  (slot) => socket.sendUnequip(slot),
);
techniquePanel.setCallbacks(
  (techId) => socket.sendCultivate(techId),
);
actionPanel.setCallbacks(
  (actionId, requiresTarget, targetMode) => {
    if (requiresTarget) {
      pendingTargetedAction = { actionId, targetMode };
      showToast('请选择技能目标');
      return;
    }
    pendingTargetedAction = null;
    socket.sendAction(actionId);
  },
);
gmPanel.setCallbacks({
  onRefresh: () => socket.sendGmGetState(),
  onResetSelf: () => {
    showToast('已发送回出生点请求');
    socket.sendDebugResetSpawn();
  },
  onCycleZoom: () => {
    const zoom = cycleZoom();
    refreshZoomChrome(zoom);
    refreshZoomViewport();
    showToast(`缩放已切换为 ${zoom}x`);
  },
  onSpawnBots: (count) => socket.sendGmSpawnBots(count),
  onRemoveBots: (playerIds, all) => socket.sendGmRemoveBots(playerIds, all),
  onUpdatePlayer: (payload) => socket.sendGmUpdatePlayer(payload),
  onResetPlayer: (playerId) => socket.sendGmResetPlayer(playerId),
});
debugPanel.setCallbacks(() => {
  showToast('已发送回出生点请求');
  socket.sendDebugResetSpawn();
});
chatUI.setCallback((message) => socket.sendChat(message));
zoomInBtn?.addEventListener('click', () => {
  const previous = getZoom();
  const zoom = adjustZoom(1);
  refreshZoomChrome(zoom);
  if (zoom !== previous) {
    refreshZoomViewport();
    showToast(`缩放已切换为 ${zoom}x`);
  }
});
zoomOutBtn?.addEventListener('click', () => {
  const previous = getZoom();
  const zoom = adjustZoom(-1);
  refreshZoomChrome(zoom);
  if (zoom !== previous) {
    refreshZoomViewport();
    showToast(`缩放已切换为 ${zoom}x`);
  }
});

// S2C 更新回调
socket.onAttrUpdate((data) => {
  if (myPlayer) {
    myPlayer.baseAttrs = data.baseAttrs;
    myPlayer.bonuses = data.bonuses;
    myPlayer.maxHp = data.maxHp;
    myPlayer.realm = data.realm;
    myPlayer.realmName = data.realm?.name;
    myPlayer.realmStage = data.realm?.shortName;
    myPlayer.breakthroughReady = data.realm?.breakthroughReady;
  }
  attrPanel.update(data);
  refreshUiChrome();
});
socket.onInventoryUpdate((data) => {
  if (myPlayer) myPlayer.inventory = data.inventory;
  inventoryPanel.update(data.inventory);
});
socket.onEquipmentUpdate((data) => {
  if (myPlayer) myPlayer.equipment = data.equipment;
  equipmentPanel.update(data.equipment);
});
socket.onTechniqueUpdate((data) => {
  if (myPlayer) {
    myPlayer.techniques = data.techniques;
    myPlayer.cultivatingTechId = data.cultivatingTechId;
  }
  techniquePanel.update(data.techniques, data.cultivatingTechId);
  refreshUiChrome();
});
socket.onActionsUpdate((data) => {
  if (myPlayer) {
    myPlayer.actions = data.actions;
    myPlayer.autoBattle = data.autoBattle ?? inferAutoBattle(myPlayer.autoBattle, data.actions);
    myPlayer.autoRetaliate = data.autoRetaliate ?? inferAutoRetaliate(myPlayer.autoRetaliate !== false, data.actions);
  }
  actionPanel.update(data.actions, data.autoBattle ?? myPlayer?.autoBattle, data.autoRetaliate ?? myPlayer?.autoRetaliate);
  refreshUiChrome();
});
socket.onQuestUpdate((data) => {
  if (myPlayer) myPlayer.quests = data.quests;
  questPanel.update(data.quests);
  refreshUiChrome();
});
socket.onSystemMsg((data) => {
  if (data.kind === 'chat') {
    chatUI.addMessage(data.text, data.from, data.kind);
    return;
  }
  if (data.kind === 'quest' || data.kind === 'combat' || data.kind === 'loot') {
    const label = data.from ?? (data.kind === 'quest' ? '任务' : data.kind === 'combat' ? '战斗' : '掉落');
    chatUI.addMessage(data.text, label, data.kind);
    if (data.kind === 'quest' || data.kind === 'loot') {
      showToast(data.text, data.kind);
    }
    return;
  }
  chatUI.addMessage(data.text, data.from ?? '系统', data.kind ?? 'system');
  showToast(data.text, data.kind ?? 'system');
});
socket.onError(async (data) => {
  if (data.code === 'AUTH_FAIL') {
    const restored = await loginUI.restoreSession();
    if (restored) return;
    resetGameState();
    loginUI.show('登录已失效，请重新登录');
    return;
  }
  showToast(data.message);
});
socket.onGmState((data) => {
  gmPanel.update(data);
});
socket.onKick(() => {
  resetGameState();
  loginUI.logout('账号已在其他位置登录');
});
socket.onConnectError((message) => {
  if (socket.connected) return;
  if (loginUI.hasRefreshToken()) return;
  showToast(`连接失败: ${message}`);
});
socket.onDisconnect((reason) => {
  if (reason === 'io client disconnect') return;
  if (!myPlayer) return;
  showToast('连接已断开，正在等待重新登录或恢复');
});

let pathCells: { x: number; y: number }[] = [];
let pathTarget: { x: number; y: number } | null = null;

// 动画状态
let tickStartTime = performance.now();
let tickDuration = 1000;
let lastGmSyncAt = 0;

let myPlayer: PlayerState | null = null;
let currentMapMeta: MapMeta | null = null;
let latestEntities: { id: string; wx: number; wy: number; char: string; color: string; name?: string; kind?: string; hp?: number; maxHp?: number }[] = [];

// 视野中心平滑值（浮点格子坐标），无延迟快速 lerp
let viewCenterX = 0;
let viewCenterY = 0;
const VIEW_LERP_SPEED = 12;

// 世界地图缓存：key = "x,y" → Tile
const tileCache = new Map<string, Tile>();
const currentVisibleTiles = new Set<string>();

// 当前服务端发来的 tiles 及其 origin
let currentTiles: VisibleTile[][] = [];
let tileOriginX = 0;
let tileOriginY = 0;

const MAP_FALLBACK: Record<string, { danger: number; recommendedRealm: string }> = {
  spawn: { danger: 1, recommendedRealm: '锻体到后天' },
  bamboo_forest: { danger: 2, recommendedRealm: '后天到先天' },
  wildlands: { danger: 2, recommendedRealm: '后天到先天' },
  black_iron_mine: { danger: 3, recommendedRealm: '先天到练气前夜' },
  ancient_ruins: { danger: 3, recommendedRealm: '先天圆熟到练气启蒙' },
  beast_valley: { danger: 5, recommendedRealm: '练气期' },
  spirit_ridge: { danger: 4, recommendedRealm: '先天到练气' },
  sky_ruins: { danger: 5, recommendedRealm: '练气到筑基' },
};

function showToast(message: string, kind: 'system' | 'chat' | 'quest' | 'combat' | 'loot' = 'system') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = `toast-kind-${kind}`;
  el.textContent = message;
  el.classList.remove('hidden');
  el.classList.add('show');
  window.setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hidden');
  }, 2500);
}

function refreshZoomChrome(zoom = getZoom()) {
  if (zoomLevelEl) {
    zoomLevelEl.textContent = `${zoom}x`;
  }
}

function refreshZoomViewport() {
  if (myPlayer) {
    camera.snap(myPlayer);
  }
  renderer.updateEntities(latestEntities);
}

function inferAutoBattle(current: boolean, actions: { id: string; name: string; desc: string }[]): boolean {
  const toggle = actions.find(a => a.id.includes('auto') && (a.id.includes('battle') || a.name.includes('自动战斗') || a.desc.includes('自动战斗')));
  if (!toggle) return current;
  if (toggle.name.includes('关闭')) return true;
  if (toggle.name.includes('开启')) return false;
  if (toggle.desc.includes('已开启')) return true;
  if (toggle.desc.includes('已关闭')) return false;
  return current;
}

function resolveMapDanger(): string {
  const fallback = myPlayer ? MAP_FALLBACK[myPlayer.mapId] : undefined;
  const danger = currentMapMeta?.dangerLevel ?? fallback?.danger;
  return danger ? `危 ${danger}/5` : '未知';
}

function resolveRealmLabel(player: PlayerState): string {
  if (player.realmName) {
    return player.realmStage ? `${player.realmName} · ${player.realmStage}` : player.realmName;
  }
  const top = [...player.techniques].sort((a, b) => b.realm - a.realm)[0];
  if (!top) return '凡俗武者';
  const labels: Record<TechniqueRealm, string> = {
    [TechniqueRealm.Entry]: '武学入门',
    [TechniqueRealm.Minor]: '后天圆熟',
    [TechniqueRealm.Major]: '先天凝意',
    [TechniqueRealm.Perfection]: '半步修真',
  };
  return labels[top.realm] ?? '修行中';
}

function resolveTitleLabel(player: PlayerState): string {
  if (player.realm?.path === 'immortal') {
    return player.realm.shortName === '筑基' ? '云游真修' : '初登仙门';
  }
  const top = [...player.techniques].sort((a, b) => b.level - a.level)[0];
  if (!top) return '无名后学';
  if (top.realm >= TechniqueRealm.Perfection) return '名动一方';
  if (top.realm >= TechniqueRealm.Major) return '先天气成';
  if (top.realm >= TechniqueRealm.Minor) return '游历武者';
  return '见习弟子';
}

function resolveObjectiveLabel(player: PlayerState): string {
  const ready = player.quests.find((entry) => entry.status === 'ready');
  if (ready) return `交付 ${ready.title}`;
  const active = player.quests.find((entry) => entry.status === 'active');
  return active ? `${active.targetName} ${active.progress}/${active.required}` : '暂无主目标';
}

function resolveThreatLabel(player: PlayerState): string {
  const monsters = latestEntities
    .filter((entity) => entity.kind === 'monster')
    .map((entity) => Math.abs(entity.wx - player.x) + Math.abs(entity.wy - player.y));
  if (monsters.length === 0) return '平稳';
  const nearest = Math.min(...monsters);
  if (nearest <= 2) return '近身威胁';
  if (nearest <= 5) return '附近有敌';
  return '远处异动';
}

function refreshUiChrome() {
  if (!myPlayer) return;
  hud.update(myPlayer, {
    mapName: currentMapMeta?.name ?? myPlayer.mapId,
    mapDanger: resolveMapDanger(),
    realmLabel: resolveRealmLabel(myPlayer),
    objectiveLabel: resolveObjectiveLabel(myPlayer),
    threatLabel: resolveThreatLabel(myPlayer),
    titleLabel: resolveTitleLabel(myPlayer),
  });
  worldPanel.update({
    player: myPlayer,
    mapMeta: currentMapMeta,
    entities: latestEntities,
    actions: myPlayer.actions,
    quests: myPlayer.quests,
  });
}

function inferAutoRetaliate(current: boolean, actions: { id: string; name: string; desc: string }[]): boolean {
  const toggle = actions.find(a => a.id.includes('auto_retaliate') || a.name.includes('受击'));
  if (!toggle) return current;
  if (toggle.name.includes('不开战')) return false;
  if (toggle.name.includes('自动开战')) return true;
  if (toggle.desc.includes('不会自动')) return false;
  if (toggle.desc.includes('自动开启')) return true;
  return current;
}

function getViewRadius(): number {
  return myPlayer?.viewRange ?? VIEW_RADIUS;
}

function clearCurrentPath() {
  pathCells = [];
  pathTarget = null;
}

function sendMoveCommand(dir: Direction) {
  if (!myPlayer) return;
  clearCurrentPath();
  myPlayer.facing = dir;
  socket.sendMove(dir);
}

function planPathTo(target: { x: number; y: number }) {
  if (!myPlayer) return;
  pathTarget = target;
  pathCells = [{ x: target.x, y: target.y }];
  socket.sendMoveTo(target.x, target.y);
}

function resetGameState() {
  myPlayer = null;
  currentMapMeta = null;
  clearCurrentPath();
  currentTiles = [];
  tileOriginX = 0;
  tileOriginY = 0;
  tileCache.clear();
  currentVisibleTiles.clear();
  lastGmSyncAt = 0;
  pendingTargetedAction = null;
  sidePanel.hide();
  chatUI.hide();
  chatUI.clear();
  debugPanel.hide();
  attrPanel.clear();
  inventoryPanel.clear();
  equipmentPanel.clear();
  techniquePanel.clear();
  questPanel.clear();
  actionPanel.clear();
  worldPanel.clear();
  gmPanel.clear();
  resizeCanvas();
  document.getElementById('hud')?.classList.add('hidden');
}

/** 将服务端发来的 tiles 写入缓存 */
function cacheTiles(tiles: VisibleTile[][], originX: number, originY: number) {
  currentVisibleTiles.clear();
  for (let r = 0; r < tiles.length; r++) {
    for (let c = 0; c < tiles[r].length; c++) {
      const tile = tiles[r][c];
      const key = `${originX + c},${originY + r}`;
      if (!tile) continue;
      currentVisibleTiles.add(key);
      tileCache.set(key, tile);
    }
  }
}

// 键盘输入
const keyboard = new KeyboardInput((dirs: Direction[]) => {
  clearCurrentPath();
  if (dirs.length > 0) {
    sendMoveCommand(dirs[0]);
  }
});

renderer.init(canvas);
sidePanel.setVisibilityChangeCallback((visible) => {
  if (visible) {
    requestAnimationFrame(() => resizeCanvas());
  }
});

function resizeCanvas() {
  const rect = canvasHost.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.width = width;
  canvas.height = height;
}
resizeCanvas();
refreshZoomChrome();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('contextmenu', (event) => event.preventDefault());

// 鼠标输入
mouseInput.init(
  canvas,
  () => camera,
  () => currentTiles,
  () => latestEntities,
  () => currentMapMeta,
  () => ({ x: tileOriginX, y: tileOriginY }),
  (target) => {
    if (pendingTargetedAction) {
      const targetRef = target.entityId ?? `tile:${target.x}:${target.y}`;
      socket.sendAction(pendingTargetedAction.actionId, targetRef);
      pendingTargetedAction = null;
      return;
    }
    if (target.entityKind === 'monster' && target.entityId) {
      socket.sendAction('battle:engage', target.entityId);
      return;
    }
    if (!target.walkable) {
      showToast('无法到达该位置');
      return;
    }
    planPathTo(target);
  },
);

// 初始化
socket.onInit((data: S2C_Init) => {
  pendingTargetedAction = null;
  myPlayer = data.self;
  currentMapMeta = data.mapMeta;
  currentTiles = data.tiles;
  tileOriginX = myPlayer.x - getViewRadius();
  tileOriginY = myPlayer.y - getViewRadius();

  tileCache.clear();
  cacheTiles(currentTiles, tileOriginX, tileOriginY);

  camera.snap(myPlayer);
  viewCenterX = myPlayer.x;
  viewCenterY = myPlayer.y;

  const entities = data.players.map(([id, x, y, char, color, name, hp, maxHp]) => ({
    id, wx: x, wy: y, char, color, name, hp, maxHp, kind: 'player',
  }));
  entities.push({ id: myPlayer.id, wx: myPlayer.x, wy: myPlayer.y, char: [...myPlayer.name][0] ?? '@', color: '#ff0', name: myPlayer.name, hp: myPlayer.hp, maxHp: myPlayer.maxHp, kind: 'player' });
  latestEntities = entities;
  renderer.updateEntities(entities);

  tickStartTime = performance.now();
  clearCurrentPath();

  // 显示主界面布局并初始化各子面板
  sidePanel.show();
  chatUI.clear();
  chatUI.show();
  document.getElementById('hud')?.classList.remove('hidden');
  resizeCanvas();
  refreshZoomChrome();
  attrPanel.initFromPlayer(myPlayer);
  inventoryPanel.initFromPlayer(myPlayer);
  equipmentPanel.initFromPlayer(myPlayer);
  techniquePanel.initFromPlayer(myPlayer);
  questPanel.initFromPlayer(myPlayer);
  actionPanel.initFromPlayer(myPlayer);
  refreshUiChrome();
  socket.sendGmGetState();
  lastGmSyncAt = performance.now();
});

// Tick 更新
socket.onTick((data: S2C_Tick) => {
  if (!myPlayer) return;
  if (data.fx) {
    for (const effect of data.fx) {
      if (effect.type === 'attack') {
        renderer.addAttackTrail(effect.fromX, effect.fromY, effect.toX, effect.toY, effect.color);
      } else {
        renderer.addFloatingText(effect.x, effect.y, effect.text, effect.color);
      }
    }
  }

  if (data.dt) {
    tickDuration = data.dt;
    hud.updateTick(data.dt);
  }

  if (data.m) {
    if (myPlayer.mapId !== data.m) {
      clearCurrentPath();
      tileCache.clear();
      currentVisibleTiles.clear();
    }
    myPlayer.mapId = data.m;
  }
  if (data.mapMeta) {
    currentMapMeta = data.mapMeta;
  }

  if (typeof data.hp === 'number') {
    myPlayer.hp = data.hp;
  }
  if (data.f !== undefined) {
    myPlayer.facing = data.f;
  }

  const oldX = myPlayer.x;
  const oldY = myPlayer.y;

  for (const [id, x, y] of data.p) {
    if (id === myPlayer.id) {
      myPlayer.x = x;
      myPlayer.y = y;
      break;
    }
  }

  if (data.v) {
    currentTiles = data.v;
    tileOriginX = myPlayer.x - getViewRadius();
    tileOriginY = myPlayer.y - getViewRadius();
    cacheTiles(currentTiles, tileOriginX, tileOriginY);
  }
  camera.follow(myPlayer);

  const moved = myPlayer.x !== oldX || myPlayer.y !== oldY;

  const entities = data.p.map(([id, wx, wy, char, color, name, hp, maxHp]) => ({
    id, wx, wy, char, color, name, hp, maxHp, kind: 'player',
  }));
  const mapEntities = data.e.map(([id, wx, wy, char, color, name, kind, hp, maxHp]) => ({
    id, wx, wy, char, color, name, kind, hp, maxHp,
  }));
  entities.push(...mapEntities);
  latestEntities = entities;
  refreshUiChrome();

  if (moved) {
    const shiftX = myPlayer.x - oldX;
    const shiftY = myPlayer.y - oldY;
    renderer.updateEntities(entities, myPlayer.id, shiftX, shiftY);

    while (pathCells.length > 0 && pathCells[0].x === myPlayer.x && pathCells[0].y === myPlayer.y) {
      pathCells.shift();
    }
  } else {
    renderer.updateEntities(entities);
  }

  if (pathTarget && myPlayer.x === pathTarget.x && myPlayer.y === pathTarget.y) {
    clearCurrentPath();
  }
  if (data.path) {
    pathCells = data.path.map(([x, y]) => ({ x, y }));
    if (pathCells.length === 0 && pathTarget) {
      clearCurrentPath();
    }
  }

  tickStartTime = performance.now();
  if (performance.now() - lastGmSyncAt >= 2000) {
    socket.sendGmGetState();
    lastGmSyncAt = performance.now();
  }
});

let lastFrameTime = performance.now();

function gameLoop() {
  const now = performance.now();
  const frameDt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  const progress = Math.min((now - tickStartTime) / tickDuration, 1);

  camera.update(frameDt);

  // 视野中心平滑追赶玩家，无延迟
  if (myPlayer) {
    const vt = 1 - Math.exp(-VIEW_LERP_SPEED * frameDt);
    viewCenterX += (myPlayer.x - viewCenterX) * vt;
    viewCenterY += (myPlayer.y - viewCenterY) * vt;
    if (Math.abs(viewCenterX - myPlayer.x) < 0.01) viewCenterX = myPlayer.x;
    if (Math.abs(viewCenterY - myPlayer.y) < 0.01) viewCenterY = myPlayer.y;
  }

  renderer.clear();

  if (myPlayer) {
    renderer.setPathHighlight(pathCells);
    renderer.renderWorld(camera, tileCache, currentVisibleTiles, myPlayer.x, myPlayer.y);
    renderer.renderAttackTrails(camera);
    renderer.renderEntities(camera, progress);
    renderer.renderFloatingTexts(camera);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

void loginUI.restoreSession();
