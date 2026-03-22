# 地图渲染架构设计

## 1. 文档目标

本文档定义《道劫余生》客户端“游戏地图渲染子系统”的正式重构方案。

目标不是继续修补当前 `Canvas 2D + main.ts` 直连式实现，而是建立一个可长期演进的地图引擎壳，使其满足以下要求：

- 地图渲染与普通 UI 完全解耦
- 布局变化不会拉伸地图位图
- 文字地图、图片地图、特效层、小地图可以共存
- 后续替换为图片资源、增加技能特效、弹道、遮挡时不需要推倒重来
- 保留当前格子逻辑与服务端协议
- 为未来 2.5D / 斜视投影 / 人物立起来预留表现层能力

本文档是后续地图重构实施的唯一基线。后续新对话中的编码工作，应以本文档为准，不再临时拍脑袋决定架构。

## 2. 当前问题

当前客户端地图实现主要集中在以下文件：

- `packages/client/src/main.ts`
- `packages/client/src/display.ts`
- `packages/client/src/renderer/text.ts`
- `packages/client/src/ui/minimap.ts`
- `packages/client/src/ui/side-panel.ts`

现状问题如下：

1. 地图渲染、UI 布局、网络状态、输入处理大量耦合在 `main.ts`
2. 地图使用 `Canvas 2D` immediate mode，每帧直接绘制地块、文字、实体、叠加层
3. 布局折叠/展开时，地图 `canvas` 会受到 DOM 尺寸变化和 CSS 拉伸影响，导致格子变形
4. 显示参数只有 `cellSize / displayRangeX / displayRangeY` 这类全局量，不足以支撑长期扩展
5. 地图上的文字绘制高度依赖 `fillText`，不利于性能优化和后续换肤
6. 小地图与主地图共享了过多地图数据处理责任，但渲染模型并不独立
7. 当前 renderer 的职责过大，一个入口同时处理地形、路径、特效、实体、文字、选区
8. 当前实现没有为 2.5D 预留投影层，玩法坐标与视觉表现边界不够清晰

这些问题共同导致：

- 地图容易被 UI 改动误伤
- 新增视觉能力成本高
- 多浏览器表现不稳定
- 性能优化抓手不足
- 未来切图片、切特效、切投影时返工面大

## 3. 重构范围

本次架构重构只覆盖“地图子系统”，不顺手重做整站 UI。

### 3.1 包含内容

- 主地图渲染 runtime
- 视口与尺寸同步
- 相机系统
- 地图投影系统
- 地图分层渲染
- 地图交互与命中测试
- 小地图 runtime
- 文字地图与图片地图兼容主题
- 地图资源与特效入口

### 3.2 不包含内容

- 登录页重构
- 普通 panel 样式重做
- 聊天、背包、属性、任务等 DOM 结构推倒重写
- 服务端协议重构
- 服务端 AOI、tick、碰撞、寻路规则修改

## 4. 架构原则

### 4.1 玩法逻辑与视觉表现分离

服务端和客户端逻辑层继续使用格子世界坐标：

- `grid x/y`
- tile 占位
- 实体位置
- AOI
- 寻路与碰撞

视觉层不允许反过来污染玩法层。未来改成图片、改成斜视、改成人物立起来，都只允许发生在投影和渲染层。

### 4.2 地图与 UI 解耦

普通 DOM UI 只能影响地图的“可用视口范围”和“安全边界”，不能直接参与地图内部尺寸、格子尺寸、相机位置、绘制流程。

允许的输入只有：

- `viewport width/height`
- `devicePixelRatio`
- `safe area insets`
- `zoom level`

不允许的行为：

- 直接改 `canvas` CSS 让位图被拉伸
- 在 `main.ts` 中跨模块硬改地图内部状态
- 把地图状态变化绑在 panel 切换逻辑上

### 4.3 渲染器可替换

地图渲染层必须对上层暴露统一接口，底层实现可以替换：

- 第一阶段允许保留旧 `Canvas 2D` 作为兼容适配器
- 正式方案以 `PixiJS/WebGL` 为目标实现

### 4.4 文字、图片、特效共用一套视觉模型

地块、实体、叠加层不再直接写死为“只能画字”或“只能画图”，而是统一走 `Theme + VisualSpec`。

### 4.5 小地图独立渲染

小地图不是主地图截图，不共享主地图 render tree。主地图与小地图共享数据源，但运行时独立。

## 5. 总体架构

建议新增独立目录：

```text
packages/client/src/game-map/
  runtime/
  store/
  viewport/
  camera/
  projection/
  scene/
  renderer/
  layers/
  assets/
  interaction/
  minimap/
  compat/
```

总体数据流如下：

```text
socket/init/tick/patch
  -> MapStore
  -> MapScene
  -> RendererAdapter
  -> 主地图视图

UI layout change
  -> ViewportController
  -> CameraController / Render resize

Mouse / keyboard / touch
  -> InteractionController
  -> Overlay update / send command

MapStore
  -> MinimapRuntime
  -> 小地图视图
```

## 6. 模块设计

### 6.1 MapRuntime

地图子系统总入口，负责：

- 挂载地图宿主节点
- 初始化 renderer
- 连接 store / viewport / camera / interaction / minimap
- 驱动地图 render loop
- 处理地图子系统销毁

对外接口建议固定为：

```ts
interface MapRuntimeApi {
  attach(host: HTMLElement): void;
  detach(): void;
  destroy(): void;

  setViewportSize(width: number, height: number, dpr: number): void;
  setSafeArea(insets: { top: number; right: number; bottom: number; left: number }): void;
  setZoom(level: number): void;
  setProjection(mode: 'topdown' | 'oblique'): void;

  setSnapshot(snapshot: MapSnapshot): void;
  applyPatch(patch: MapPatch): void;

  setPlayerFocus(x: number, y: number): void;
}
```

约束：

- `main.ts` 以后只能持有 `MapRuntimeApi`
- 不允许主入口继续直接操作 renderer、camera、display metrics

### 6.2 MapStore

负责维护地图世界状态，是地图子系统唯一可信数据入口。

职责：

- 维护 tile、entity、effect、marker、visible set、memory set
- 吃服务端 `init/tick/patch`
- 为场景层输出标准化快照
- 为小地图输出简化快照

不负责：

- DOM
- Pixi/Canvas
- 鼠标事件
- 相机

### 6.3 ViewportController

负责处理地图宿主真实可用尺寸。

职责：

- 接 `ResizeObserver`
- 管理 `width / height / dpr`
- 管理 `safe area`
- 计算逻辑视口和渲染视口
- 控制 backbuffer resize

约束：

- 地图位图尺寸只能通过这里变更
- 禁止依赖 CSS 拉伸主地图内容

### 6.4 CameraController

相机系统必须独立于 UI。

职责：

- 跟随玩家
- 平滑移动
- snap 到玩家
- 根据 safe area 修正视觉中心
- 响应 zoom anchor
- 为未来 oblique/2.5D 投影提供偏移能力

关键点：

- 屏幕中心不再等于地图逻辑中心
- 当左栏/右栏/下栏折叠变化时，只改变 safe area 和 camera target，不改变渲染规则

### 6.5 Projection

投影层是未来 2.5D 的基础。

建议定义：

```ts
interface MapProjection {
  worldToScreen(x: number, y: number, elevation?: number): { x: number; y: number };
  screenToWorld(x: number, y: number): { x: number; y: number };
  getSortKey(node: RenderNode): number;
}
```

第一阶段实现：

- `TopdownProjection`

预留实现：

- `ObliqueProjection`

规则：

- 游戏规则层永远不用屏幕坐标
- 任何“人物立起来”“墙体有立面”“树木遮挡”都只能通过投影和排序实现

### 6.6 MapScene

场景层将 `MapStore` 输出的数据转成可渲染节点。

职责：

- 维护 render node 集合
- 管理层级树
- 管理 dirty 标记
- 管理排序和可见性

`MapScene` 不关心底层是 Pixi 还是 Canvas，只关心：

- 当前有哪些节点
- 节点属于哪一层
- 节点是否需要重建或更新

### 6.7 RendererAdapter

屏蔽底层渲染实现差异。

建议接口：

```ts
interface RendererAdapter {
  mount(host: HTMLElement): void;
  unmount(): void;
  destroy(): void;

  resize(width: number, height: number, dpr: number): void;
  render(scene: MapScene, camera: CameraState, projection: MapProjection): void;
}
```

实现分两类：

- `LegacyCanvasTextRendererAdapter`
- `PixiMapRendererAdapter`

第一阶段允许旧文字地图先跑在兼容适配器中。后续切 `Pixi` 时，上层结构不变。

## 7. 渲染分层

地图正式渲染必须拆层，至少包含：

### 7.1 TerrainLayer

地形底图层：

- 地板
- 草地
- 水面
- 墙
- 门
- 楼梯
- 路径基础地貌

特点：

- 静态程度最高
- 优先做 chunk 缓存

### 7.2 DecalLayer

地面装饰层：

- 法阵
- 痕迹
- 血迹
- 脚印
- 路径烙印

### 7.3 EntityLayer

实体层：

- 玩家
- 怪物
- NPC
- 掉落包

特点：

- 支持排序
- 支持 sprite / glyph / hybrid 三种表现
- 后续人物立起来优先改这里

### 7.4 EffectLayer

特效层：

- 技能施法特效
- 命中闪光
- 弹道
- 飘字
- 粒子

### 7.5 OverlayLayer

交互叠加层：

- hover 格
- 选中格
- 路径预览
- 技能范围
- AOI 调试
- 操作提示框

### 7.6 FogLayer

迷雾层：

- 当前可见
- 已探索未可见
- 未探索

### 7.7 MarkerLayer

标记层：

- 任务点
- 队友点
- 特殊兴趣点
- 指路标识

## 8. 文字地图与图片地图兼容

当前地图上大量视觉元素是文字，不能在重构时粗暴移除。

因此需要统一视觉主题接口。

建议：

```ts
interface TileVisualSpec {
  mode: 'glyph' | 'sprite' | 'stack';
  glyph?: {
    char: string;
    fontKey: string;
    color: string;
    background?: string;
  };
  sprite?: {
    texture: string;
    frame: string;
  };
  overlay?: {
    texture: string;
    frame: string;
  };
}

interface EntityVisualSpec {
  mode: 'glyph' | 'sprite' | 'hybrid';
  glyph?: {
    char: string;
    fontKey: string;
    color: string;
  };
  sprite?: {
    texture: string;
    frame: string;
    anchorX?: number;
    anchorY?: number;
  };
}
```

在此基础上支持三套主题：

1. `legacy-text-theme`
2. `mixed-theme`
3. `full-sprite-theme`

其中：

- `legacy-text-theme` 用于兼容现有文字地图
- `mixed-theme` 用于过渡阶段
- `full-sprite-theme` 用于正式图片化表现

## 9. 文字渲染策略

地图上的文字不应长期依赖 `CanvasRenderingContext2D.fillText()`。

正式方案：

- 常用地图字形使用 bitmap font 或 atlas
- 数字、状态、伤害字也纳入 atlas
- 地图文字绘制尽量转为批处理节点

这样做的收益：

- 提升性能
- 缩放更稳定
- 更容易描边、发光、发色、阴影
- 更容易从字形地图迁移到图片地图

## 10. 小地图设计

小地图必须是共享数据源、独立渲染器的子系统。

### 10.1 原则

- 不截主地图画面
- 不缩放主地图 `canvas`
- 不共享主地图 render tree
- 只共享 `MapStore` 提供的数据

### 10.2 小地图需要消费的数据

- 地图记忆快照
- 当前 AOI 范围
- 玩家位置
- 任务与标记点
- 当前主地图视口框

### 10.3 小地图独立模块

建议目录：

```text
packages/client/src/game-map/minimap/
  minimap-runtime.ts
  minimap-scene.ts
  minimap-renderer.ts
  minimap-projection.ts
```

### 10.4 小地图能力

- 常驻迷你小地图
- 展开后的大地图
- 标记筛选
- 记忆区域与当前可见区域区分
- 主地图视口框显示

## 11. 交互设计

地图交互统一收口到 `InteractionController`。

负责：

- hover tile
- click move
- click target
- click inspect
- path preview
- 技能选区预览
- 屏幕坐标命中测试

这样做的意义：

- 主地图交互逻辑不再散落在 `main.ts`
- 未来加触摸、长按、拖拽框选时不会污染渲染器

## 12. 性能设计

### 12.1 渲染与逻辑解耦

- 服务端 tick 继续保持现有协议模式
- 客户端地图渲染走自己的 frame loop
- 相机、动画、飘字、特效独立于服务端 tick 展示

### 12.2 静态地形分块缓存

地图地形应按 chunk 组织，例如：

- `16x16`
- `32x32`

每个 chunk：

- 独立缓存
- 仅地形变化时重建
- 平时只平移和裁剪

### 12.3 动态层独立更新

实体、特效、overlay 不得与地形一起全量重建。

### 12.4 对象池

以下对象必须考虑池化：

- 飘字
- 特效实例
- 路径高亮格
- 技能范围框
- hover/selection 标记

### 12.5 DPR 管控

地图 runtime 应支持最大 DPR 限制，避免高像素比设备无脑把渲染成本拉爆。

### 12.6 脏区与补丁

服务端 patch 到来后，只允许更新受影响对象，不允许每次 tick 全量重建整张地图缓存。

## 13. 2.5D 预留

未来如果把纯俯视 2D 改成 2.5D，要求不重写玩法逻辑。

为此必须提前满足：

1. 投影独立
2. 节点排序独立
3. 实体锚点独立
4. 地形视觉与逻辑格子分离
5. 层级遮挡能力存在

未来 2.5D 的变化主要应集中在：

- `projection`
- `theme`
- `entity visual`
- `terrain visual`
- `sort rule`

不应扩散到：

- 协议
- 寻路
- 服务端碰撞
- AOI
- tick 规则

## 14. 迁移原则

迁移必须是“分层替换”，不能一次性推倒主客户端。

### 14.1 第一原则

先建立新地图 runtime 壳，再把旧逻辑一点点迁进去。

### 14.2 第二原则

旧 `TextRenderer` 不立刻删除，而是先降级为兼容适配器。

### 14.3 第三原则

小地图重构必须共享数据源，但和主地图 runtime 分离。

### 14.4 第四原则

在新地图 runtime 接管前，不允许继续往旧 `main.ts + text.ts` 地图链路中新增复杂视觉能力。

## 15. 验收标准

地图渲染架构重构完成后，必须满足以下验收项：

1. 折叠、展开、拖拽 panel 时，主地图不会被 CSS 拉伸
2. 地块不会从正方形失真成长方形
3. 地图运行时与 DOM UI 生命周期解耦
4. 文字地图继续可用
5. 小地图独立工作，不依赖主地图截图
6. 可以在不改玩法协议的前提下替换为图片地块与图片实体
7. 可以无侵入增加路径高亮、范围预览、弹道、命中特效、飘字
8. 为未来 2.5D 保留投影与排序扩展点

## 16. 本次实施边界

后续实现时，以“先建立地图 runtime 和模块边界”为第一优先级。

以下行为视为偏离方案：

- 继续把地图修补逻辑写回 `main.ts`
- 继续用 CSS 尺寸变化直接驱动主地图显示效果
- 把图片化、特效化写死在某个单一 renderer 文件里
- 让小地图和主地图互相共享渲染器内部状态

## 17. 结论

本项目后续不应再把游戏地图当成“页面中的一块 canvas”，而应视为“客户端中的独立游戏渲染子系统”。

普通 UI 是围绕地图引擎组织的外壳；地图本身必须拥有自己的：

- runtime
- viewport
- camera
- projection
- scene
- renderer
- minimap
- interaction
- theme

只有这样，当前的文字格子地图、后续的图片地图、特效层、小地图，以及未来的 2.5D 表现，才能在同一套基础设施上稳定演进。
