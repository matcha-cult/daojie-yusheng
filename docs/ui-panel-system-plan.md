# 客户端 UI Panel System 迁移计划

## 目标

在不改变现有美术风格、布局语言和交互主线的前提下，将客户端 DOM UI 从“面板类各自维护模板与刷新”迁移为一套可复用、可多端适配、可逐步演进的 `Panel System`。

本计划重点解决以下问题：

- 不同浏览器和手机浏览器下的可用性与适配能力不足
- 面板模板、状态、事件、布局耦合严重，复用和替换成本高
- 多个面板仍依赖整块 `innerHTML` 重建，交互态难以稳定保留
- `main.ts` 作为总编排入口过重，UI 编排边界不清晰

## 迁移原则

- 保持现有布局和样式设计不变，优先复用已有 DOM 容器和 CSS class
- 采用“基础设施先行、面板逐个迁移”的渐进式方案，不做一次性推倒重写
- Canvas 世界渲染保持现状，Panel System 只接管 DOM UI
- 先把协议层、状态层、面板宿主层边界定义清楚，再迁移具体面板
- 每一步都保持可构建、可运行、可回退

## 总体架构

### 1. Panel Definition

每个 UI 面板注册为标准化定义，至少包含：

- `id`
- `title`
- `templateKind`
- `rootSelector`
- `defaultPlacement`
- `supports`

后续扩展项：

- `controller`
- `desktopTemplate`
- `mobileTemplate`
- `capabilities`
- `interactionPolicy`

### 2. Panel Registry

负责集中注册、查询、枚举所有面板定义。后续任何新面板都必须先进入 registry，再接入宿主。

### 3. Panel Capability

统一判断当前环境能力，而不是在各面板中自行猜测：

- viewport 宽高
- pointer coarse / fine
- hover available / unavailable
- reduced motion
- breakpoint
- 当前布局目标：`desktop` / `mobile`

### 4. Layout Profile

布局不由面板自己决定，而由宿主根据环境选择 profile：

- desktop profile
- mobile profile

profile 负责描述“哪些面板默认落在哪个区域”，而不是直接控制样式实现。

### 5. Panel System Store

统一维护 Panel System 级状态，至少包括：

- `runtime`
  - connected
  - playerId
  - mapId
  - shellVisible
- `capabilities`
- `layout`
- `panels[id].uiState`

注意：这不是游戏业务 store 的替代，而是 UI 编排层 store。

### 6. Panel Host / Overlay Host

后续引入统一宿主：

- docked panel host
- overlay host
- modal / sheet / floating host

现有 `detailModalHost` 将被逐步并入 overlay host，但短期先兼容共存。

## 阶段拆分

### 阶段 0：现状基线

目标：

- 确认当前高频刷新链路
- 确认高频面板和高风险面板
- 冻结初始迁移边界

已知优先级：

- 高频风险：`TechniquePanel`、`WorldPanel`
- 交互风险：`InventoryPanel`、`QuestPanel`、`LootPanel`
- 已有增量基础：`ActionPanel`

### 阶段 1：Panel System 基础设施

目标：

- 引入 `types / registry / layout profile / capability / store / bootstrap`
- 接入 `main.ts`
- 保持现有 UI 行为不变

交付物：

- `packages/client/src/ui/panel-system/`
- `docs/ui-panel-system-plan.md`

验收：

- `pnpm build` 通过
- 客户端现有行为不变

### 阶段 2：Panel Host 与宿主边界

目标：

- 在现有 DOM 布局之上引入面板宿主概念
- 建立区域容器和面板定义的映射关系
- 为 mobile profile 预留布局切换能力

范围：

- 不改现有视觉结构
- 先只建立宿主接口和 placement 路由

### 阶段 3：高频面板迁移

优先顺序：

1. `TechniquePanel`
2. `WorldPanel`
3. `LootPanel`

目标：

- 将高频更新从整块重建迁移为稳定 DOM + 局部 patch
- 把模板结构变化与动态值变化分层

验收：

- 修炼中功法经验推进时，功法面板不再整块重建
- 世界情报面板不因功法经验变化连带全量刷新

### 阶段 4：交互面板迁移

优先顺序：

1. `InventoryPanel`
2. `QuestPanel`
3. `AttrPanel`

目标：

- 统一列表节点复用策略
- 统一事件委托
- 统一详情弹层的数据桥接方式

验收：

- hover / focus / selection / selected item 在常规刷新下可稳定保留

### 阶段 5：多端模板与浏览器适配

目标：

- 为关键面板提供 `desktop` / `mobile` 两套模板
- 把手机浏览器上的 hover 型交互降级为 click / bottom sheet
- 建立 viewport / safe-area / pointer 能力分支

优先适配：

- action
- inventory
- quest
- loot
- settings
- minimap

### 阶段 6：清理与收口

目标：

- 缩减 `main.ts` 的 UI 直接编排职责
- 清理已废弃的重绘工具和一次性兼容逻辑
- 输出最终的面板接入规范

## 目录规划

```text
packages/client/src/ui/
  panel-system/
    bootstrap.ts
    capability.ts
    layout-profiles.ts
    registry.ts
    store.ts
    types.ts
```

后续阶段会新增：

```text
packages/client/src/ui/panels/<panel-name>/
  controller.ts
  template-desktop.ts
  template-mobile.ts
  view-model.ts
```

## 面板注册初稿

首批纳入 registry 的面板：

- `hud`
- `chat`
- `attr`
- `inventory`
- `equipment`
- `technique`
- `quest`
- `action`
- `world-map-intel`
- `world-nearby`
- `world-suggestions`
- `loot`
- `settings`
- `suggestion`
- `changelog`
- `minimap`
- `debug`

## 迁移时的硬性约束

- 不在同一阶段同时大改布局、样式和渲染机制
- 不新增新的字符串拼接式高复杂面板
- 新增 UI 逻辑优先进入 Panel System 基础设施，而不是继续塞进 `main.ts`
- 面板迁移完成前，旧实现与新基础设施必须兼容共存

## 阶段性验收标准

### 基础设施阶段

- 有统一 registry
- 有统一 capability snapshot
- 有统一 layout profile
- 有统一 panel runtime store

### 高频迁移阶段

- 关键面板不再整块 `innerHTML` 重建
- 高频状态更新可局部 patch

### 多端适配阶段

- 手机浏览器下关键交互可用
- coarse pointer 环境不依赖 hover
- 至少提供一套 mobile layout profile

## 当前执行顺序

当前开始执行：

1. 阶段 1：Panel System 基础设施
2. 接着进入阶段 2：宿主边界
3. 首个具体迁移目标：`TechniquePanel`
