# 道劫余生 全面审计报告

> 审计时间：2026-03-22
> 审计范围：全项目（服务端、客户端、共享层、DevOps、数据配置）
> 审计方式：13 个专项 agent 并行审计，team-lead 汇总去重

---

## 一、问题统计

| 严重程度 | 数量 |
|----------|------|
| 高       | 18   |
| 中       | 30   |
| 低       | 25   |
| **合计** | **73** |

---

## 二、高严重度问题（18 项）

### 安全类

**H-01. JWT Secret 硬编码回退值**
- 文件：`packages/server/src/auth/auth.module.ts:16`
- 问题：`secret: process.env.JWT_SECRET || 'daojie-yusheng-dev-secret'`，生产环境若未设置环境变量，任何人可伪造 JWT。
- 修复：启动时强制要求 `JWT_SECRET` 存在，不提供回退值。

**H-02. GM 默认密码为 `admin123`**
- 文件：`packages/server/src/auth/auth.service.ts:214`
- 问题：`GM_PASSWORD` 未设置时回退到 `admin123`，`docker-stack.yml:39` 的默认值也是 `admin123`。
- 修复：首次启动强制设置 GM 密码，或生成随机密码打印到日志。

**H-03. WebSocket GM 操作无权限校验**
- 文件：`packages/server/src/game/game.gateway.ts:463-473`
- 问题：`handleGmMarkSuggestionCompleted` 和 `handleGmRemoveSuggestion` 无任何 GM 身份校验，任意已登录玩家可执行。
- 修复：增加 GM 身份校验，或移至 HTTP GM 控制器使用 `GmAuthGuard`。

**H-04. 登录/注册接口无速率限制**
- 文件：`packages/server/src/auth/auth.controller.ts:23-49`
- 问题：`/auth/login`、`/auth/register`、`/auth/gm/login` 均无 throttle，可被暴力破解。
- 修复：使用 `@nestjs/throttler` 对认证端点添加速率限制。

**H-05. CORS 完全开放**
- 文件：`packages/server/src/main.ts:77`
- 问题：`app.enableCors()` 无参数，等同于 `Access-Control-Allow-Origin: *`。
- 修复：配置明确的 origin 白名单。

**H-06. docker-compose.yml 硬编码密钥和数据库密码**
- 文件：`docker-compose.yml:5-7,35-36,39-42`
- 问题：`JWT_SECRET`、`GM_PASSWORD`、`POSTGRES_PASSWORD` 直接硬编码在版本控制文件中。
- 修复：改为引用环境变量 `${VAR}`，本地通过 `.env` 注入。

**H-07. .env 文件包含真实凭据且已被 git 跟踪**
- 文件：`packages/server/.env`
- 问题：包含 `DB_PASSWORD=jiuzhou123` 等真实凭据，已在 git 历史中。
- 修复：`git rm --cached`，提供 `.env.example`，轮换已泄露密码。

### 数据安全类

**H-08. `synchronize: true` 生产环境数据丢失风险**
- 文件：`packages/server/src/database/database.module.ts:25,37`
- 问题：TypeORM 启动时自动修改表结构，字段重命名/删除会导致数据丢失。
- 修复：生产环境使用 migration，`synchronize` 仅开发环境启用。

**H-09. Redis 缓存无 TTL，崩溃后残留脏数据**
- 文件：`packages/server/src/database/redis.service.ts:36-63`
- 问题：`setPlayer` 无过期时间，进程崩溃后 Redis 残留过期状态，重启无清理。
- 修复：设置 TTL（如 5 分钟）并在启动时清理 `player:*` 键。

**H-10. `persistAll` 批量落盘无事务保护**
- 文件：`packages/server/src/game/player.service.ts:257-295`
- 问题：`playerRepo.save(entities)` 逐条 upsert 不在同一事务中，中途失败导致部分写入。
- 修复：使用 `queryRunner` 开启事务包裹批量写入。

**H-11. 断线保留期过期后玩家数据可能未落盘**
- 文件：`packages/server/src/game/player.service.ts:396-403`
- 问题：`clearExpiredRetainedSessions` 仅删除条目不触发 `savePlayer`，若断线时存盘失败则数据丢失。
- 修复：过期时做兜底 `savePlayer`。

### 代码缺陷类

**H-12. `ensureMapTicks()` 方法体为空**
- 文件：`packages/server/src/game/tick.service.ts:571-572`
- 问题：方法大括号未闭合，实际为空操作。新地图永远不会自动启动 tick 循环。
- 修复：补全实现，遍历所有地图 ID 并调用 `startMapTick()`。

**H-13. SettingsPanel.open() 死代码导致设置面板完全失效**
- 文件：`packages/client/src/ui/panels/settings-panel.ts:44-46`
- 问题：`open()` 方法第 45 行有裸 `return;`，后续所有逻辑不可达。
- 修复：删除该 `return;`。

**H-14. dropItem count 为 NaN 时导致物品槽位永久异常**
- 文件：`packages/server/src/game/inventory.service.ts:46-56`
- 问题：`count <= 0` 无法拦截 NaN，`item.count -= NaN` 导致物品数量变为 NaN。
- 修复：`if (!Number.isFinite(count) || count <= 0) return null`。

**H-15. C2S 消息几乎无输入验证**
- 文件：`packages/server/src/game/game.gateway.ts:217-385`
- 问题：`slotIndex`、`count`、`direction`、`x/y` 等均未校验类型和范围，可发送 NaN、负数、非法枚举值。
- 修复：在 gateway 层对所有 C2S payload 做基本类型和范围校验。

**H-16. S2C_Init 泄露完整 PlayerState 给客户端**
- 文件：`packages/server/src/game/game.gateway.ts:434`
- 问题：`sendInit` 直接发送完整 `PlayerState`，包含 `combatTargetId`、`idleTicks`、`temporaryBuffs` 等服务端内部字段。
- 修复：构建精简的 `S2C_Init.self` 对象，过滤内部状态。

**H-17. InputThrottle 已定义但从未使用**
- 文件：`packages/client/src/input/throttle.ts`（整个文件）
- 问题：客户端对服务端的操作频率没有任何限制，玩家可高频发送 move/moveTo 事件。
- 修复：在 `main.ts` 中实例化 `InputThrottle`，在发送操作前检查 `canAct()`。

**H-18. `ratioValue` 负值分支逻辑不对称**
- 文件：`packages/shared/src/numeric.ts:374-375`
- 问题：正值走收益递减曲线 `value/(value+divisor)`，负值走线性 `-value/divisor`，负值结果可超出 [-1,0) 范围。
- 修复：确认负值是否需要对称曲线，或在调用侧保证不传入负值。

---

## 三、中严重度问题（30 项）

### 安全与认证

**M-01.** Access Token 和 Refresh Token 无类型区分，可互换使用 — `auth.service.ts:185-195`
**M-02.** Refresh Token 30 天有效期且无吊销机制 — `auth.service.ts:193`
**M-03.** 注册流程竞态条件（查重与创建之间无锁）— `auth.service.ts:58-73`
**M-04.** GM 面板建议列表 Stored XSS（title/description/authorName 未转义）— `gm-panel.ts:102-105`
**M-05.** GM 面板玩家列表 XSS（player.name/mapId 未转义）— `gm-panel.ts:311-319`
**M-06.** GM 后台 onclick 注入风险 — `gm.ts:264-265`
**M-07.** 建议系统缺少服务端输入长度/频率限制 — `suggestion.service.ts:49-63`
**M-08.** GM 操作无审计日志 — `gm.service.ts` / `gm.controller.ts` 全文件
**M-09.** GM Token 存储在 sessionStorage，XSS 可窃取 — `gm.ts:32,120`

### 并发与状态一致性

**M-10.** tick 循环与 WebSocket 消息处理之间的竞态条件（async 让出点导致状态不一致窗口）— `game.gateway.ts` + `tick.service.ts`
**M-11.** `persistAll` 与 tick 循环并发修改玩家状态 — `tick.service.ts:113-120`
**M-12.** 地图热重载期间状态不一致（不清理占位信息）— `map.service.ts:372-386`
**M-13.** `resetPlayerToSpawn` 跨地图移动不触发目标地图 tick 启动 — `world.service.ts:1208-1235`

### 网络与协议

**M-14.** 客户端无自动重连机制 — `socket.ts:37-71`
**M-15.** S2C_Init 未经 Protobuf 编码（最大的单次下发包）— `network-protobuf.ts:281-286`
**M-16.** 聊天消息绕过 tick 队列直接广播 — `game.gateway.ts:387-408`
**M-17.** 建议系统广播使用 `server.emit` 绕过流量统计 — `game.gateway.ts:476-479`
**M-18.** 命令队列去重可能丢弃有效操作（同 tick 内不同 action 只保留最后一条）— `player.service.ts:438-447`
**M-19.** `fromWireNumericStats` 缺少字段校验，可能导致 NaN 传播 — `network-protobuf.ts:376-395`

### 性能

**M-20.** renderWorld 中每格子频繁切换 Canvas 状态（ctx.font 尤其昂贵）— `text.ts:197-291`
**M-21.** 每帧重复调用 setPathHighlight 重建 Set/Map — `main.ts:1945`
**M-22.** 每帧冗余调用 syncDisplayMetrics 和 camera.follow — `main.ts:1928-1930`
**M-23.** MouseInput 每次 mousemove 调用 getBoundingClientRect — `mouse.ts:58`
**M-24.** 大量 `JSON.parse(JSON.stringify(...))` 深拷贝 — 多处
**M-25.** `isStructuredEqual` 使用 JSON.stringify 比较 — `tick.service.ts:1249-1251`
**M-26.** `getUserIdByPlayerId` 线性扫描 — `player.service.ts:351-358`

### 代码质量

**M-27.** escapeHtml 函数在 10+ 个文件中重复定义 — 多处
**M-28.** TILE_TYPE_NAMES / ATTR_LABELS / NUMERIC_STAT_LABELS 多处重复定义 — `main.ts`、`minimap.ts`、`skill-tooltip.ts`、`technique-panel.ts`
**M-29.** 多处 window keydown 监听器存在 Escape 键优先级竞争 — 涉及 6 个文件
**M-30.** SuggestionPanel 构造函数接收 `socket: any` 弱类型 — `suggestion-panel.ts:12`

### 数值平衡

以下为数值设计确认项，不一定是 bug：
- 暴击伤害公式中 critDamage 除以 10 与 `rate_bp` 标注不一致 — `world.service.ts:1836`
- 防御减伤使用固定 divisor=100 而非境界缩放 — `world.service.ts:1828`
- 霜痕起手技 spellAtk scale 1.9 偏高（同品阶对比 1.05）— `advanced.json:513`
- 寒月印终结技 spellAtk scale 2.6 偏高（同品阶对比 1.65）— `advanced.json:628`

---

## 四、低严重度问题（25 项）

### DevOps

**L-01.** Dockerfile 使用 `pnpm@latest` 不固定版本 — `Dockerfile:2`
**L-02.** Dockerfile install 回退逻辑（`--frozen-lockfile || pnpm install`）— `Dockerfile:8`
**L-03.** Server Dockerfile 复制完整 node_modules 含 devDependencies — `Dockerfile:18`
**L-04.** 健康检查仅返回静态 OK，未检测 DB/Redis — `health.controller.ts:9-16`
**L-05.** deploy.yml 未在构建前运行测试或类型检查
**L-06.** .gitignore 未排除 `data/runtime/` 运行时状态文件
**L-07.** .dockerignore 未排除 `data/runtime/` 目录
**L-08.** start.sh trap 位置靠后 — `start.sh:54`
**L-09.** 根 `package.json` 缺少 `packageManager` 字段

### 安全

**L-10.** 无 HTTP 安全头（Helmet）— `main.ts`
**L-11.** Redis 连接无认证 — `redis.service.ts:17-25`
**L-12.** 数据库默认凭据 `postgres/postgres` — `database.module.ts:32-35`
**L-13.** 用户名最小长度仅 1 个字符 — `account-validation.ts:6`
**L-14.** 聊天消息无服务端频率限制 — `game.gateway.ts:387-408`
**L-15.** 建议投票无频率限制 — `game.gateway.ts:454-461`

### 代码质量

**L-16.** PlayerEntity jsonb 字段类型过于宽松（`unknown[]`）— `player.entity.ts:56-96`
**L-17.** `createPlayer`/`savePlayer` 中约 36 处 `as any` — `player.service.ts`
**L-18.** Redis 连接失败不阻止服务启动 — `redis.service.ts:26-28`
**L-19.** `AuthGuard` 已定义但未被 Gateway 使用 — `auth.guard.ts`
**L-20.** 客户端 main.ts 约 20 个模块级全局变量无封装 — `main.ts:1203-1234`
**L-21.** 缺少全局 ExceptionFilter — 整个服务端
**L-22.** IRenderer 接口与 TextRenderer 实现不完全匹配 — `types.ts:45` vs `text.ts:581`
**L-23.** `sendDebugResetSpawn` 发送了两次请求 — `socket.ts:160-163`
**L-24.** viewCenterX/viewCenterY 是死代码 — `main.ts:1934-1939`
**L-25.** `TECHNIQUE_GRADE_ATTR_DECAY_K` 常量已定义但未使用 — `technique.ts:64`

### 数据配置

- books.json 物品 ID 命名不一致（`book.xxx` vs `book_xxx`）
- consumables.json 治疗药品 itemId 前缀不一致
- breakthroughs.json 缺少 realmLv 17→18 的突破配置
- breakthroughs.json 与 PLAYER_REALM_CONFIG 存在两套突破体系
- 功法最后一层 expFactor=0 的约定未文档化
- Buff 价值计算未考虑 maxStacks
- `QuestState` 同时有 `rewardItemId`、`rewardItemIds`、`rewards` 三个奖励字段

---

## 五、架构层面总评

### 优点
- Monorepo 结构清晰，shared 包统一管理协议和常量
- 服务端 tick 驱动架构合理，命令队列 + 统一广播
- AOI 视野管理、增量同步完善
- 认证流程完整（注册/登录/刷新/顶号）
- 地图热重载机制实用
- 客户端不做任何游戏规则判定，防作弊做得好
- NestJS 模块组织层次清晰，无循环依赖

### 主要技术债务
- 3 个 God File/Service：WorldService（2934 行）、MapService（2161 行）、client/main.ts（1966 行）
- TickService 注入 16 个依赖，单个 tick() 方法超 350 行
- tick 循环中大量 JSON 序列化深拷贝/比较是性能瓶颈
- 公共函数/常量（escapeHtml、ATTR_LABELS 等）在 10+ 个文件中重复定义

---

## 六、修复优先级建议

### P0 — 立即修复（安全漏洞 + 功能缺陷）
1. WebSocket GM 操作无鉴权（H-03）
2. C2S 输入验证 + NaN 物品复制漏洞（H-14、H-15）
3. JWT Secret / GM 密码硬编码（H-01、H-02、H-06、H-07）
4. `ensureMapTicks()` 方法体为空（H-12）
5. SettingsPanel.open() 死代码（H-13）

### P1 — 短期修复（数据安全 + 稳定性）
1. `synchronize: true` 改为 migration（H-08）
2. Redis TTL + 启动清理（H-09）
3. `persistAll` 事务保护（H-10）
4. 登录速率限制（H-04）
5. CORS 白名单（H-05）
6. GM 面板 XSS 修复（M-04、M-05）

### P2 — 中期优化（性能 + 代码质量）
1. 渲染热路径优化（Canvas 状态批量切换、pathHighlight 脏标记）
2. tick 循环中 JSON 深拷贝替换为 structuredClone
3. escapeHtml / 标签常量统一抽取
4. God File/Service 拆分
5. 客户端重连机制

### P3 — 长期改进
1. S2C_Init Protobuf 编码
2. 统一键盘事件分发层
3. 全局 ExceptionFilter
4. 数据配置命名规范统一
