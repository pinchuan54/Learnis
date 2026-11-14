/**
 * 把语义化版本号转换成界面上显示的版本。
 *
 * 补丁号为 0 时省略：`0.1.0` → `v0.1`，`0.1.2` → `v0.1.2`。
 */
export function formatDisplayVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    return version;
  }
  const [, major, minor, patch] = match;
  return patch === '0' ? `v${major}.${minor}` : `v${major}.${minor}.${patch}`;
}
