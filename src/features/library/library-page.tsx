import { BookImage } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function LibraryPage() {
  return (
    <ShellPage
      eyebrow="Images"
      title="Image Library"
      highlight="Library"
      description="Each client's images, stock levels, and brand kit."
      icon={BookImage}
      emptyTitle="No client libraries yet"
      emptyDescription="Clients are created automatically when locations sync."
    />
  );
}
