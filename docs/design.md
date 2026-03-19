# 游戏设计文档

## 1. 核心玩法

格子制 MMO MUD。世界由多张二维格子地图组成，玩家在格子上移动、交互。
所有逻辑服务端权威，客户端只负责渲染和输入。

## 2. 地图系统

- 世界由多张 Map 组成，每张 Map 是一个二维格子数组
- 格子类型：地面、墙壁、门、传送点等（后续扩展）
- 玩家不可重叠：一个格子同时只能站一个玩家
- 地图间通过传送点连接

### 地图数据（当前实现）
- 地图以 JSON 文件存储（`tiles` + `portals` + `spawnPoint`），服务启动时加载到内存
- Redis 当前只缓存玩家状态，不作为地图运行层数据源
- `portals` 支持跨图传送：玩家移动到 portal 坐标后，在同 tick 内完成目标地图落点校验与传送
- 地图内容字段已扩展：`dangerLevel`、`recommendedRealm`、`npcs`、`monsterSpawns`、`landmarks`

### 地图推进路线（当前内容）
- 主线：`云来镇(spawn)` → `青竹林(bamboo_forest)` → `玄铁矿洞(black_iron_mine)` / `断碑遗迹(ancient_ruins)` → `噬魂兽谷(beast_valley)`
- 侧线：`云来镇(spawn)` ↔ `荒野(wildlands)`，并可从荒野转入青竹林
- 危险梯度参考（类似 CDDA 分层推进）：
- `dangerLevel 1-2`：新手试炼区（镇内/林地）
- `dangerLevel 3`：资源与任务压力区（矿洞/遗迹）
- `dangerLevel 5`：高压战斗区（兽谷，包含王级怪刷新）

### 地形自动恢复
- 该能力尚未实现（保留为后续规划）

### 地图数据结构
```
Map {
  id: string
  name: string
  width: number
  height: number
  baseTiles: Tile[][]    // 基础层（只读模板）
  tiles: Tile[][]        // 运行层（实时状态）
  entities: Entity[]     // 地图上的实体（NPC、物品等）
  dangerLevel: number    // 风险等级（1-5）
  recommendedRealm: string
  npcs: NpcDef[]
  monsterSpawns: MonsterSpawnDef[]
  landmarks: Landmark[]
}

Tile {
  type: TileType         // 地形类型枚举
  walkable: boolean      // 是否可通行
  occupiedBy: string?    // 占用该格子的玩家ID（null表示空）
  modifiedAt: number?    // 被玩家修改的时间戳（null表示未修改）
}

NpcDef {
  id: string
  name: string
  x: number
  y: number
  char: string
  color: string
  role: string
  dialogue: string
  quests?: QuestDef[]
}

MonsterSpawnDef {
  id: string
  name: string
  x: number
  y: number
  radius: number
  maxAlive: number
  respawnSec: number
  level: number
  hp: number
  attack: number
  drops: DropDef[]
}

QuestDef {
  id: string
  title: string
  desc: string
  targetMonsterId: string
  targetCount: number
  reward: ItemStack[]
}
```

## 3. Tick 系统

服务端以 1Hz（每秒一次）运行 tick 循环，每张地图独立 tick。

### 单次 Tick 流程
1. 收集该 tick 内所有玩家的操作指令（每人最多1条）
2. 按优先级/时间戳排序
3. 依次执行指令，校验合法性（碰撞、边界、portal 传送目标校验等）
4. 计算状态变更
5. 向各玩家推送其视野范围内的变更（AOI）

### 操作限流
- 每个玩家每 tick 只处理一条指令
- 多条指令取最后一条（覆盖）
- 客户端做输入节流，服务端做最终校验

## 4. AOI（兴趣区域）

玩家只接收视野范围内的信息，降低带宽和客户端渲染压力。

- 视野范围：以玩家为中心的矩形区域（如 25x25 格）
- 玩家移动时重新计算 AOI
- 进入/离开视野的实体触发 appear/disappear 事件

## 5. 账号与角色系统

### 注册
- 用户名 + 密码（bcrypt 哈希存储）
- 用户名唯一性校验
- 注册成功后自动创建唯一角色（一个账号对应一个角色）

### 登录
- 验证用户名密码
- 签发 JWT token（含 userId、characterId）
- token 存储在客户端 localStorage，关闭浏览器后仍有效
- 建立 WebSocket 连接时携带 token 认证

### Token 策略
- Access Token：短有效期（如 15min），用于 WebSocket 认证
- Refresh Token：长有效期（如 30 天），存 localStorage，用于自动续签 Access Token
- 客户端打开时先用 Refresh Token 换取新 Access Token，再建立 WebSocket 连接
- Token 失效场景（需重新登录）：
  - 服务器重启导致密钥轮换
  - 用户修改密码（服务端使该用户所有 Refresh Token 失效）
  - 被顶号（旧连接断开，但 token 本身不失效，重连后触发顶号流程）
  - Refresh Token 过期

### 断线重连（Session 恢复）
- JWT 有效期内，客户端断线后可直接用原 token 重新建立 WebSocket 连接，无需重新登录
- 服务端在玩家断线后保留其角色状态一段时间（如 120s），期间重连可无缝恢复
- 超过保留时间，角色下线，重连后重新加载角色数据进入地图

### 顶号（Kick）
- 同账号新连接建立时，服务端向旧连接发送 kick 事件
- 旧连接收到后断开
- 新连接接管角色状态
- 旧连接的未处理操作丢弃

## 6. 通信协议

基于 Socket.IO，使用事件名 + JSON payload。

### 客户端 → 服务端
| 事件 | 说明 |
|------|------|
| `c:move` | 移动指令 `{ d: 0/1/2/3 }` |
| `c:action` | 动作指令 {type, target?} |
| `c:chat` | 聊天消息 {message} |
| `c:useItem` | 使用背包物品 `{slotIndex}` |
| `c:dropItem` | 丢弃物品 `{slotIndex, count}` |
| `c:equip` | 装备物品 `{slotIndex}` |
| `c:unequip` | 卸下装备 `{slot}` |
| `c:cultivate` | 设置/停止修炼 `{techId|null}` |

### 服务端 → 客户端
| 事件 | 说明 |
|------|------|
| `s:init` | 连接初始化（角色、地图、初始视野） |
| `s:tick` | tick 更新 `{p,t,e,v?,dt?}` |
| `s:kick` | 被顶号通知 |
| `s:error` | 错误信息 {code, message} |
| `s:attrUpdate` | 属性更新 |
| `s:inventoryUpdate` | 背包更新 |
| `s:equipmentUpdate` | 装备更新 |
| `s:techniqueUpdate` | 功法更新 |
| `s:actionsUpdate` | 行动列表更新 |
| `s:systemMsg` | 文本消息（系统/聊天） |

说明：
- `s:enter`、`s:leave`、`s:dead`、`s:respawn` 仍在协议中保留为预留事件，当前版本默认不发送。

## 7. 渲染层

抽象为 IRenderer 接口，支持替换。

### IRenderer 接口
```
interface IRenderer {
  init(canvas: HTMLCanvasElement): void
  renderMap(viewport: Viewport, tiles: Tile[][]): void
  renderEntities(entities: RenderEntity[]): void
  renderUI(uiState: UIState): void
  destroy(): void
}
```

### 当前实现：TextRenderer
- 每个格子渲染为一个字符（@ 玩家、# 墙、. 地面等）
- 使用 Canvas fillText 绘制等宽字符
- 不同实体用不同颜色区分

### 后期：SpriteRenderer
- 每个格子渲染为一张贴图
- 实现同一 IRenderer 接口，无缝切换

## 8. 数据持久化

### PostgreSQL（持久数据）
- 账号表：用户名、密码哈希、创建时间
- 角色表：所属账号、名称、所在地图、坐标、属性
- 地图表：地图元数据和地形数据

### Redis（实时缓存）
- 在线玩家状态快照（位置、HP、属性、背包、装备、功法等）
- 作为旁路缓存使用，不作为地图运行层的唯一真相源
- 当前实现的定时落盘来源为服务端内存态玩家数据（同时写 PostgreSQL）

## 9. 死亡与复活系统

### 死亡
- 玩家 HP 归零时判定死亡
- 死亡后角色变为尸体状态，留在原地（其他玩家可见）
- 尸体不占据格子，其他玩家/实体可以通行

### 复活
- 死亡后 10 秒内强制等待（不可操作）
- 10 秒后弹出选择：
  - **原地复活**：仅当尸体所在格子无其他玩家/实体时可选，否则置灰
  - **复活点复活**：传送到当前地图的复活点，损失当前等级 10% 经验
- 复活后 HP 恢复为最大值的 50%
- 尸体在玩家复活或下线后消失
