import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { inTauri } from './lib/platform';
import './styles/global.css';

// 标记运行环境：浏览器预览时没有 Mica，样式会改用纯色背景
document.documentElement.dataset.platform = inTauri ? 'tauri' : 'web';

// 发布版屏蔽网页默认右键菜单，更接近原生应用
if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (event) => event.preventDefault());
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
