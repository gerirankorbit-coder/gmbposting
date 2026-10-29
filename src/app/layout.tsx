import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { Bubbles } from '@/components/layout/orbit-decor';
import { Button } from '@/components/ui/button';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { Navbar } from '@/components/layout/navbar';
import { NewPostFab } from '@/components/layout/new-post-fab';
import { PageSkeleton } from '@/components/page-skeleton';
import { useMe } from './auth';
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

  return <AccessGate />;
}

/** Signed in to Clerk is not enough: the account also needs a role (invite-only access). */
function AccessGate() {
  const me = useMe();
  if (me.isLoading) return <FullScreenLoader />;
  if (me.error instanceof ApiRequestError && me.error.code === 'no_access') return <NoAccess message={me.error.message} />;
  return <SignedInShell />;
}

function NoAccess({ message }: { message: string }) {
  const { signOut } = useClerk();
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center px-4 py-10">
      <Bubbles className="-z-10" />
      <div className="glass-card w-full max-w-md p-8 text-center">
        <img src="/logo.svg" alt="Rank Orbit" className="mx-auto mb-8 h-7 w-auto" />
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-2xl">Invite required</h1>
        <p className="wrap-anywhere mt-3 text-sm text-orbit-muted">{message}</p>
        <Button className="mt-6" variant="secondary" onClick={() => void signOut({ redirectUrl: '/sign-in' })}>
          <LogOut /> Sign out
        </Button>
      </div>
    </div>
  );
}

function SignedInShell() {
  const alerts = useSystemAlerts();
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-orbit-primary shadow-glow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <AnnouncementBar alerts={alerts} />
      <Navbar />
      <main id="main" tabIndex={-1} className="container flex-1 pb-28 pt-8 focus:outline-none sm:pt-10">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <NewPostFab />
    </div>
  );
}
