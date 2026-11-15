/**
 * 把程序版本号转换成界面上显示的版本。
 *
 * - 正式版补丁号为 0 时省略：`0.1.0` → `v0.1`，`0.1.2` → `v0.1.2`；
 * - 内部测试包的版本号带构建号，显示为 dev 编号：`0.1.2+3` → `v0.1.2-dev.3`。
 */
export function formatDisplayVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+(\d+))?$/.exec(version.trim());
  if (!match) {
    return version;
  }
  const [, major, minor, patch, devNumber] = match;
  const base = patch === '0' ? `v${major}.${minor}` : `v${major}.${minor}.${patch}`;
  return devNumber === undefined ? base : `${base}-dev.${devNumber}`;
}
