import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from './api/queryClient';
import { FloatApp } from './features/float/FloatApp';
import './styles/tokens.css';
import './styles/palette.css';
import './features/float/float.css';

// 悬浮窗页面入口（float.html）：只加载悬浮窗用到的部分，比主窗口轻。右键用系统原生菜单
document.addEventListener('contextmenu', (event) => event.preventDefault());

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FloatApp />
    </QueryClientProvider>
  </StrictMode>,
);
