import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';
import '@/styles/globals.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card max-w-lg p-8">
        <span className="eyebrow mb-4">Setup required</span>
        <h1 className="text-2xl">
          Add your Clerk key<span className="text-gradient">.</span>
        </h1>
        <p className="mt-3 text-sm text-orbit-muted">
          Set <code className="rounded bg-orbit-primary/10 px-1.5 py-0.5">VITE_CLERK_PUBLISHABLE_KEY</code>{' '}
          in your environment (see <code>.env.example</code> and the README), then rebuild.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publishableKey ? (
      <Providers publishableKey={publishableKey}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </Providers>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
);
