import { PenSquare } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function ComposePage() {
  return (
    <ShellPage
      eyebrow="Create"
      title="Compose a Post"
      highlight="Post"
      description="Write once or generate unique variations for every location."
      icon={PenSquare}
      emptyTitle="Ready when your locations are"
      emptyDescription="Once locations are synced you can compose posts for one or many of them."
    />
  );
}
