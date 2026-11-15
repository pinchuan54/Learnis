// 打内部测试安装包（dev 包），给人工检查用，不发布：
//
//   npm run build:dev
//
// - 编号自动取下一个：基础版本是 package.json 的版本（最近一次正式发布），
//   同一基础版本下从 dev.1 开始递增，例如 v0.1.2-dev.3；
// - 程序内部版本号用 0.1.2+3（构建元数据），一键更新不会把正式的 0.1.2 当成新版本，
//   下一个正式版照常能更新；只在构建时临时传入，不改动仓库里的版本号；
// - 不生成更新签名，不需要签名私钥；
// - 安装包改名为 Learnis_0.1.2-dev.3_x64-setup.exe，放到 src-tauri/target/dev-installer/；
// - 每个测试包的提交记在本地 Git 引用 refs/dev-builds/<编号> 下（普通推送不会带上），
//   用来避免重号，并判断新包是接着之前哪个包改的，还是另起一条线。

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** 记录测试包提交的本地 Git 引用前缀：不在 refs/heads、refs/tags 下，推送分支或标签都不会带上 */
export const REF_PREFIX = 'refs/dev-builds/';

const BASE_VERSION = /^\d+\.\d+\.\d+$/;
const DEV_LABEL = /^(\d+\.\d+\.\d+)-dev\.([1-9]\d*)$/;

/** 某个基础版本下第 `number` 个测试包的版本号与编号 */
export function devBuild(baseVersion, number) {
  if (!BASE_VERSION.test(baseVersion)) {
    throw new Error(`package.json 的版本号 ${baseVersion} 不是 X.Y.Z 格式的正式版本号`);
  }
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`测试包编号必须是正整数：${number}`);
  }
  const label = `${baseVersion}-dev.${number}`;
  return { base: baseVersion, number, version: `${baseVersion}+${number}`, label };
}

/** 解析测试包编号，如 `0.1.2-dev.3`；格式不对时返回 null */
export function parseDevLabel(label) {
  const match = DEV_LABEL.exec(label);
  return match ? { base: match[1], number: Number(match[2]), label } : null;
}

/** 同一基础版本下的下一个编号 */
export function nextDevNumber(baseVersion, labels) {
  const used = labels
    .map(parseDevLabel)
    .filter((build) => build && build.base === baseVersion)
    .map((build) => build.number);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

/** 测试包从旧到新排序：先比基础版本，再比编号 */
export function compareDevBuilds(a, b) {
  const pa = a.base.split('.').map(Number);
  const pb = b.base.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return a.number - b.number;
}

/**
 * 找基线：之前的测试包里，提交是当前提交的祖先（或就是当前提交）的最新一个。
 * 没有则返回 null，表示另起一条线。
 * 注意 squash 合并后，main 上的提交不再是功能分支提交的后代，会算作另起一条线。
 */
export function findBaseline(builds, isAncestor) {
  const candidates = builds.filter((build) => isAncestor(build.commit));
  candidates.sort(compareDevBuilds);
  return candidates.at(-1) ?? null;
}

/** 基线的文字说明 */
export function describeBaseline({ baseline, headCommit, branch }) {
  if (!baseline) {
    return `另起一条线（${branch}@${headCommit.slice(0, 7)}）`;
  }
  const previous = `v${baseline.label}`;
  return baseline.commit === headCommit
    ? `与 ${previous} 是同一个提交`
    : `接着 ${previous}（${baseline.commit.slice(0, 7)}）`;
}

/** 把 Tauri 产物文件名里的版本号换成测试包编号：`Learnis_0.1.2+3_x64-setup.exe` → `Learnis_0.1.2-dev.3_x64-setup.exe` */
export function devInstallerName(bundleFileName, build) {
  const marker = `_${build.version}_`;
  if (!bundleFileName.includes(marker)) {
    throw new Error(`安装包文件名 ${bundleFileName} 里没有版本号 ${build.version}`);
  }
  return bundleFileName.replace(marker, `_${build.label}_`);
}

// ---------- 以下是实际执行的部分 ----------

function git(args, options = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} 失败：${result.stderr.trim()}`);
  }
  return result;
}

/** 本地记录的所有测试包 */
function recordedBuilds() {
  const output = git([
    'for-each-ref',
    '--format=%(refname:lstrip=2)\t%(objectname)',
    REF_PREFIX,
  ]).stdout.trim();
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => {
      const [label, commit] = line.split('\t');
      const build = parseDevLabel(label);
      return build ? { ...build, commit } : null;
    })
    .filter(Boolean);
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  process.chdir(root);

  const { version: baseVersion } = JSON.parse(readFileSync('package.json', 'utf8'));
  const { productName } = JSON.parse(readFileSync(join('src-tauri', 'tauri.conf.json'), 'utf8'));

  const headCommit = git(['rev-parse', 'HEAD']).stdout.trim();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const dirty = git(['status', '--porcelain']).stdout.trim() !== '';
  const commitLabel = `${headCommit.slice(0, 7)}${dirty ? '-dirty' : ''}`;

  const builds = recordedBuilds();
  const build = devBuild(
    baseVersion,
    nextDevNumber(
      baseVersion,
      builds.map((item) => item.label),
    ),
  );
  const baseline = findBaseline(
    builds,
    (commit) =>
      git(['merge-base', '--is-ancestor', commit, 'HEAD'], { allowFailure: true }).status === 0,
  );
  const baselineText = describeBaseline({ baseline, headCommit, branch });

  const outDir = join('src-tauri', 'target', 'dev-installer');
  const existing = existsSync(outDir)
    ? readdirSync(outDir).find((name) => name.includes(`_${build.label}_`))
    : undefined;
  if (existing) {
    throw new Error(
      `${join(outDir, existing)} 已经存在，但本地没有 ${REF_PREFIX}${build.label} 的记录，请先核对`,
    );
  }

  console.log(`开始构建 v${build.label}（提交 ${commitLabel}，${baselineText}）`);
  if (dirty) {
    console.log('注意：工作区有未提交的改动，会一起打进安装包，记录的提交不包含这些改动');
  }

  // 临时配置：带构建号的版本号，并且不生成更新签名
  const configPath = join(tmpdir(), `learnis-dev-build-${build.label}.json`);
  writeFileSync(
    configPath,
    JSON.stringify({ version: build.version, bundle: { createUpdaterArtifacts: false } }),
  );
  const isWindows = process.platform === 'win32';
  let result;
  try {
    result = spawnSync(
      'npm',
      ['run', 'tauri', '--', 'build', '--config', isWindows ? `"${configPath}"` : configPath],
      {
        stdio: 'inherit',
        shell: isWindows,
        env: {
          ...process.env,
          LEARNIS_APP_VERSION: build.version,
          LEARNIS_BUILD_COMMIT: commitLabel,
        },
      },
    );
  } finally {
    rmSync(configPath, { force: true });
  }
  if (result.status !== 0) {
    throw new Error('构建失败，没有生成测试包');
  }

  const bundleDir = join('src-tauri', 'target', 'release', 'bundle', 'nsis');
  const bundleFile = readdirSync(bundleDir).find(
    (name) => name.startsWith(`${productName}_${build.version}_`) && name.endsWith('-setup.exe'),
  );
  if (!bundleFile) {
    throw new Error(`在 ${bundleDir} 里找不到 ${build.version} 的安装包`);
  }
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, devInstallerName(bundleFile, build));
  renameSync(join(bundleDir, bundleFile), target);
  git(['update-ref', `${REF_PREFIX}${build.label}`, headCommit]);

  const sha256 = createHash('sha256').update(readFileSync(target)).digest('hex');
  console.log('');
  console.log(`内部测试包 v${build.label}`);
  console.log(`  提交：${commitLabel}（${branch}）`);
  console.log(`  基线：${baselineText}`);
  console.log(`  文件：${relative(root, target)}`);
  console.log(`  SHA-256：${sha256}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
