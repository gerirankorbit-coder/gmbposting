import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ClerkLoading, SignIn, SignUp, useAuth } from '@clerk/react';
import { CalendarClock, ShieldCheck, Sparkles } from 'lucide-react';
import { Bubbles, OrbitLine } from '@/components/layout/orbit-decor';
import { Skeleton } from '@/components/ui/skeleton';

const HIGHLIGHTS = [
  { icon: Sparkles, text: 'Unique AI-written posts for every location' },
  { icon: CalendarClock, text: 'Spreadsheet import, approvals and scheduling' },
  { icon: ShieldCheck, text: 'Official Google Business Profile APIs only' },
];

export function SignInPage() {
  return <AuthPage mode="sign-in" />;
}

/** Where invitation links land: Clerk's sign-up form accepts the invitation ticket in the URL. */
export function SignUpPage() {
  return <AuthPage mode="sign-up" />;
}

/** Hides Clerk's "Don't have an account? Sign up" link: accounts are created by invitation only. */
const AUTH_APPEARANCE = { elements: { headerTitle: 'font-extrabold tracking-tight', footerAction: { display: 'none' } } };

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  // Sign-up starts only from an invitation email link (it carries a __clerk_ticket); Clerk's own
  // follow-up steps live on sub-paths such as /sign-up/continue.
  const bareSignUp = pathname.replace(/\/+$/, '') === '/sign-up';
  if (mode === 'sign-up' && bareSignUp && !params.get('__clerk_ticket') && !params.get('__clerk_status')) {
    return <Navigate to="/sign-in" replace />;
  }
  const redirect = params.get('redirect_url');
  const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';

  if (isLoaded && isSignedIn) return <Navigate to={safeRedirect} replace />;

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <Bubbles className="-z-10" />
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <section className="relative">
          <OrbitLine className="-left-16 top-6 -z-10 h-64 w-[120%] max-w-none" />
          <img src="/logo.svg" alt="Rank Orbit" className="mb-10 h-8 w-auto" />
          <span className="eyebrow mb-5">OrbitPost by Rank Orbit</span>
          <h1 className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Automate Your <span className="text-gradient">GBP Posting</span> Into Next Orbit
            <span className="text-gradient">.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-orbit-muted sm:text-lg">
            Connect every Gmail, sync every Business Profile, and ship fresh, approved posts for all
            of your clients on schedule.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-semibold text-orbit-heading">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-orbit-primary shadow-glow">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex justify-center lg:justify-end">
          <div className="glass-card w-full max-w-md p-2 sm:p-4">
            <ClerkLoading>
              <div className="space-y-4 p-6" role="status" aria-label="Loading sign-in">
                <Skeleton className="mx-auto h-7 w-48" />
                <Skeleton className="mx-auto h-4 w-64" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full rounded-full" />
              </div>
            </ClerkLoading>
            {mode === 'sign-in' ? (
              <SignIn
                routing="path"
                path="/sign-in"
                forceRedirectUrl={safeRedirect}
                appearance={AUTH_APPEARANCE}
              />
            ) : (
              <SignUp
                routing="path"
                path="/sign-up"
                forceRedirectUrl={safeRedirect}
                appearance={AUTH_APPEARANCE}
              />
            )}
            <p className="px-4 pb-3 pt-1 text-center text-xs text-orbit-muted">
              Access is by invitation only. Ask your Rank Orbit admin for an invite.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
