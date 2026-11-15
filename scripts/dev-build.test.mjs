import { describe, expect, it } from 'vitest';
import {
  compareDevBuilds,
  describeBaseline,
  devBuild,
  devInstallerName,
  findBaseline,
  nextDevNumber,
  parseDevLabel,
} from './dev-build.mjs';

const build = (label, commit) => ({ ...parseDevLabel(label), commit });

describe('devBuild', () => {
  it('程序版本号带构建号，编号带 dev', () => {
    expect(devBuild('0.1.2', 3)).toEqual({
      base: '0.1.2',
      number: 3,
      version: '0.1.2+3',
      label: '0.1.2-dev.3',
    });
  });

  it('基础版本必须是正式版本号，编号必须是正整数', () => {
    expect(() => devBuild('0.1.2+3', 1)).toThrow('X.Y.Z');
    expect(() => devBuild('0.1.2-beta.1', 1)).toThrow('X.Y.Z');
    expect(() => devBuild('0.1.2', 0)).toThrow('正整数');
  });
});

describe('parseDevLabel', () => {
  it('解析编号', () => {
    expect(parseDevLabel('0.1.2-dev.12')).toEqual({
      base: '0.1.2',
      number: 12,
      label: '0.1.2-dev.12',
    });
  });

  it('格式不对时返回 null', () => {
    expect(parseDevLabel('0.1.2-dev.0')).toBeNull();
    expect(parseDevLabel('0.1.2-test.1')).toBeNull();
    expect(parseDevLabel('v0.1.2-dev.1')).toBeNull();
  });
});

describe('nextDevNumber', () => {
  it('同一基础版本下递增，发了新版从 1 重新数', () => {
    const labels = ['0.1.2-dev.1', '0.1.2-dev.2', '0.1.1-dev.7', 'something-else'];
    expect(nextDevNumber('0.1.2', labels)).toBe(3);
    expect(nextDevNumber('0.1.3', labels)).toBe(1);
    expect(nextDevNumber('0.1.2', [])).toBe(1);
  });

  it('按最大编号递增，中间缺号不补', () => {
    expect(nextDevNumber('0.1.2', ['0.1.2-dev.1', '0.1.2-dev.5'])).toBe(6);
  });
});

describe('compareDevBuilds', () => {
  it('先比基础版本，再比编号', () => {
    const builds = [
      build('0.1.10-dev.1', 'a'),
      build('0.1.2-dev.10', 'b'),
      build('0.1.2-dev.9', 'c'),
      build('0.2.0-dev.1', 'd'),
    ];
    expect(builds.sort(compareDevBuilds).map((item) => item.label)).toEqual([
      '0.1.2-dev.9',
      '0.1.2-dev.10',
      '0.1.10-dev.1',
      '0.2.0-dev.1',
    ]);
  });
});

describe('findBaseline', () => {
  const builds = [
    build('0.1.2-dev.1', 'c1'),
    build('0.1.2-dev.2', 'c2'),
    build('0.1.2-dev.3', 'c3'),
  ];

  it('取祖先里最新的一个', () => {
    const ancestors = new Set(['c1', 'c2']);
    expect(findBaseline(builds, (commit) => ancestors.has(commit))?.label).toBe('0.1.2-dev.2');
  });

  it('都不是祖先时另起一条线', () => {
    expect(findBaseline(builds, () => false)).toBeNull();
  });
});

describe('describeBaseline', () => {
  const head = '8cbbce15c46f8cd5bdb0f66a6e2703cd0123392e';

  it('另起一条线时写分支和提交', () => {
    expect(describeBaseline({ baseline: null, headCommit: head, branch: 'main' })).toBe(
      '另起一条线（main@8cbbce1）',
    );
  });

  it('接着之前的包', () => {
    const baseline = build('0.1.2-dev.2', 'd64fa134a5095ac5873d1dfed0d563c463529cca');
    expect(describeBaseline({ baseline, headCommit: head, branch: 'feat/30-dev-build' })).toBe(
      '接着 v0.1.2-dev.2（d64fa13）',
    );
  });

  it('同一个提交', () => {
    const baseline = build('0.1.2-dev.2', head);
    expect(describeBaseline({ baseline, headCommit: head, branch: 'main' })).toBe(
      '与 v0.1.2-dev.2 是同一个提交',
    );
  });
});

describe('devInstallerName', () => {
  it('把版本号换成编号', () => {
    expect(devInstallerName('Learnis_0.1.2+3_x64-setup.exe', devBuild('0.1.2', 3))).toBe(
      'Learnis_0.1.2-dev.3_x64-setup.exe',
    );
  });

  it('文件名里没有版本号时报错', () => {
    expect(() => devInstallerName('Learnis_0.1.2_x64-setup.exe', devBuild('0.1.2', 3))).toThrow();
  });
});
