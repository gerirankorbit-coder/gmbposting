import { Users } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function ClientsPage() {
  return (
    <ShellPage
      eyebrow="Brands"
      title="Clients"
      highlight="Clients"
      description="Group locations by brand, set brand voice and default links."
      icon={Users}
      emptyTitle="No clients yet"
      emptyDescription="Clients are created automatically on sync, or add one yourself."
    />
  );
}
