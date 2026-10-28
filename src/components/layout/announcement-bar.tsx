import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export interface SystemAlert {
  id: string;
  message: string;
  link?: string;
}

/** Slim gradient bar at the very top of the app for system-wide alerts. */
export function AnnouncementBar({ alerts }: { alerts: SystemAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div role="status" className="bg-orbit-gradient text-white">
      <div className="container flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-2 text-center text-xs font-bold sm:text-sm">
        {alerts.map((a) =>
          a.link ? (
            <Link
              key={a.id}
              to={a.link}
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline focus-visible:ring-white"
            >
              {a.message}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : (
            <span key={a.id}>{a.message}</span>
          ),
        )}
      </div>
    </div>
  );
}
