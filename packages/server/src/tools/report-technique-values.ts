import { buildTechniqueRows, renderMarkdownTable } from './value-report-lib';

process.stdout.write(`${renderMarkdownTable('功法价值报表', buildTechniqueRows())}\n`);
