import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';

/** Shown when a page crashes or fails to load (e.g. after a deploy changed chunk names). */
export function RouteError() {
  const error = useRouteError();
  const chunkError = error instanceof Error && /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message);
  console.error('[route error]', error);
  return (
    <div className="container py-16">
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={TriangleAlert}
          title={chunkError ? 'OrbitPost was updated' : 'Something went wrong on this page'}
          description={
            chunkError
              ? 'A new version is available. Reload to continue.'
              : isRouteErrorResponse(error)
                ? `${error.status} ${error.statusText}`
                : 'The error was logged. Reload the page or go back to the dashboard.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.location.reload()}>
                <RotateCw /> Reload
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Dashboard</Link>
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}
