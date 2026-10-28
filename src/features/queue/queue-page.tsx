import { ListChecks } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function QueuePage() {
  return (
    <ShellPage
      eyebrow="Pipeline"
      title="Post Queue"
      highlight="Queue"
      description="Every post across every client, with filters and quick actions."
      icon={ListChecks}
      emptyTitle="The queue is empty"
      emptyDescription="Posts you create or import will show up here."
    />
  );
}
