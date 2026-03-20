import { Injectable } from '@nestjs/common';
import {
  ActionDef,
  AttrBonus,
  BreakthroughPreviewState,
  BreakthroughRequirementView,
  calcTechniqueFinalAttrBonus,
  CULTIVATE_EXP_PER_TICK,
  DEFAULT_PLAYER_REALM_STAGE,
  deriveTechniqueRealm,
  getTechniqueExpToNext,
  getTechniqueMaxLevel,
  PLAYER_REALM_CONFIG,
  PLAYER_REALM_ORDER,
  PlayerRealmStage,
  PlayerRealmState,
  PlayerState,
  TECHNIQUE_GRADE_LABELS,
  TECHNIQUE_GRADE_ORDER,
  TechniqueGrade,
  TechniqueLayerDef,
  TechniqueRealm,
  TechniqueState,
  resolveSkillUnlockLevel,
  SkillDef,
} from '@mud/shared';
import { AttrService } from './attr.service';
import { BreakthroughConfigEntry, BreakthroughRequirementDef, ContentService } from './content.service';
import { InventoryService } from './inventory.service';

type TechniqueDirtyFlag = 'inv' | 'tech' | 'attr' | 'actions';
type TechniqueMessageKind = 'system' | 'quest' | 'combat' | 'loot';

interface TechniqueMessage {
  text: string;
  kind?: TechniqueMessageKind;
}

interface CultivationResult {
  changed: boolean;
  dirty: TechniqueDirtyFlag[];
  messages: TechniqueMessage[];
}

interface BreakthroughResult {
  error?: string;
  dirty: TechniqueDirtyFlag[];
  messages: TechniqueMessage[];
}

const EMPTY_CULTIVATION: CultivationResult = { changed: false, dirty: [], messages: [] };
const REALM_STAGE_SOURCE = 'realm:stage';
const REALM_STATE_SOURCE = 'realm:state';
const TECHNIQUE_SOURCE_PREFIX = 'technique:';

@Injectable()
export class TechniqueService {
  constructor(
    private readonly attrService: AttrService,
    private readonly inventoryService: InventoryService,
    private readonly contentService: ContentService,
  ) {}

  initializePlayerProgression(player: PlayerState): void {
    const previousHp = player.hp;
    const previousMaxHp = player.maxHp;
    const persisted = this.readPersistedRealmState(player);
    const normalized = this.resolveInitialRealmState(player, persisted);
    this.syncTechniqueMetadata(player);
    this.applyRealmBonus(player, normalized);
    this.applyTechniqueBonuses(player);
    this.attrService.recalcPlayer(player);
    this.syncRealmPresentation(player, normalized);

    if (previousMaxHp <= 0) {
      player.hp = player.maxHp;
      return;
    }

    if (player.hp <= 0) {
      player.hp = Math.min(player.maxHp, Math.max(1, previousHp));
    }
  }

  preparePlayerForPersistence(player: PlayerState): void {
    this.initializePlayerProgression(player);
  }

  learnTechnique(
    player: PlayerState,
    techId: string,
    name: string,
    skills: SkillDef[],
    grade?: TechniqueGrade,
    layers?: TechniqueLayerDef[],
  ): string | null {
    this.initializePlayerProgression(player);
    if (player.techniques.find((entry) => entry.techId === techId)) {
      return '已学会该功法';
    }

    const technique: TechniqueState = {
      techId,
      name,
      level: 1,
      exp: 0,
      expToNext: getTechniqueExpToNext(1, layers),
      realm: deriveTechniqueRealm(1, layers),
      skills,
      grade,
      layers,
    };
    player.techniques.push(technique);
    this.applyTechniqueBonuses(player);
    this.attrService.recalcPlayer(player);
    return null;
  }

  cultivateTick(player: PlayerState): CultivationResult {
    this.initializePlayerProgression(player);
    if (!player.cultivatingTechId) return EMPTY_CULTIVATION;
    const numericStats = this.attrService.getPlayerNumericStats(player);
    const techniqueExpBonus = Math.max(0, numericStats.techniqueExpRate) / 10000;
    const realmExpBonus = Math.max(0, numericStats.playerExpRate) / 10000;

    const technique = player.techniques.find((entry) => entry.techId === player.cultivatingTechId);
    if (!technique) {
      player.cultivatingTechId = undefined;
      return {
        changed: true,
        dirty: ['tech', 'actions'],
        messages: [{ text: '当前修炼的功法不存在，已停止修炼。', kind: 'system' }],
      };
    }

    const dirty = new Set<TechniqueDirtyFlag>(['tech']);
    const messages: TechniqueMessage[] = [];
    let techniqueLeveledUp = false;

    const maxLevel = getTechniqueMaxLevel(technique.layers);
    if (technique.level < maxLevel && technique.expToNext > 0) {
      technique.exp += this.applyRateBonus(CULTIVATE_EXP_PER_TICK, techniqueExpBonus);
      while (technique.expToNext > 0 && technique.exp >= technique.expToNext && technique.level < maxLevel) {
        technique.exp -= technique.expToNext;
        technique.level += 1;
        technique.expToNext = getTechniqueExpToNext(technique.level, technique.layers);
        technique.realm = deriveTechniqueRealm(technique.level, technique.layers);
        techniqueLeveledUp = true;
        messages.push({
          text: technique.expToNext > 0
            ? `${technique.name} 提升至第 ${technique.level} 层。`
            : `${technique.name} 修至圆满，共第 ${technique.level} 层。`,
          kind: 'quest',
        });
        dirty.add('actions');
      }
    }

    if (techniqueLeveledUp) {
      this.applyTechniqueBonuses(player);
      this.attrService.recalcPlayer(player);
      dirty.add('attr');
    }

    const realmProgress = this.advanceRealmProgress(player, technique, realmExpBonus);
    if (realmProgress.changed) {
      dirty.add('attr');
      dirty.add('actions');
      messages.push(...realmProgress.messages);
    }

    return {
      changed: dirty.size > 0,
      dirty: [...dirty],
      messages,
    };
  }

  getSkillActions(player: PlayerState): ActionDef[] {
    this.initializePlayerProgression(player);
    const playerRealmStage = player.realm?.stage ?? DEFAULT_PLAYER_REALM_STAGE;
    const actions: ActionDef[] = [];

    for (const technique of player.techniques) {
      for (const skill of technique.skills) {
        const unlockPlayerRealm = skill.unlockPlayerRealm ?? DEFAULT_PLAYER_REALM_STAGE;
        if (technique.level < resolveSkillUnlockLevel(skill) || playerRealmStage < unlockPlayerRealm) {
          continue;
        }
        actions.push({
          id: skill.id,
          name: skill.name,
          type: 'skill',
          desc: skill.desc,
          cooldownLeft: 0,
          range: skill.range,
          requiresTarget: skill.requiresTarget ?? true,
          targetMode: skill.targetMode ?? 'any',
        });
      }
    }

    return actions;
  }

  getBreakthroughAction(player: PlayerState): ActionDef | null {
    this.initializePlayerProgression(player);
    const realm = player.realm;
    if (!realm?.breakthroughReady || !realm.breakthrough) return null;
    return {
      id: 'realm:breakthrough',
      name: `突破至 ${realm.breakthrough.targetDisplayName}`,
      type: 'breakthrough',
      desc: `当前境界已圆满，点击查看 ${realm.breakthrough.targetDisplayName} 的突破要求。`,
      cooldownLeft: 0,
    };
  }

  attemptBreakthrough(player: PlayerState): BreakthroughResult {
    this.initializePlayerProgression(player);
    const realm = player.realm;
    if (!realm) {
      return { error: '当前境界状态异常', dirty: [], messages: [] };
    }
    if (!realm.breakthroughReady || !realm.breakthrough) {
      return { error: '你的境界火候未到，尚不能突破', dirty: [], messages: [] };
    }

    const requirements = this.getResolvedBreakthroughRequirements(player, realm.realmLv);
    const unmet = requirements.filter((entry) => !entry.completed);
    if (unmet.length > 0) {
      return { error: '突破条件尚未满足', dirty: [], messages: [] };
    }

    for (const requirement of requirements) {
      if (requirement.def.type !== 'item') continue;
      this.consumeItem(player, requirement.def.itemId, requirement.def.count);
    }

    const nextState = this.createRealmStateFromLevel(realm.breakthrough.targetRealmLv, 0);
    const crossedStage = nextState.stage !== realm.stage;
    this.syncRealmPresentation(player, nextState);
    if (crossedStage) {
      this.applyRealmBonus(player, nextState);
    }
    this.attrService.recalcPlayer(player);
    player.hp = player.maxHp;
    player.qi = Math.round(player.numericStats?.maxQi ?? player.qi);

    return {
      dirty: ['inv', 'attr', 'actions', 'tech'],
      messages: [{
        text: this.buildBreakthroughMessage(realm.stage, nextState.stage, nextState.displayName),
        kind: 'quest',
      }],
    };
  }

  private advanceRealmProgress(player: PlayerState, technique: TechniqueState, expBonus = 0): { changed: boolean; messages: TechniqueMessage[] } {
    const realm = player.realm;
    if (!realm || realm.progressToNext <= 0) {
      return { changed: false, messages: [] };
    }

    const baseGain = 1 + Math.floor(technique.level / 2);
    const gain = this.applyRateBonus(baseGain, expBonus);
    const previousProgress = realm.progress;
    const nextState = this.normalizeRealmState(realm.realmLv, realm.progress + gain);

    if (nextState.progress === previousProgress && nextState.breakthroughReady === realm.breakthroughReady) {
      return { changed: false, messages: [] };
    }

    this.syncRealmPresentation(player, nextState);

    const messages: TechniqueMessage[] = [];
    if (nextState.breakthroughReady && !realm.breakthroughReady && nextState.breakthrough) {
      messages.push({
        text: `你的${nextState.displayName}已圆满，可尝试突破至 ${nextState.breakthrough.targetDisplayName}。`,
        kind: 'quest',
      });
    }

    return { changed: true, messages };
  }

  private applyRateBonus(base: number, bonusRate: number): number {
    const exactGain = Math.max(1, base * (1 + Math.max(0, bonusRate)));
    const guaranteed = Math.floor(exactGain);
    const remainder = exactGain - guaranteed;
    if (remainder <= 0) {
      return guaranteed;
    }
    return guaranteed + (Math.random() < remainder ? 1 : 0);
  }

  private createRealmStateFromLevel(realmLv: number, progress = 0): PlayerRealmState {
    const normalizedRealmLv = this.clampRealmLv(realmLv);
    const realmEntry = this.contentService.getRealmLevelEntry(normalizedRealmLv)
      ?? this.contentService.getRealmLevelEntry(1);
    const stage = this.resolveStageForRealmLevel(normalizedRealmLv);
    const config = PLAYER_REALM_CONFIG[stage];
    const expToNext = Math.max(0, realmEntry?.expToNext ?? 0);
    const cappedProgress = expToNext > 0 ? Math.max(0, Math.min(progress, expToNext)) : 0;
    const maxRealmLv = this.getMaxRealmLv();
    const breakthroughReady = expToNext > 0 && cappedProgress >= expToNext && normalizedRealmLv < maxRealmLv;
    const nextStage = normalizedRealmLv < maxRealmLv
      ? this.resolveStageForRealmLevel(normalizedRealmLv + 1)
      : undefined;

    return {
      stage,
      realmLv: realmEntry?.realmLv ?? normalizedRealmLv,
      displayName: realmEntry?.displayName ?? '未知境界',
      name: realmEntry?.name ?? '未知境界',
      shortName: realmEntry?.phaseName ?? '',
      path: realmEntry?.path ?? config.path,
      narrative: config.narrative,
      review: realmEntry?.review,
      progress: cappedProgress,
      progressToNext: expToNext,
      breakthroughReady,
      nextStage,
      breakthroughItems: breakthroughReady ? config.breakthroughItems.map((entry) => ({ ...entry })) : [],
      minTechniqueLevel: config.minTechniqueLevel,
      minTechniqueRealm: config.minTechniqueRealm,
    };
  }

  private normalizeRealmState(realmLv: number, progress = 0): PlayerRealmState {
    return this.createRealmStateFromLevel(realmLv, Math.max(0, Math.floor(progress)));
  }

  private resolveInitialRealmState(
    player: PlayerState,
    persisted: { stage?: PlayerRealmStage; progress?: number; realmLv?: number },
  ): PlayerRealmState {
    const persistedProgress = persisted.progress ?? player.realm?.progress ?? 0;
    const persistedRealmLv = persisted.realmLv ?? player.realm?.realmLv ?? player.realmLv;
    if (typeof persistedRealmLv === 'number' && persistedRealmLv > 0) {
      return this.normalizeRealmState(persistedRealmLv, persistedProgress);
    }

    const stage = persisted.stage ?? player.realm?.stage ?? DEFAULT_PLAYER_REALM_STAGE;
    const stageProgress = Math.max(0, persistedProgress);
    const legacyProgressToNext = Math.max(0, PLAYER_REALM_CONFIG[stage].progressToNext);
    const legacyEntry = this.contentService.resolveRealmLevelEntry(
      stage,
      stageProgress,
      legacyProgressToNext,
      legacyProgressToNext > 0 && stageProgress >= legacyProgressToNext,
    );
    const mappedProgress = legacyProgressToNext > 0
      ? Math.floor((Math.max(0, legacyEntry.expToNext ?? 0) * Math.min(stageProgress, legacyProgressToNext)) / legacyProgressToNext)
      : 0;
    return this.normalizeRealmState(legacyEntry.realmLv, mappedProgress);
  }

  private applyRealmBonus(player: PlayerState, realm: PlayerRealmState): void {
    const nextBonuses = player.bonuses.filter((bonus) => bonus.source !== REALM_STAGE_SOURCE);
    const config = PLAYER_REALM_CONFIG[realm.stage];
    const hasBonus = Object.values(config.attrBonus).some((value) => typeof value === 'number' && value > 0);
    if (hasBonus) {
      const bonus: AttrBonus = {
        source: REALM_STAGE_SOURCE,
        label: realm.name,
        attrs: config.attrBonus,
      };
      nextBonuses.push(bonus);
    }
    player.bonuses = nextBonuses;
  }

  private applyRealmStateMirror(player: PlayerState, realm: PlayerRealmState): void {
    player.bonuses = player.bonuses.filter((bonus) => bonus.source !== REALM_STATE_SOURCE);
    player.bonuses.push({
      source: REALM_STATE_SOURCE,
      label: realm.name,
      attrs: {},
      meta: {
        stage: realm.stage,
        realmLv: realm.realmLv,
        progress: realm.progress,
      },
    });
  }

  private readPersistedRealmState(player: PlayerState): { stage?: PlayerRealmStage; progress?: number; realmLv?: number } {
    const mirrored = player.bonuses.find((bonus) => bonus.source === REALM_STATE_SOURCE);
    const stage = mirrored?.meta?.stage;
    const realmLv = mirrored?.meta?.realmLv;
    const progress = mirrored?.meta?.progress;
    return {
      stage: typeof stage === 'number' ? stage as PlayerRealmStage : undefined,
      realmLv: typeof realmLv === 'number' ? realmLv : undefined,
      progress: typeof progress === 'number' ? progress : undefined,
    };
  }

  private syncRealmPresentation(player: PlayerState, realm: PlayerRealmState): void {
    const nextRealm: PlayerRealmState = {
      ...realm,
      breakthrough: this.buildBreakthroughPreview(player, realm),
    };
    player.realm = nextRealm;
    player.realmLv = nextRealm.realmLv;
    player.realmName = nextRealm.name;
    player.realmStage = nextRealm.shortName || undefined;
    player.realmReview = nextRealm.review;
    player.breakthroughReady = nextRealm.breakthroughReady;
    this.applyRealmStateMirror(player, nextRealm);
  }

  revealBreakthroughRequirements(player: PlayerState, requirementIds: readonly string[]): boolean {
    if (requirementIds.length === 0) return false;
    const known = new Set(player.revealedBreakthroughRequirementIds ?? []);
    const previousSize = known.size;
    for (const requirementId of requirementIds) {
      if (typeof requirementId !== 'string' || !requirementId) continue;
      known.add(requirementId);
    }
    if (known.size === previousSize) {
      return false;
    }
    player.revealedBreakthroughRequirementIds = [...known];
    if (player.realm) {
      this.syncRealmPresentation(player, this.normalizeRealmState(player.realm.realmLv, player.realm.progress));
    }
    return true;
  }

  private buildBreakthroughPreview(player: PlayerState, realm: PlayerRealmState): BreakthroughPreviewState | undefined {
    if (!realm.breakthroughReady) return undefined;
    const config = this.getBreakthroughConfig(realm.realmLv);
    const requirements = this.getResolvedBreakthroughRequirements(player, realm.realmLv).map((entry) => entry.view);
    const completedRequirements = requirements.filter((entry) => entry.completed).length;
    const targetEntry = this.contentService.getRealmLevelEntry(config.toRealmLv);
    return {
      targetRealmLv: config.toRealmLv,
      targetDisplayName: targetEntry?.displayName ?? `realmLv ${config.toRealmLv}`,
      totalRequirements: requirements.length,
      completedRequirements,
      allCompleted: completedRequirements === requirements.length,
      requirements,
    };
  }

  private getResolvedBreakthroughRequirements(player: PlayerState, fromRealmLv: number): Array<{ def: BreakthroughRequirementDef; completed: boolean; view: BreakthroughRequirementView }> {
    const config = this.getBreakthroughConfig(fromRealmLv);
    const revealed = new Set(player.revealedBreakthroughRequirementIds ?? []);
    return config.requirements.map((def) => {
      const completed = this.isBreakthroughRequirementCompleted(player, def);
      const hidden = !completed && !revealed.has(def.id);
      const view: BreakthroughRequirementView = {
        id: def.id,
        type: def.type,
        label: hidden ? '???' : this.formatBreakthroughRequirementLabel(def),
        completed,
        hidden,
      };
      return { def, completed, view };
    });
  }

  private getBreakthroughConfig(fromRealmLv: number): BreakthroughConfigEntry {
    const nextRealmLv = Math.min(this.getMaxRealmLv(), fromRealmLv + 1);
    return this.contentService.getBreakthroughConfig(fromRealmLv) ?? {
      fromRealmLv,
      toRealmLv: nextRealmLv,
      requirements: [],
    };
  }

  private isBreakthroughRequirementCompleted(player: PlayerState, requirement: BreakthroughRequirementDef): boolean {
    switch (requirement.type) {
      case 'item':
        return this.getInventoryCount(player, requirement.itemId) >= requirement.count;
      case 'technique': {
        const qualified = player.techniques.filter((technique) => {
          if (requirement.techniqueId && technique.techId !== requirement.techniqueId) return false;
          if (requirement.minGrade && !this.isTechniqueGradeAtLeast(technique.grade, requirement.minGrade)) return false;
          if (requirement.minLevel && technique.level < requirement.minLevel) return false;
          if (requirement.minRealm !== undefined && technique.realm < requirement.minRealm) return false;
          return true;
        });
        return qualified.length >= (requirement.count ?? 1);
      }
      case 'attribute':
        return (player.finalAttrs?.[requirement.attr] ?? player.baseAttrs[requirement.attr] ?? 0) >= requirement.minValue;
      default:
        return false;
    }
  }

  private formatBreakthroughRequirementLabel(requirement: BreakthroughRequirementDef): string {
    if (requirement.label) return requirement.label;
    switch (requirement.type) {
      case 'item': {
        const itemName = this.contentService.getItem(requirement.itemId)?.name ?? requirement.itemId;
        return `${itemName} x${requirement.count}`;
      }
      case 'technique': {
        const parts: string[] = ['至少掌握'];
        const count = requirement.count ?? 1;
        parts.push(`${count}门`);
        if (requirement.techniqueId) {
          parts.push(this.contentService.getTechnique(requirement.techniqueId)?.name ?? requirement.techniqueId);
        } else if (requirement.minGrade) {
          parts.push(`${TECHNIQUE_GRADE_LABELS[requirement.minGrade]}功法`);
        } else {
          parts.push('功法');
        }
        if (requirement.minLevel) {
          parts.push(`达到 ${requirement.minLevel} 级`);
        }
        if (requirement.minRealm !== undefined) {
          parts.push(`境界达到${this.techniqueRealmLabel(requirement.minRealm)}`);
        }
        return parts.join('');
      }
      case 'attribute':
        return `${this.attrLabel(requirement.attr)}达到 ${requirement.minValue}`;
      default:
        return '???';
    }
  }

  private isTechniqueGradeAtLeast(current: TechniqueGrade | undefined, expected: TechniqueGrade): boolean {
    if (!current) return false;
    return TECHNIQUE_GRADE_ORDER.indexOf(current) >= TECHNIQUE_GRADE_ORDER.indexOf(expected);
  }

  private attrLabel(attr: keyof PlayerState['baseAttrs']): string {
    switch (attr) {
      case 'constitution':
        return '体魄';
      case 'spirit':
        return '神识';
      case 'perception':
        return '感知';
      case 'talent':
        return '资质';
      case 'comprehension':
        return '悟性';
      case 'luck':
        return '气运';
      default:
        return String(attr);
    }
  }

  private resolveStageForRealmLevel(realmLv: number): PlayerRealmStage {
    for (const stage of [...PLAYER_REALM_ORDER].reverse()) {
      const range = this.contentService.getRealmLevelRange(stage);
      if (realmLv >= range.levelFrom) {
        return stage;
      }
    }
    return DEFAULT_PLAYER_REALM_STAGE;
  }

  private getMaxRealmLv(): number {
    const levels = this.contentService.getRealmLevelsConfig()?.levels ?? [];
    const maxRealmLv = levels[levels.length - 1]?.realmLv;
    return typeof maxRealmLv === 'number' && maxRealmLv > 0 ? maxRealmLv : 1;
  }

  private clampRealmLv(realmLv: number): number {
    return Math.max(1, Math.min(this.getMaxRealmLv(), Math.floor(realmLv)));
  }

  private applyTechniqueBonuses(player: PlayerState): void {
    const nextBonuses = player.bonuses.filter((bonus) => !bonus.source.startsWith(TECHNIQUE_SOURCE_PREFIX));
    const attrs = calcTechniqueFinalAttrBonus(player.techniques);
    if (Object.values(attrs).some((value) => value > 0)) {
      nextBonuses.push({
        source: `${TECHNIQUE_SOURCE_PREFIX}aggregate`,
        label: '功法总池',
        attrs,
      });
    }
    player.bonuses = nextBonuses;
  }

  private syncTechniqueMetadata(player: PlayerState): void {
    for (const technique of player.techniques) {
      const template = this.contentService.getTechnique(technique.techId);
      if (!template) continue;
      technique.grade = template.grade;
      technique.layers = template.layers;
      technique.skills = template.skills;
      const maxLevel = getTechniqueMaxLevel(template.layers);
      if (technique.level > maxLevel) {
        technique.level = maxLevel;
      }
      if (technique.level < 1) {
        technique.level = 1;
      }
      technique.realm = deriveTechniqueRealm(technique.level, template.layers);
      technique.expToNext = getTechniqueExpToNext(technique.level, template.layers);
      if (technique.expToNext <= 0) {
        technique.exp = 0;
      } else if (technique.exp >= technique.expToNext) {
        technique.exp = Math.max(0, technique.expToNext - 1);
      }
    }
  }

  private getInventoryCount(player: PlayerState, itemId: string): number {
    return player.inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.count, 0);
  }

  private consumeItem(player: PlayerState, itemId: string, count: number): void {
    let remaining = count;
    while (remaining > 0) {
      const slotIndex = this.inventoryService.findItem(player, itemId);
      if (slotIndex < 0) return;
      const removed = this.inventoryService.removeItem(player, slotIndex, remaining);
      if (!removed) return;
      remaining -= removed.count;
    }
  }

  private techniqueRealmLabel(realm: TechniqueRealm): string {
    switch (realm) {
      case TechniqueRealm.Entry:
        return '入门';
      case TechniqueRealm.Minor:
        return '小成';
      case TechniqueRealm.Major:
        return '大成';
      case TechniqueRealm.Perfection:
        return '圆满';
    }
  }

  private buildBreakthroughMessage(from: PlayerRealmStage, to: PlayerRealmStage, nextName: string): string {
    if (from < PlayerRealmStage.QiRefining && to >= PlayerRealmStage.QiRefining) {
      return `你打破凡武桎梏，正式踏入${nextName}，从江湖武者迈入修仙之门。`;
    }
    return `你成功突破，当前已踏入 ${nextName}。`;
  }
}
