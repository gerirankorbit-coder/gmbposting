import { Activity } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function ActivityPage() {
  return (
    <ShellPage
      eyebrow="Audit"
      title="Activity Log"
      highlight="Activity"
      description="Everything that happened, by whom and when."
      icon={Activity}
      emptyTitle="No activity yet"
      emptyDescription="Actions taken by your team and the publisher are recorded here."
    />
  );
}
