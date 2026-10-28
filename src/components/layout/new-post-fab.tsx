import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';

/** Fixed bottom-right gradient action button. Hidden on the compose page itself. */
export function NewPostFab() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/compose')) return null;
  return (
    <Link
      to="/compose"
      className="fixed bottom-5 right-5 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-orbit-gradient pl-4 pr-5 text-sm font-bold text-white shadow-glow transition hover:shadow-glow-strong hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60 focus-visible:ring-offset-2 sm:bottom-8 sm:right-8"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-orbit-primary">
        <Plus className="h-4 w-4" aria-hidden />
      </span>
      New Post
    </Link>
  );
}
