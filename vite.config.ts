import process from 'node:process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

const host = process.env.TAURI_DEV_HOST;
const isDebug = !!process.env.TAURI_ENV_DEBUG;

// 内部测试包由 npm run build:dev 传入带构建号的版本号（如 0.1.2+3）和提交号；正式版不传
const appVersion = process.env.LEARNIS_APP_VERSION || pkg.version;
const buildCommit = process.env.LEARNIS_BUILD_COMMIT || '';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },

  // 以下为 Tauri 开发所需的设置
  // 1. 不清屏，避免遮住 Rust 的报错
  clearScreen: false,
  // 2. Tauri 需要固定端口，被占用时直接失败
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    // 3. 不监听 src-tauri 目录
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Windows 使用 WebView2（Chromium），macOS / Linux 使用 WebKit
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
    minify: !isDebug,
    sourcemap: isDebug,
    // 两个页面：主窗口和悬浮窗（悬浮窗只加载自己用到的部分）
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        float: fileURLToPath(new URL('./float.html', import.meta.url)),
      },
    },
  },

  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
