import { describe, expect, it } from 'vitest';
import {
  buildManifest,
  extractReleaseNotes,
  installerUrl,
  signedVersion,
  toPlainText,
} from './updater-manifest.mjs';

/** 按 minisign 签名文件的格式拼一个假签名（只关心 trusted comment） */
function fakeSignature(trustedComment) {
  const text = [
    'untrusted comment: signature from tauri secret key',
    'RUSfake',
    `trusted comment: ${trustedComment}`,
    'fakeglobal',
    '',
  ].join('\n');
  return Buffer.from(text).toString('base64');
}

const CHANGELOG = `# 更新日志

## v0.1.2 — 2026-11-20

### 新增

- 关于页可以**检查更新**，一键更新到新版本
- 快捷键默认 \`Ctrl+Shift+F12\`，详见 [README](README.md)


### 修复

- 某个问题

## v0.1.1 — 2026-11-15

- 旧版本
`;

describe('extractReleaseNotes', () => {
  it('取出指定版本到下一个版本标题之间的内容', () => {
    const notes = extractReleaseNotes(CHANGELOG, '0.1.2');
    expect(notes.startsWith('### 新增')).toBe(true);
    expect(notes.endsWith('- 某个问题')).toBe(true);
    expect(notes).not.toContain('旧版本');
  });

  it('最后一个版本取到文件末尾', () => {
    expect(extractReleaseNotes(CHANGELOG, '0.1.1')).toBe('- 旧版本');
  });

  it('不会把 v0.1.1 误当成 v0.1.10', () => {
    expect(() => extractReleaseNotes(CHANGELOG, '0.1.10')).toThrow('没有 v0.1.10');
  });

  it('兼容 Windows 换行', () => {
    expect(extractReleaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '0.1.1')).toBe('- 旧版本');
  });
});

describe('toPlainText', () => {
  it('去掉 Markdown 记号，列表改成圆点，合并多余空行', () => {
    expect(toPlainText(extractReleaseNotes(CHANGELOG, '0.1.2'))).toBe(
      [
        '新增',
        '',
        '· 关于页可以检查更新，一键更新到新版本',
        '· 快捷键默认 Ctrl+Shift+F12，详见 README',
        '',
        '修复',
        '',
        '· 某个问题',
      ].join('\n'),
    );
  });
});

describe('signedVersion', () => {
  it('读出 trusted comment 里的版本号', () => {
    const signature = fakeSignature('timestamp:1\tfile:Learnis_0.1.2_x64-setup.exe\tversion:0.1.2');
    expect(signedVersion(signature)).toBe('0.1.2');
  });

  it('没有记录版本号时返回 null', () => {
    expect(signedVersion(fakeSignature('timestamp:1\tfile:a.exe'))).toBeNull();
  });
});

describe('buildManifest', () => {
  const pubDate = '2026-11-20T08:00:00.000Z';

  it('生成 Tauri 更新插件需要的格式', () => {
    const signature = fakeSignature('timestamp:1\tfile:a.exe\tversion:0.1.2');
    expect(buildManifest({ version: '0.1.2', notes: '说明', signature, pubDate })).toEqual({
      version: '0.1.2',
      notes: '说明',
      pub_date: pubDate,
      platforms: {
        'windows-x86_64': {
          signature,
          url: 'https://github.com/pinchuan54/Learnis/releases/download/v0.1.2/Learnis_0.1.2_x64-setup.exe',
        },
      },
    });
    expect(installerUrl('0.1.2')).toContain('/v0.1.2/');
  });

  it('签名里的版本与要发布的版本不一致时拒绝', () => {
    const signature = fakeSignature('timestamp:1\tfile:a.exe\tversion:0.1.1');
    expect(() => buildManifest({ version: '0.1.2', notes: '', signature, pubDate })).toThrow(
      '签名里的版本是 0.1.1',
    );
  });

  it('签名里没有版本号时拒绝', () => {
    const signature = fakeSignature('timestamp:1\tfile:a.exe');
    expect(() => buildManifest({ version: '0.1.2', notes: '', signature, pubDate })).toThrow(
      '没有记录版本号',
    );
  });
});
