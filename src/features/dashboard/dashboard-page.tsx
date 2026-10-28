import { LayoutDashboard } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function DashboardPage() {
  return (
    <ShellPage
      eyebrow="Overview"
      title="Mission Control"
      highlight="Control"
      description="Your agency's posting at a glance: schedule, stock, and anything that needs attention."
      icon={LayoutDashboard}
      emptyTitle="Nothing in orbit yet"
      emptyDescription="Connect your first Google account to start syncing Business Profiles."
      bubbles
    />
  );
}
