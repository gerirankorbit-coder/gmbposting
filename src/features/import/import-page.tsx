import { FileSpreadsheet } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function ImportPage() {
  return (
    <ShellPage
      eyebrow="Bulk import"
      title="Import Posts"
      highlight="Posts"
      description="Upload a spreadsheet, review the matches, and schedule everything in one go."
      icon={FileSpreadsheet}
      emptyTitle="No imports yet"
      emptyDescription="Download the template, fill it in, and drop it here to schedule posts in bulk."
    />
  );
}
