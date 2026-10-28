import { CheckCheck } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function ApprovalsPage() {
  return (
    <ShellPage
      eyebrow="Review"
      title="Approvals"
      highlight="Approvals"
      description="Review posts before they go live."
      icon={CheckCheck}
      emptyTitle="Nothing waiting for approval"
      emptyDescription="Posts submitted for review will appear here grouped by campaign."
    />
  );
}
