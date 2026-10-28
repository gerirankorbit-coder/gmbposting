import { type ReactNode, useState } from 'react';
import { ClerkProvider } from '@clerk/react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthTokenBridge } from './auth';

const clerkAppearance = {
  variables: {
    colorPrimary: '#8B2CF5',
    colorText: '#0B0B14',
    colorTextSecondary: '#6B6B80',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    borderRadius: '0.9rem',
    fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    card: 'shadow-none border-0 bg-transparent',
    rootBox: 'w-full',
    cardBox: 'shadow-none w-full',
    formButtonPrimary:
      'rounded-full bg-[linear-gradient(90deg,#7C3AED_0%,#A21CAF_60%,#D946EF_100%)] shadow-[0_10px_40px_-10px_rgba(139,44,245,0.35)] hover:brightness-95',
    formFieldInput: 'rounded-xl',
    footer: 'bg-transparent',
  },
};

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        // Background refetch failures surface once as a toast; initial load errors are shown inline.
        if (query.state.data !== undefined) toast.error(errorMessage(err));
      },
    }),
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        if (!mutation.options.onError) toast.error(errorMessage(err));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) =>
          !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  });
}

export function Providers({ children, publishableKey }: { children: ReactNode; publishableKey: string }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signInFallbackRedirectUrl="/"
      afterSignOutUrl="/sign-in"
    >
      <AuthTokenBridge />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{ className: 'rounded-2xl font-sans' }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
