import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { SignInPage } from '@/features/auth/sign-in-page';
import { NotFoundPage } from '@/features/misc/not-found-page';
import { AppLayout } from './layout';
import { RoleGate } from './role-gate';

const page = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((m) => ({ default: m[name] })));

const DashboardPage = page(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage');
const ImportPage = page(() => import('@/features/import/import-page'), 'ImportPage');
const ComposePage = page(() => import('@/features/compose/compose-page'), 'ComposePage');
const CalendarPage = page(() => import('@/features/calendar/calendar-page'), 'CalendarPage');
const QueuePage = page(() => import('@/features/queue/queue-page'), 'QueuePage');
const ApprovalsPage = page(() => import('@/features/approvals/approvals-page'), 'ApprovalsPage');
const LibraryPage = page(() => import('@/features/library/library-page'), 'LibraryPage');
const LocationsPage = page(() => import('@/features/locations/locations-page'), 'LocationsPage');
const ConnectionsPage = page(
  () => import('@/features/connections/connections-page'),
  'ConnectionsPage',
);
const ClientsPage = page(() => import('@/features/clients/clients-page'), 'ClientsPage');
const NotificationsPage = page(
  () => import('@/features/notifications/notifications-page'),
  'NotificationsPage',
);
const ActivityPage = page(() => import('@/features/activity/activity-page'), 'ActivityPage');
const SettingsPage = page(() => import('@/features/settings/settings-page'), 'SettingsPage');

export const router = createBrowserRouter([
  { path: '/sign-in/*', element: <SignInPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'compose', element: <ComposePage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'queue', element: <QueuePage /> },
      {
        path: 'approvals',
        element: (
          <RoleGate role="manager">
            <ApprovalsPage />
          </RoleGate>
        ),
      },
      { path: 'library', element: <LibraryPage /> },
      { path: 'locations', element: <LocationsPage /> },
      { path: 'connections', element: <ConnectionsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'activity', element: <ActivityPage /> },
      {
        path: 'settings',
        element: (
          <RoleGate role="admin">
            <SettingsPage />
          </RoleGate>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
