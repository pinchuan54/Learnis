import process from 'node:process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

const host = process.env.TAURI_DEV_HOST;
const isDebug = !!process.env.TAURI_ENV_DEBUG;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
  },

  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
