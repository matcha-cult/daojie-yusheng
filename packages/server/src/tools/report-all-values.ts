import {
  buildBuffRows,
  buildEquipmentRows,
  buildSkillRows,
  buildTechniqueRows,
  renderMarkdownTable,
} from './value-report-lib';

const sections = [
  renderMarkdownTable('装备价值报表', buildEquipmentRows()),
  renderMarkdownTable('功法价值报表', buildTechniqueRows()),
  renderMarkdownTable('技能价值报表', buildSkillRows()),
  renderMarkdownTable('Buff价值报表', buildBuffRows()),
];

process.stdout.write(`${sections.join('\n')}\n`);
