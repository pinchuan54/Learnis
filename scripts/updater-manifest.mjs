// 生成自动更新用的 latest.json，发版时在 `npm run tauri build` 之后运行：
//
//   npm run release:manifest
//
// 读取 package.json 的版本号、CHANGELOG.md 中本版的说明、NSIS 安装包的签名，
// 写到 src-tauri/target/release/bundle/nsis/latest.json，随安装包一起上传到 GitHub Release。
// 已安装的 Learnis 点「检查更新」时读取的就是最新 Release 里的这个文件。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** 发布安装包的 GitHub 仓库 */
export const REPOSITORY = 'pinchuan54/Learnis';

/** 安装包文件名，与 Tauri 的 NSIS 产物一致 */
export function installerName(version) {
  return `Learnis_${version}_x64-setup.exe`;
}

/** 安装包在 GitHub Release 上的下载地址 */
export function installerUrl(version) {
  return `https://github.com/${REPOSITORY}/releases/download/v${version}/${installerName(version)}`;
}

/**
 * 从 CHANGELOG 中取出某个版本的说明（`## vX.Y.Z` 标题到下一个 `## ` 标题之间）。
 * 找不到时抛错，避免发出没有说明的版本。
 */
export function extractReleaseNotes(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const heading = new RegExp(`^## v${version.replace(/\./g, '\\.')}(\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) {
    throw new Error(`CHANGELOG.md 里没有 v${version} 的说明`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  if (!section) {
    throw new Error(`CHANGELOG.md 里 v${version} 的说明是空的`);
  }
  return section;
}

/**
 * 把 Markdown 说明转成程序里直接显示的纯文本：
 * 去掉标题井号、行内代码和加粗记号，链接只留文字，列表项改成「· 」开头，多个空行合并成一个。
 */
export function toPlainText(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^(\s*)[-*]\s+/, '$1· ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .trimEnd(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 读出签名里记录的版本号（trusted comment 中的 `version:` 字段）。
 * 程序开启了 requireSignedVersion，签名里没有版本号或版本不符的安装包会被拒绝安装。
 */
export function signedVersion(signature) {
  const text = Buffer.from(signature.trim(), 'base64').toString('utf8');
  const comment = text.split('\n').find((line) => line.startsWith('trusted comment:'));
  if (!comment) return null;
  const field = comment
    .slice('trusted comment:'.length)
    .trim()
    .split('\t')
    .find((part) => part.startsWith('version:'));
  return field ? field.slice('version:'.length) : null;
}

/** 组装 latest.json 的内容 */
export function buildManifest({ version, notes, signature, pubDate }) {
  const signed = signedVersion(signature);
  if (signed !== version) {
    throw new Error(
      signed
        ? `安装包签名里的版本是 ${signed}，与 package.json 的 ${version} 不一致`
        : '安装包签名里没有记录版本号，已安装的程序会拒绝这个更新',
    );
  }
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      'windows-x86_64': {
        signature: signature.trim(),
        url: installerUrl(version),
      },
    },
  };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const bundleDir = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
  const signaturePath = join(bundleDir, `${installerName(version)}.sig`);

  let signature;
  try {
    signature = readFileSync(signaturePath, 'utf8');
  } catch {
    throw new Error(`找不到安装包签名 ${signaturePath}，请先用签名私钥运行 npm run tauri build`);
  }

  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  const manifest = buildManifest({
    version,
    notes: toPlainText(extractReleaseNotes(changelog, version)),
    signature,
    pubDate: new Date().toISOString(),
  });

  const output = join(bundleDir, 'latest.json');
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`已生成 ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
