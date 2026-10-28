import { Link2 } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function ConnectionsPage() {
  return (
    <ShellPage
      eyebrow="Google"
      title="Connections"
      highlight="Connections"
      description="Gmail accounts connected through Google OAuth."
      icon={Link2}
      emptyTitle="No Google accounts connected"
      emptyDescription="Connect a Gmail that manages your clients' Business Profiles."
    />
  );
}
