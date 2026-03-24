# 仇恨机制设计文档

## 1. 目标

仇恨系统用于统一玩家自动战斗、怪物索敌、治疗拉怪、嘲讽类技能与后续基于仇恨值的技能效果。该系统替代“锁定一个目标后长时间不切换”的旧逻辑，改为持续评估周围目标的威胁，并根据仇恨排序动态切换优先目标。

本方案的设计目标：

- 所有可战斗实体共用同一套仇恨规则
- 玩家自动攻击与怪物索敌统一改为仇恨驱动
- 仇恨表与单目标仇恨值可被其他战斗逻辑直接访问
- 支持后续“按仇恨值结算技能倍率”“对全部仇恨目标生效”的技能扩展
- 保持距离口径与现有共享范围规则一致

## 2. 适用对象

当前阶段的“实体”指：

- 玩家
- 怪物

后续若加入可战斗召唤物、护卫、机关等，也应直接接入同一套接口。

## 3. 核心概念

### 3.1 仇恨表

每个实体都维护一份属于自己的仇恨表，表示“我对其他实体有多少仇恨”。

示例：

```ts
owner = 玩家A
threatTable = {
  monster:slime_1 => 1234.5,
  monster:wolf_2 => 820.2,
  player:bot_3 => 40,
}
```

含义：

- `玩家A` 当前最想攻击的是 `slime_1`
- 如果第一名变更，则 `玩家A` 的优先攻击目标也随之变更

### 3.2 目标选择

实体需要决定攻击对象时，不再依赖“之前锁定的目标”，而是：

1. 先更新仇恨表
2. 按仇恨值从高到低排序
3. 从第一名开始依次检查是否可作为当前有效攻击目标
4. 选择“仇恨最高且当前可攻击”的目标作为当前优先目标
5. 如果第一名不可攻击，则自动顺延到下一名，直到找到可攻击目标
6. 如果最终选中的目标与上次不同，则立即切换目标

这里的“当前不可攻击”包括但不限于：

- 目标已死亡
- 目标当前没有视野
- 目标虽然仍在仇恨表中，但当前无法寻路到可攻击位置
- 目标处于当前规则下不可被本实体攻击的状态

### 3.3 开战阈值

每个实体都有自己的“开战仇恨阈值”。

- 仇恨第一名未达到阈值：实体不会主动追击或攻击
- 仇恨第一名达到阈值：实体进入追击或攻击流程

该阈值用于防止低额噪声仇恨导致实体频繁抖动或误入战斗。

## 4. 数值类型

仇恨值使用 `number`。

原因：

- 需要支持小数
- 当前 JavaScript `bigint` 不适合直接参与小数乘算
- `number` 足以覆盖现阶段“几百万亿”级别的数据范围

约束：

- 所有仇恨写入前应校验 `Number.isFinite`
- 应设置统一上限常量，避免异常数据污染排序和序列化
- 仇恨值小于等于 `0` 时，从仇恨表移除该目标

## 5. 距离口径

仇恨相关距离统一使用共享层 `gridDistance`。

要求：

- 与技能范围、视野范围、自动攻击范围保持同一口径
- 当前默认配置保持圆形范围，即共享层默认欧氏距离口径
- 若未来通过共享常量切换距离规则，仇恨距离也自动同步切换

## 6. 仇恨增加

### 6.1 基础规则

仇恨增加量由“基础仇恨值 × 多个独立乘区”组成。

```ts
finalThreatDelta =
  baseThreat
  * targetExtraAggroMultiplier(target.extraAggroRate)
  * distanceThreatMultiplier(distance)
  * otherMultipliers...
```

说明：

- `baseThreat`：本次事件产生的基础仇恨值
- `target`：被写入仇恨的目标对象
- `distance`：仇恨拥有者到目标当前距离
- `otherMultipliers`：为后续技能、Buff、地图环境等保留的独立乘区

### 6.2 额外仇恨值

每个实体有一个“额外仇恨值”属性，表示“别人对我增加仇恨时的速度修正”。

这是目标自身的属性，不是仇恨拥有者的属性。

公式：

```ts
function targetExtraAggroMultiplier(extraAggroRate: number): number {
  if (extraAggroRate >= 0) {
    return 1 + extraAggroRate / 100;
  }
  return 100 / (100 - extraAggroRate);
}
```

示例：

- `0` => `1`
- `100` => `2`
- `500` => `6`
- `-100` => `0.5`
- `-300` => `0.25`

解释：

- 正数时，直接增加对应百分比
- 负数时，按递减公式降低增幅，但永远不会变成负数或归零

### 6.3 距离乘区

距离越远，本次增加的仇恨越低。

默认规则：

- 1 格内按 `100%`
- 每增加 1 格，再乘 `0.9`
- 永不归零

公式：

```ts
function distanceThreatMultiplier(distance: number): number {
  if (distance <= 1) {
    return 1;
  }
  return Math.pow(0.9, distance - 1);
}
```

示例：

- `1 格` => `1`
- `2 格` => `0.9`
- `3 格` => `0.81`
- `6 格` => `0.59049`

### 6.4 默认基础仇恨来源

当前默认基础规则：

- 对目标造成 `1` 点伤害，增加 `1` 点基础仇恨
- 对目标造成 `1` 点治疗，增加 `1` 点基础仇恨

允许小数，例如：

- 造成 `12.5` 点伤害 => 基础仇恨 `12.5`
- 造成 `8.2` 点治疗 => 基础仇恨 `8.2`

### 6.5 治疗仇恨传播

治疗仇恨需要从“敌对关系”传播，而不是只在治疗者与被治疗者之间结算。

当前建议规则：

- 当治疗者 `H` 治疗友方 `A` 时
- 所有当前将 `A` 视为敌对目标、且对 `A` 已建立仇恨或敌对关系的实体 `E`
- 都应对 `H` 增加对应基础仇恨

这样可以避免治疗者长期处于过度安全状态，并为后续群体治疗、护盾、持续治疗统一复用同一套传播逻辑。

## 7. 自动攻击与索敌

### 7.1 玩家自动攻击

玩家开启自动攻击后，每息执行：

1. 扫描索敌范围内所有合法目标
2. 对这些目标持续增加仇恨
3. 对不可见、死亡、超出有效条件的旧目标执行衰减
4. 从仇恨表中按顺序选出“当前最高可攻击目标”
5. 若第一名不可攻击，则自动顺延第二名、第三名，直到找到可攻击目标
6. 若最终选中目标达到开战阈值，则追击或攻击该目标
7. 若最终选中目标变化，则当前优先目标立即切换

这意味着玩家不会再“锁死”某个旧目标，而是持续根据实时仇恨排序动态切换。

### 7.2 怪物索敌

怪物索敌也应改为同一流程：

1. 扫描仇恨范围内可见敌对实体
2. 持续累积仇恨
3. 对失去视野或死亡的目标快速衰减
4. 按仇恨排序依次检查可攻击性
5. 若第一名不可攻击，则顺延到下一名
6. 选择最高可攻击目标作为当前目标
7. 达到阈值后追击或攻击

这样玩家与怪物不再使用两套目标选择规则。

## 8. 仇恨自然衰减

### 8.1 快速衰减场景

当目标满足以下任一条件时，不再继续追击，但也不立刻清空仇恨：

- 目标死亡
- 目标完全脱离视野

此时进入快速衰减。

### 8.2 快速衰减公式

每息减少：

- 当前仇恨值的 `10%`
- 再加上仇恨拥有者自身 `1% 最大生命值` 的固定值

公式：

```ts
decay = currentThreat * 0.1 + owner.maxHp * 0.01;
nextThreat = currentThreat - decay;
```

约束：

- 若 `nextThreat <= 0`，则直接移除该目标
- 目标被移除后，不再保留排序记录

该规则可以让实体在目标丢失后较快放弃追击，但不会立刻“失忆”。

## 9. 统一接口

仇恨系统不应只嵌在自动攻击流程中，而应抽成可复用的通用服务。

建议暴露的核心接口：

```ts
interface ThreatService {
  getThreat(ownerId: EntityId, targetId: EntityId): number;
  getThreatEntries(ownerId: EntityId): ThreatEntry[];
  getSortedThreatEntries(ownerId: EntityId): ThreatEntry[];
  getPrimaryThreatTarget(ownerId: EntityId): EntityId | null;
  getHighestAttackableThreatTarget(ownerId: EntityId): EntityId | null;
  addThreat(ownerId: EntityId, targetId: EntityId, baseThreat: number, reason: ThreatReason): number;
  setThreat(ownerId: EntityId, targetId: EntityId, value: number): void;
  clearThreat(ownerId: EntityId, targetId?: EntityId): void;
  decayThreat(ownerId: EntityId, mode: 'lost_sight' | 'dead'): void;
  retarget(ownerId: EntityId): EntityId | null;
}
```

建议的数据结构：

```ts
interface ThreatEntry {
  targetId: EntityId;
  value: number;
  lastUpdatedAt: number;
  lastVisibleAt?: number;
}
```

后续技能可直接复用这些接口，例如：

- 对全部仇恨目标造成伤害
- 按目标仇恨值比例追加技能倍率
- 将指定目标的仇恨值转移给另一目标
- 清空自身在周围敌人仇恨表中的一部分数值

## 10. 建议配置项

建议将仇恨相关默认值收敛到共享或服务端常量中：

```ts
DEFAULT_AGGRO_THRESHOLD
DEFAULT_EXTRA_AGGRO_RATE
DEFAULT_DISTANCE_THREAT_FALLOFF
DEFAULT_LOST_TARGET_THREAT_RATIO_DECAY
DEFAULT_LOST_TARGET_THREAT_FLAT_DECAY_HP_RATIO
MAX_THREAT_VALUE
```

玩家与怪物还可拥有独立配置：

- 自动索敌范围
- 开战仇恨阈值
- 额外仇恨值
- 是否允许主动建立仇恨
- 是否允许治疗传播仇恨
- 当第一仇恨目标不可攻击时是否允许自动顺延

## 11. 服务端改造范围

本方案主要影响：

- `packages/server/src/game/world.service.ts`
- `packages/server/src/game/tick.service.ts`
- `packages/server/src/game/navigation.service.ts`
- `packages/shared/src/types.ts`
- `packages/shared/src/protocol.ts`
- `packages/shared/src/constants/`

需要调整的现有逻辑：

- 玩家自动攻击
- 怪物索敌与追击
- 伤害结算后的目标锁定
- 治疗结算后的仇恨传播
- 死亡、脱视野后的目标处理

## 12. 实施计划

### 阶段 1：共享类型与常量

目标：

- 定义通用实体 ID 表达
- 在共享层加入仇恨表、仇恨条目、仇恨相关配置常量
- 补齐玩家和怪物运行态所需字段

交付物：

- `packages/shared/src/types.ts`
- `packages/shared/src/protocol.ts`
- `packages/shared/src/constants/gameplay/`

### 阶段 2：服务端仇恨服务

目标：

- 提取独立的仇恨服务或仇恨工具模块
- 实现增加、排序、衰减、获取第一目标、移除等核心能力
- 保证其他战斗逻辑可以直接访问仇恨列表

交付物：

- `packages/server/src/game/` 下新增仇恨模块

### 阶段 3：自动攻击与怪物索敌接入

目标：

- 玩家自动攻击改为仇恨驱动
- 怪物索敌与追击改为仇恨驱动
- 第一仇恨变化时动态切换目标

验收：

- 自动攻击不再长期卡死在旧目标
- 近距离高仇恨目标会自然顶掉旧目标

### 阶段 4：战斗事件接入

目标：

- 伤害结算接入仇恨增长
- 治疗结算接入仇恨传播
- 死亡、脱视野接入快速衰减

验收：

- 奶妈会被敌对实体逐步拉入仇恨表
- 目标死亡或丢失后不会瞬间失忆，但会较快掉出第一仇恨

### 阶段 5：开放接口与后续技能支持

目标：

- 暴露读取仇恨列表、读取指定目标仇恨值的统一接口
- 为后续技能提供稳定入口
- 视需要将仇恨状态同步给 GM 或调试工具

验收：

- 可以方便实现“按仇恨值增伤”“命中全部仇恨目标”等特殊技能

## 13. 当前已确认规则

- 仇恨表属于每个实体自身
- 玩家自动攻击与怪物索敌都改为仇恨驱动
- 造成 `1` 点伤害默认增加 `1` 点基础仇恨
- 造成 `1` 点治疗默认增加 `1` 点基础仇恨
- 仇恨值允许小数
- 距离口径与共享 `gridDistance` 一致
- 额外仇恨值作用于“别人对自己增加仇恨的速度”
- 距离衰减为独立乘区，默认每远 1 格再乘 `0.9`
- 目标死亡或完全脱离视野后，仇恨按“10% 当前值 + 1% 最大生命值”每息快速衰减
