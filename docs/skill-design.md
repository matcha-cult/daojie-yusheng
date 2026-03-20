# 技能数值设计规范

本文用于约束技能、Buff、装备词条里的数值写法，避免出现某个属性一旦进入技能公式就明显超标的情况。后续新增或调整技能时，默认先对照本文。

## 1. 伤害公式总原则

- 技能伤害优先拆成两段：`固定基础段 + 常规属性段`，必要时再叠加单独机制段。
- 高价值属性不能直接按原值线性加到伤害里，尤其是移速、目标最大生命值这类容易失控的来源。
- 能做乘区的属性尽量做乘区，能做展示比例的属性尽量展示比例，不直接伪装成稳定平A数值。

推荐模板：

```json
{
  "op": "mul",
  "args": [
    {
      "op": "add",
      "args": [
        20,
        { "var": "techLevel", "scale": 2.4 },
        { "var": "caster.stat.physAtk", "scale": 1.0 }
      ]
    },
    {
      "op": "add",
      "args": [
        1,
        { "var": "caster.stat.moveSpeed", "scale": 0.01 }
      ]
    }
  ]
}
```

## 2. 移速规则

- `moveSpeed` 只允许作为乘区使用，不允许再直接线性加到技能伤害。
- 当前项目的移速公式按“基础 100% 移速 + 额外移速”理解。
- 在技能公式里统一写成：`1 + moveSpeed * 0.01`。
- 例子：角色额外移速为 `60` 时，技能乘区为 `1 + 60 * 0.01 = 1.6`，即总伤害乘 `160%`。

禁止写法：

```json
{ "var": "caster.stat.moveSpeed", "scale": 4.5 }
```

允许写法：

```json
{
  "op": "mul",
  "args": [
    { "op": "add", "args": [18, { "var": "caster.stat.spellAtk", "scale": 0.9 }] },
    { "op": "add", "args": [1, { "var": "caster.stat.moveSpeed", "scale": 0.01 }] }
  ]
}
```

## 3. 目标最大生命值规则

- `target.maxHp`、`target.stat.maxHp` 只建议作为额外机制段使用，不建议作为主体伤害来源。
- 这类效果在技能描述和 tooltip 中默认只展示百分比，不做具体预估值展示。
- `caster.maxHp` 这类自身可确定属性，允许正常预览具体数值。
- 如果某个技能同时吃攻击和目标最大生命值，优先写成“主体伤害 + 目标生命附加段”，不要把目标生命段再拿去叠多个乘区。

推荐模板：

```json
{
  "op": "add",
  "args": [
    {
      "op": "mul",
      "args": [
        { "op": "add", "args": [28, { "var": "caster.stat.physAtk", "scale": 1.15 }] },
        { "op": "add", "args": [1, { "var": "caster.stat.moveSpeed", "scale": 0.01 }] }
      ]
    },
    { "var": "target.maxHp", "scale": 0.015 }
  ]
}
```

## 4. 当前已落地规则

- `风痕`、`流云断`、`回龙转锋` 已改成“主体伤害段 × 总移速倍率”。
- tooltip 对 `target.maxHp`、`target.stat.maxHp` 一类目标侧生命缩放不再直接预览具体值。

## 5. 相关文档

价值预算、品阶区间、破格设计、报表口径统一参考：

- `docs/value-budget.md`
