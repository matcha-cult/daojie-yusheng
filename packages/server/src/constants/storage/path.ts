/**
 * 服务端数据目录探测常量。
 */

import * as path from 'path';

/** data 目录候选路径，按优先级排序。 */
export const DATA_DIR_CANDIDATES = [
  path.resolve(process.cwd(), 'data'),
  path.resolve(process.cwd(), 'packages', 'server', 'data'),
];
