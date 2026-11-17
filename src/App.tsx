import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './layouts/AppLayout';
import { CalendarPage } from './pages/CalendarPage';
import { DayPage } from './pages/DayPage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';

// 桌面应用没有地址栏，使用 hash 路由，开发时刷新也能停留在当前页面
const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <CalendarPage /> },
      { path: 'today', element: <DayPage /> },
      { path: 'day/:date', element: <DayPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'settings/:section?', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
