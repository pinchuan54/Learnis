import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { ThemeProvider } from './theme/ThemeProvider';

// 发布版屏蔽网页默认右键菜单，更接近原生应用
if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (event) => event.preventDefault());
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
