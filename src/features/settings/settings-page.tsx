import { Settings } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function SettingsPage() {
  return (
    <ShellPage
      eyebrow="Admin"
      title="Settings"
      highlight="Settings"
      description="Approval rules, publisher limits, and team roles."
      icon={Settings}
      emptyTitle="Settings"
      emptyDescription="Workspace settings will appear here."
    />
  );
}
