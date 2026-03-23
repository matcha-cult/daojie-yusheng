/**
 * GM 相关的常量，供后台管理逻辑复用。
 */
import { resolveServerDataPath } from '../../common/data-path';

/** GM 访问令牌默认有效期（单位：秒） */
export const GM_TOKEN_EXPIRES_IN = 60 * 60 * 12;
/** GM 密码配置数据存储路径 */
export const GM_CONFIG_PATH = resolveServerDataPath('gm-config.json');
