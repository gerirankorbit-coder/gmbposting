import { Bell } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function NotificationsPage() {
  return (
    <ShellPage
      eyebrow="Alerts"
      title="Notifications"
      highlight="Notifications"
      description="Library stock, failed posts, imports and connection alerts."
      icon={Bell}
      emptyTitle="You're all caught up"
      emptyDescription="New alerts will appear here."
    />
  );
}
