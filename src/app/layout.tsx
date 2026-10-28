import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { Navbar } from '@/components/layout/navbar';
import { NewPostFab } from '@/components/layout/new-post-fab';
import { PageSkeleton } from '@/components/page-skeleton';
import { useSystemAlerts } from './system-alerts';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-orbit-primary/20 border-t-orbit-primary" />
    </div>
  );
}

/** Authenticated application shell. Redirects to /sign-in when signed out. */
export function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) return <FullScreenLoader />;
  if (!isSignedIn) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirect}`} replace />;
  }

  return <SignedInShell />;
}

function SignedInShell() {
  const alerts = useSystemAlerts();
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <AnnouncementBar alerts={alerts} />
      <Navbar />
      <main id="main" className="container flex-1 pb-28 pt-8 sm:pt-10">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <NewPostFab />
    </div>
  );
}
