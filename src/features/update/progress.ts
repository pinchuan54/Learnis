import type { UpdateProgress } from '../../api/types';

export interface ProgressView {
  /** 进度条比例 0–1；不知道总大小时为 null（显示为不确定进度） */
  ratio: number | null;
  text: string;
}

/** 字节数显示为 MB，保留一位小数 */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 把下载进度转成进度条比例和说明文字 */
export function describeProgress(progress: UpdateProgress | null): ProgressView {
  if (!progress) {
    return { ratio: null, text: '正在准备下载…' };
  }
  const { downloaded, total } = progress;
  if (total === null || total <= 0) {
    return { ratio: null, text: `正在下载，已下载 ${formatMegabytes(downloaded)}` };
  }
  if (downloaded >= total) {
    return { ratio: 1, text: '下载完成，正在安装，Learnis 会自动重新打开' };
  }
  const ratio = downloaded / total;
  return {
    ratio,
    text: `正在下载 ${Math.floor(ratio * 100)}%（${formatMegabytes(downloaded)} / ${formatMegabytes(total)}）`,
  };
}
