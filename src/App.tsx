import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './layouts/AppLayout';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';

// 桌面应用没有地址栏，使用 hash 路由，开发时刷新也能停留在当前页面
const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <CalendarPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
