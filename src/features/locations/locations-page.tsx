import { MapPin } from 'lucide-react';
import { ShellPage } from '@/features/misc/coming-soon';

export function LocationsPage() {
  return (
    <ShellPage
      eyebrow="Profiles"
      title="Locations"
      highlight="Locations"
      description="Every Business Profile your connected Gmails can manage."
      icon={MapPin}
      emptyTitle="No locations synced"
      emptyDescription="Connect a Google account and run a sync to import locations."
    />
  );
}
