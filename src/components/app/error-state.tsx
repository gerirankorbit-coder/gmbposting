import { AlertCircle, RotateCw } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function ErrorState({ error, onRetry, title = 'Could not load this data' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <p className="font-bold text-orbit-heading">{title}</p>
        <p className="mt-1 max-w-md text-sm text-orbit-muted">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}
