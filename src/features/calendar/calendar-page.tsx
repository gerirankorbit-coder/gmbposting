import { CalendarDays } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function CalendarPage() {
  return (
    <ShellPage
      eyebrow="Schedule"
      title="Posting Calendar"
      highlight="Calendar"
      description="Every scheduled and published post, colour-coded by client."
      icon={CalendarDays}
      emptyTitle="Your calendar is clear"
      emptyDescription="Scheduled posts will appear here."
    />
  );
}
